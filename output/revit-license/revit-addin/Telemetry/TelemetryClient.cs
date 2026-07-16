using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using RevitLicense.Auth.Models;
using RevitLicense.License;

namespace RevitLicense.Telemetry
{
    /// <summary>
    /// Posts batches of usage events to {API_BASE}/api/telemetry with the
    /// Supabase access_token as Bearer. Fire-and-forget by design: returns
    /// true on a 2xx (queue may clear), false otherwise (queue keeps events for
    /// retry). Never throws — the queue depends on a clean boolean.
    /// </summary>
    public sealed class TelemetryClient
    {
        private static readonly HttpClient Http = CreateClient();
        private const int MaxEventsPerRequest = 200; // server limit per /api/telemetry

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

        /// <summary>
        /// Send a batch. Splits into ≤200-event chunks. Returns true only if
        /// ALL chunks were accepted (so the queue can safely clear them).
        /// </summary>
        public async Task<bool> SendAsync(UsageEvent[] events)
        {
            if (events == null || events.Length == 0) return true;

            // No access_token (not logged in) or no network -> defer.
            string accessToken = LicenseClient.Instance.HasAccessToken
                ? GetAccessTokenSafe()
                : null;
            if (string.IsNullOrEmpty(accessToken)) return false;
            if (!LicenseClient.IsNetworkAvailable()) return false;

            for (int i = 0; i < events.Length; i += MaxEventsPerRequest)
            {
                int count = Math.Min(MaxEventsPerRequest, events.Length - i);
                var chunk = new UsageEvent[count];
                Array.Copy(events, i, chunk, 0, count);

                bool ok = await SendChunkAsync(chunk, accessToken).ConfigureAwait(false);
                if (!ok) return false; // keep the whole batch for retry
            }
            return true;
        }

        private async Task<bool> SendChunkAsync(UsageEvent[] chunk, string accessToken)
        {
            var batch = new TelemetryBatch { Events = chunk };
            string url = Config.API_BASE.TrimEnd('/') + "/api/telemetry";

            try
            {
                using (var req = new HttpRequestMessage(HttpMethod.Post, url))
                {
                    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                    req.Content = new StringContent(Json.Serialize(batch), Encoding.UTF8, "application/json");

                    using (var resp = await Http.SendAsync(req).ConfigureAwait(false))
                    {
                        // 2xx -> accepted. Anything else -> retry later.
                        return resp.IsSuccessStatusCode;
                    }
                }
            }
            catch (Exception)
            {
                // Network/timeout/etc. -> keep for retry.
                return false;
            }
        }

        // LicenseClient keeps the access_token private; expose a tiny safe getter
        // by piggy-backing on its public surface. We re-read via a helper that
        // simply asks the singleton whether it currently has a token and uses a
        // header-only flow. To avoid leaking the token API, LicenseClient exposes
        // SetAccessToken; for telemetry we read it through a dedicated accessor.
        private static string GetAccessTokenSafe()
        {
            return LicenseClient.Instance.TelemetryAccessToken;
        }
    }
}
