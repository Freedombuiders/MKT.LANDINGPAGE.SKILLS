using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using RevitLicense.Auth.Models;

namespace RevitLicense.Auth
{
    /// <summary>
    /// Thrown for any auth failure with a Vietnamese, user-facing message.
    /// </summary>
    public class AuthException : Exception
    {
        public AuthException(string message) : base(message) { }
        public AuthException(string message, Exception inner) : base(message, inner) { }
    }

    /// <summary>
    /// Talks to Supabase Auth (GoTrue) REST. Uses a single static HttpClient
    /// (reused, 5s timeout). All methods are async and never block the UI.
    /// Only the anon key is sent; access_token is returned to the caller (kept
    /// in RAM) and the refresh_token is persisted by TokenStore.
    /// </summary>
    public class SupabaseAuthClient
    {
        private static readonly HttpClient Http = CreateClient();

        private static HttpClient CreateClient()
        {
            // Revit ships on .NET Framework where TLS 1.2 is not always default.
            try
            {
                ServicePointManager.SecurityProtocol |=
                    SecurityProtocolType.Tls12 | (SecurityProtocolType)3072; // Tls13 if available
            }
            catch
            {
                // Some platforms reject Tls13 flag; TLS 1.2 alone is fine.
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            }

            var c = new HttpClient { Timeout = TimeSpan.FromSeconds(Config.HttpTimeoutSeconds) };
            c.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            return c;
        }

        private static string AuthBase => Config.SUPABASE_URL.TrimEnd('/') + "/auth/v1";

        // ------------------------------------------------------------------
        // Public API
        // ------------------------------------------------------------------

        /// <summary>POST /signup. On success GoTrue emails a confirmation link.</summary>
        public async Task<GoTrueSession> SignUpAsync(string email, string password, string fullName, string phone)
        {
            var body = new SignUpRequest
            {
                Email = email,
                Password = password,
                Data = new SignUpMetadata { FullName = fullName, Phone = phone }
            };
            return await PostAsync<GoTrueSession>(AuthBase + "/signup", body).ConfigureAwait(false);
        }

        /// <summary>POST /token?grant_type=password. Returns a full session.</summary>
        public async Task<GoTrueSession> SignInAsync(string email, string password)
        {
            var body = new PasswordGrantRequest { Email = email, Password = password };
            return await PostAsync<GoTrueSession>(AuthBase + "/token?grant_type=password", body).ConfigureAwait(false);
        }

        /// <summary>POST /token?grant_type=refresh_token. Silent re-login.</summary>
        public async Task<GoTrueSession> RefreshAsync(string refreshToken)
        {
            var body = new RefreshGrantRequest { RefreshToken = refreshToken };
            return await PostAsync<GoTrueSession>(AuthBase + "/token?grant_type=refresh_token", body).ConfigureAwait(false);
        }

        /// <summary>POST /recover. Triggers the reset-password email (reset done on web).</summary>
        public async Task RecoverAsync(string email)
        {
            var body = new RecoverRequest { Email = email };
            await PostAsync<object>(AuthBase + "/recover", body).ConfigureAwait(false);
        }

        // ------------------------------------------------------------------
        // Internals
        // ------------------------------------------------------------------

        private static async Task<T> PostAsync<T>(string url, object body)
        {
            using (var req = new HttpRequestMessage(HttpMethod.Post, url))
            {
                req.Headers.TryAddWithoutValidation("apikey", Config.SUPABASE_ANON_KEY);
                // GoTrue also accepts the anon key as Bearer; harmless to set both.
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Config.SUPABASE_ANON_KEY);
                req.Content = new StringContent(Json.Serialize(body), Encoding.UTF8, "application/json");

                HttpResponseMessage resp;
                try
                {
                    resp = await Http.SendAsync(req).ConfigureAwait(false);
                }
                catch (TaskCanceledException)
                {
                    throw new AuthException("Kết nối tới máy chủ quá lâu. Anh/chị kiểm tra lại mạng giúp em.");
                }
                catch (HttpRequestException ex)
                {
                    throw new AuthException("Không kết nối được tới máy chủ. Anh/chị kiểm tra lại mạng giúp em.", ex);
                }

                var text = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);

                if (!resp.IsSuccessStatusCode)
                    throw new AuthException(MapError(resp.StatusCode, text));

                // Some endpoints (recover) return empty/200 — guard before deserializing.
                if (typeof(T) == typeof(object) || string.IsNullOrWhiteSpace(text))
                    return default(T);

                var parsed = Json.TryDeserialize<T>(text);
                if (parsed == null)
                    throw new AuthException("Máy chủ trả về dữ liệu không hợp lệ. Anh/chị thử lại sau giúp em.");
                return parsed;
            }
        }

        /// <summary>Map GoTrue HTTP errors to friendly Vietnamese messages.</summary>
        private static string MapError(HttpStatusCode status, string body)
        {
            var err = Json.TryDeserialize<GoTrueError>(body);
            var code = (err?.ErrorCode ?? err?.Code ?? err?.Error ?? "").ToLowerInvariant();
            var msg = (err?.ErrorDescription ?? err?.Msg ?? err?.Message ?? "").ToLowerInvariant();
            string raw = code + " " + msg;

            // Common GoTrue conditions.
            if (raw.Contains("invalid login") || raw.Contains("invalid_grant") ||
                raw.Contains("invalid credentials") || status == HttpStatusCode.BadRequest && raw.Contains("password"))
                return "Email hoặc mật khẩu không đúng. Anh/chị kiểm tra lại giúp em.";

            if (raw.Contains("email not confirmed") || raw.Contains("email_not_confirmed"))
                return "Email chưa được xác nhận. Anh/chị mở email và bấm link xác nhận trước khi đăng nhập giúp em.";

            if (raw.Contains("user already registered") || raw.Contains("already registered") ||
                raw.Contains("user_already_exists") || status == HttpStatusCode.Conflict)
                return "Email này đã được đăng ký. Anh/chị đăng nhập hoặc dùng chức năng quên mật khẩu giúp em.";

            if (raw.Contains("password should be at least") || raw.Contains("weak_password") ||
                raw.Contains("password is too short"))
                return "Mật khẩu quá ngắn. Anh/chị đặt mật khẩu tối thiểu 6 ký tự giúp em.";

            if (raw.Contains("rate limit") || (int)status == 429)
                return "Anh/chị thao tác hơi nhanh, vui lòng đợi một lát rồi thử lại giúp em.";

            if (raw.Contains("invalid email") || raw.Contains("validation_failed") && raw.Contains("email"))
                return "Email không hợp lệ. Anh/chị nhập lại email giúp em.";

            if (status == HttpStatusCode.Unauthorized)
                return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Anh/chị đăng nhập lại giúp em.";

            if ((int)status >= 500)
                return "Máy chủ đang gặp sự cố. Anh/chị thử lại sau ít phút giúp em.";

            // Fallback: surface server message if present, else a generic one.
            var server = err?.ErrorDescription ?? err?.Msg ?? err?.Message ?? err?.Error;
            return string.IsNullOrWhiteSpace(server)
                ? "Có lỗi xảy ra khi xác thực. Anh/chị thử lại giúp em."
                : server;
        }
    }
}
