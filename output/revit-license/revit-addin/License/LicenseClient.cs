using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.NetworkInformation;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using RevitLicense.Auth.Models;

namespace RevitLicense.License
{
    /// <summary>Outcome of a CanRun check.</summary>
    public sealed class LicenseDecision
    {
        public bool Allowed { get; }
        public string Reason { get; }   // VN, user-facing (only when denied)
        public bool InGrace { get; }    // running on offline grace
        public int GraceDaysLeft { get; }

        private LicenseDecision(bool allowed, string reason, bool inGrace, int graceDaysLeft)
        {
            Allowed = allowed;
            Reason = reason;
            InGrace = inGrace;
            GraceDaysLeft = graceDaysLeft;
        }

        public static LicenseDecision Allow(bool inGrace = false, int graceDaysLeft = 0) =>
            new LicenseDecision(true, null, inGrace, graceDaysLeft);

        public static LicenseDecision Deny(string reason) =>
            new LicenseDecision(false, reason, false, 0);
    }

    /// <summary>
    /// Singleton license core. Holds the access_token (RAM only), the cached
    /// entitlement token, calls /activate + /refresh-token, and implements the
    /// per-command CanRun algorithm (section 4.4):
    ///
    ///   verify -> if now &lt; exp: trust disciplines
    ///          -> else online: refresh; offline + within grace: trust; else deny.
    ///
    /// All network calls are async, share one static HttpClient, and have a 5s
    /// timeout. Verification is offline and fast, so CanRun is sync for callers;
    /// it only blocks when a refresh/activate is genuinely required (token
    /// missing or expired), matching the documented algorithm.
    /// </summary>
    public sealed class LicenseClient
    {
        // -------------------- Singleton --------------------
        private static readonly Lazy<LicenseClient> _instance =
            new Lazy<LicenseClient>(() => new LicenseClient(), LazyThreadSafetyMode.ExecutionAndPublication);
        public static LicenseClient Instance => _instance.Value;

        private static readonly HttpClient Http = CreateClient();
        private readonly object _gate = new object();

        // access_token: RAM ONLY. Set after login/refresh by the auth flow.
        private string _accessToken;
        private EntitlementToken _token;             // cached entitlement (verified)
        private DateTimeOffset _lastBackgroundRefresh = DateTimeOffset.MinValue;
        private int _backgroundRefreshing; // 0/1 flag via Interlocked

        // Refresh in the background when within this window of expiry.
        private static readonly TimeSpan NearExpiryWindow = TimeSpan.FromHours(2);

        private LicenseClient()
        {
            // Best-effort: load whatever entitlement token is cached.
            _token = TokenCache.Load();
        }

        private static HttpClient CreateClient()
        {
            try
            {
                ServicePointManager.SecurityProtocol |=
                    SecurityProtocolType.Tls12 | (SecurityProtocolType)3072;
            }
            catch { ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12; }

            var c = new HttpClient { Timeout = TimeSpan.FromSeconds(Config.HttpTimeoutSeconds) };
            c.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            return c;
        }

        // ==================================================================
        // Command-id -> product registry
        // ==================================================================

        /// <summary>
        /// Hardcoded command-id -> product map. Prefix convention "ARC.*"->"ARC"
        /// is also applied so new commands following the naming scheme work
        /// without an explicit entry. (Server-side command_registry is the long
        /// term source of truth; this is the offline fallback.)
        /// </summary>
        private static readonly Dictionary<string, string> CommandProductMap =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["ARC.WallDimension"] = "ARC",
                ["ARC.AutoDimension"] = "ARC",
                ["STR.ColumnRebar"] = "STR",
                ["STR.BeamRebar"] = "STR",
                ["MEP.DuctSizing"] = "MEP",
            };

        /// <summary>
        /// Resolve the discipline a command needs. Explicit map first, then the
        /// "PREFIX.*" convention (ARC/STR/MEP). Returns null if unknown.
        /// </summary>
        public static string RequiredProduct(string commandId)
        {
            if (string.IsNullOrEmpty(commandId)) return null;
            if (CommandProductMap.TryGetValue(commandId, out var p)) return p;

            int dot = commandId.IndexOf('.');
            if (dot > 0)
            {
                string prefix = commandId.Substring(0, dot).ToUpperInvariant();
                if (prefix == "ARC" || prefix == "STR" || prefix == "MEP") return prefix;
            }
            return null;
        }

        // ==================================================================
        // Auth wiring
        // ==================================================================

        /// <summary>Set the current Supabase access_token (RAM only).</summary>
        public void SetAccessToken(string accessToken)
        {
            lock (_gate) { _accessToken = accessToken; }
        }

        public bool HasAccessToken
        {
            get { lock (_gate) { return !string.IsNullOrEmpty(_accessToken); } }
        }

        private string AccessToken
        {
            get { lock (_gate) { return _accessToken; } }
        }

        /// <summary>
        /// Read-only access_token accessor for the telemetry sender. Kept narrow
        /// (telemetry is the only external consumer) — the token never leaves RAM.
        /// </summary>
        public string TelemetryAccessToken
        {
            get { lock (_gate) { return _accessToken; } }
        }

        // ==================================================================
        // CanRun — the core algorithm (section 4.4)
        // ==================================================================

        /// <summary>
        /// Decide whether <paramref name="commandId"/> may run right now.
        /// Synchronous: offline verify is instant; only blocks (≤5s) when an
        /// activate/refresh is actually required.
        /// </summary>
        public LicenseDecision CanRun(string commandId)
        {
            string product = RequiredProduct(commandId);
            if (product == null)
                return LicenseDecision.Deny("Lệnh này chưa được đăng ký bộ môn. Anh/chị liên hệ nhà cung cấp giúp em.");

            EntitlementToken token;
            lock (_gate) { token = _token; }

            // No token yet -> activate once (network).
            if (token == null)
            {
                try
                {
                    token = ActivateAsync().GetAwaiter().GetResult();
                }
                catch (LicenseException ex)
                {
                    return LicenseDecision.Deny(ex.Message);
                }
                if (token == null)
                    return LicenseDecision.Deny("Chưa kích hoạt được license. Anh/chị đăng nhập và thử lại giúp em.");
            }

            // Verify signature offline. Tampered/foreign cache fails here.
            if (!Ed25519Verifier.Verify(token))
            {
                TokenCache.Clear();
                lock (_gate) { _token = null; }
                return LicenseDecision.Deny("Token license không hợp lệ. Anh/chị đăng nhập lại để kích hoạt giúp em.");
            }

            var now = DateTimeOffset.UtcNow;

            // Still valid -> trust disciplines (offline, no network).
            if (now < token.ExpUtc)
            {
                // Opportunistic background refresh if near expiry.
                MaybeBackgroundRefresh(token, now);

                return token.HasDiscipline(product)
                    ? LicenseDecision.Allow()
                    : DenyNotEntitled(product);
            }

            // Expired -> try to refresh if we have network.
            if (IsNetworkAvailable())
            {
                try
                {
                    var refreshed = RefreshAsync().GetAwaiter().GetResult();
                    if (refreshed != null)
                    {
                        return refreshed.HasDiscipline(product)
                            ? LicenseDecision.Allow()
                            : DenyNotEntitled(product);
                    }
                }
                catch (LicenseException)
                {
                    // Fall through to grace handling below.
                }
            }

            // Offline (or refresh failed) -> allow within grace window.
            if (now < token.GraceUntilUtc)
            {
                int daysLeft = (int)Math.Ceiling((token.GraceUntilUtc - now).TotalDays);
                return token.HasDiscipline(product)
                    ? LicenseDecision.Allow(inGrace: true, graceDaysLeft: daysLeft)
                    : DenyNotEntitled(product);
            }

            return LicenseDecision.Deny("Cần kết nối mạng để xác thực lại license. Anh/chị kết nối mạng rồi thử lại giúp em.");
        }

        private static LicenseDecision DenyNotEntitled(string product) =>
            LicenseDecision.Deny(
                $"Bộ môn {ProductName(product)} ({product}) chưa được kích hoạt. " +
                "Anh/chị mua hoặc gia hạn để sử dụng tính năng này giúp em.");

        private static string ProductName(string code)
        {
            switch ((code ?? "").ToUpperInvariant())
            {
                case "ARC": return "Kiến trúc";
                case "STR": return "Kết cấu";
                case "MEP": return "Điện nước/MEP";
                default: return code;
            }
        }

        // ==================================================================
        // Activate / Refresh
        // ==================================================================

        /// <summary>POST /api/activate with the access_token. Caches + returns the token.</summary>
        public async Task<EntitlementToken> ActivateAsync()
        {
            var body = new ActivateRequest
            {
                DeviceId = DeviceId.Get(),
                DeviceName = DeviceId.GetDeviceName()
            };
            var resp = await PostAuthedAsync<EntitlementResponse>(
                Config.API_BASE.TrimEnd('/') + "/api/activate", body).ConfigureAwait(false);
            return StoreEntitlement(resp);
        }

        /// <summary>
        /// POST /api/issue-trial with the access_token to grant a 30-day trial for
        /// a new user/device. Call once right after first sign-up (before
        /// Activate). Returns the raw HTTP success; the trial subscriptions then
        /// show up in the next /activate token. Throws LicenseException on error
        /// (e.g. 409 "đã dùng thử rồi").
        /// </summary>
        public async Task IssueTrialAsync()
        {
            var body = new IssueTrialRequest { DeviceFingerprint = DeviceId.Get() };
            await PostAuthedAsync<object>(
                Config.API_BASE.TrimEnd('/') + "/api/issue-trial", body).ConfigureAwait(false);
        }

        /// <summary>POST /api/refresh-token with the access_token. Caches + returns the token.</summary>
        public async Task<EntitlementToken> RefreshAsync()
        {
            var body = new RefreshTokenRequest { DeviceId = DeviceId.Get() };
            var resp = await PostAuthedAsync<EntitlementResponse>(
                Config.API_BASE.TrimEnd('/') + "/api/refresh-token", body).ConfigureAwait(false);
            return StoreEntitlement(resp);
        }

        private EntitlementToken StoreEntitlement(EntitlementResponse resp)
        {
            if (resp == null || string.IsNullOrEmpty(resp.Token))
                throw new LicenseException("Máy chủ không trả về token hợp lệ.");

            EntitlementToken parsed;
            try { parsed = EntitlementToken.Parse(resp.Token); }
            catch (Exception) { throw new LicenseException("Token license trả về không hợp lệ."); }

            // Verify before trusting/persisting.
            if (!Ed25519Verifier.Verify(parsed))
                throw new LicenseException("Chữ ký token không hợp lệ.");

            TokenCache.Save(resp.Token);
            lock (_gate) { _token = parsed; }
            return parsed;
        }

        /// <summary>Current cached entitlement token (may be null / expired).</summary>
        public EntitlementToken CurrentToken
        {
            get { lock (_gate) { return _token; } }
        }

        // ==================================================================
        // Background refresh (non-blocking, fire-and-forget)
        // ==================================================================

        private void MaybeBackgroundRefresh(EntitlementToken token, DateTimeOffset now)
        {
            if (token.ExpUtc - now > NearExpiryWindow) return;
            // Throttle: at most one background refresh per 10 minutes.
            if (now - _lastBackgroundRefresh < TimeSpan.FromMinutes(10)) return;
            if (Interlocked.CompareExchange(ref _backgroundRefreshing, 1, 0) != 0) return;

            _lastBackgroundRefresh = now;
            Task.Run(async () =>
            {
                try
                {
                    if (IsNetworkAvailable() && HasAccessToken)
                        await RefreshAsync().ConfigureAwait(false);
                }
                catch
                {
                    // Background — never surface to the user.
                }
                finally
                {
                    Interlocked.Exchange(ref _backgroundRefreshing, 0);
                }
            });
        }

        // ==================================================================
        // HTTP helper (Bearer access_token)
        // ==================================================================

        private async Task<T> PostAuthedAsync<T>(string url, object body)
        {
            string accessToken = AccessToken;
            if (string.IsNullOrEmpty(accessToken))
                throw new LicenseException("Chưa đăng nhập. Anh/chị đăng nhập để kích hoạt license giúp em.");

            using (var req = new HttpRequestMessage(HttpMethod.Post, url))
            {
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                req.Content = new StringContent(Json.Serialize(body), Encoding.UTF8, "application/json");

                HttpResponseMessage resp;
                try
                {
                    resp = await Http.SendAsync(req).ConfigureAwait(false);
                }
                catch (TaskCanceledException)
                {
                    throw new LicenseException("Kết nối tới máy chủ license quá lâu. Anh/chị kiểm tra mạng giúp em.");
                }
                catch (HttpRequestException ex)
                {
                    throw new LicenseException("Không kết nối được tới máy chủ license. Anh/chị kiểm tra mạng giúp em.", ex);
                }

                string text = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);

                if (resp.StatusCode == HttpStatusCode.Forbidden)
                    throw new LicenseException(ExtractApiError(text) ??
                        "Vượt số máy cho phép. Anh/chị vào trang web gỡ bớt thiết bị rồi thử lại giúp em.");

                if (resp.StatusCode == HttpStatusCode.Unauthorized)
                    throw new LicenseException("Phiên đăng nhập hết hạn. Anh/chị đăng nhập lại giúp em.");

                if (!resp.IsSuccessStatusCode)
                    throw new LicenseException(ExtractApiError(text) ??
                        "Máy chủ license gặp lỗi. Anh/chị thử lại sau giúp em.");

                // Endpoints with no useful body (e.g. issue-trial) -> caller used object.
                if (typeof(T) == typeof(object) || string.IsNullOrWhiteSpace(text))
                    return default(T);

                var parsed = Json.TryDeserialize<T>(text);
                if (parsed == null)
                    throw new LicenseException("Máy chủ trả về dữ liệu không hợp lệ.");
                return parsed;
            }
        }

        private static string ExtractApiError(string body)
        {
            var err = Json.TryDeserialize<ApiError>(body);
            return string.IsNullOrWhiteSpace(err?.Error) ? null : err.Error;
        }

        // ==================================================================
        // Network availability
        // ==================================================================

        /// <summary>
        /// Cheap, non-blocking network check. NetworkInterface.GetIsNetworkAvailable
        /// avoids a synchronous DNS/HTTP probe; the real connectivity is then
        /// proven (or not) by the actual HTTP call with its 5s timeout.
        /// </summary>
        public static bool IsNetworkAvailable()
        {
            try { return NetworkInterface.GetIsNetworkAvailable(); }
            catch { return true; } // assume available; the HTTP call will fail fast if not
        }

        public void Logout()
        {
            lock (_gate)
            {
                _accessToken = null;
                _token = null;
            }
            TokenCache.Clear();
        }
    }

    /// <summary>License-flow error carrying a VN user-facing message.</summary>
    public class LicenseException : Exception
    {
        public LicenseException(string message) : base(message) { }
        public LicenseException(string message, Exception inner) : base(message, inner) { }
    }

    /// <summary>Generic {error} body from the business API.</summary>
    [System.Runtime.Serialization.DataContract]
    internal class ApiError
    {
        [System.Runtime.Serialization.DataMember(Name = "error", EmitDefaultValue = false)]
        public string Error { get; set; }

        [System.Runtime.Serialization.DataMember(Name = "message", EmitDefaultValue = false)]
        public string Message { get; set; }
    }
}
