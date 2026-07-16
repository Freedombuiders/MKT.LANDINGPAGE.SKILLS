using System;
using System.Runtime.Serialization;

namespace RevitLicense.Telemetry
{
    /// <summary>
    /// One command execution record. Serialized to JSON for the batch
    /// /api/telemetry endpoint and for the on-disk JSONL backup queue.
    ///
    /// Note: user_id is intentionally NOT sent — the server derives it from the
    /// Bearer access_token and ignores any client-supplied value (anti-spoof).
    /// </summary>
    [DataContract]
    public class UsageEvent
    {
        /// <summary>Client-generated id for optional server-side dedupe.</summary>
        [DataMember(Name = "event_id", EmitDefaultValue = false)]
        public string EventId { get; set; }

        [DataMember(Name = "device_id", EmitDefaultValue = false)]
        public string DeviceId { get; set; }

        [DataMember(Name = "session_id", EmitDefaultValue = false)]
        public string SessionId { get; set; }

        [DataMember(Name = "command_id", EmitDefaultValue = false)]
        public string CommandId { get; set; }

        [DataMember(Name = "product_code", EmitDefaultValue = false)]
        public string ProductCode { get; set; }

        /// <summary>'success' | 'error' | 'denied'</summary>
        [DataMember(Name = "status", EmitDefaultValue = false)]
        public string Status { get; set; }

        [DataMember(Name = "duration_ms", EmitDefaultValue = false)]
        public int DurationMs { get; set; }

        [DataMember(Name = "revit_version", EmitDefaultValue = false)]
        public string RevitVersion { get; set; }

        [DataMember(Name = "app_version", EmitDefaultValue = false)]
        public string AppVersion { get; set; }

        [DataMember(Name = "error_code", EmitDefaultValue = false)]
        public string ErrorCode { get; set; }

        [DataMember(Name = "error_message", EmitDefaultValue = false)]
        public string ErrorMessage { get; set; }

        /// <summary>Only populated for status='error'. Truncated to ≤8KB by the server.</summary>
        [DataMember(Name = "stack_trace", EmitDefaultValue = false)]
        public string StackTrace { get; set; }

        /// <summary>ISO-8601 UTC timestamp of when the command started.</summary>
        [DataMember(Name = "started_at", EmitDefaultValue = false)]
        public string StartedAt { get; set; }

        public static UsageEvent Create(
            string commandId, string productCode, string status,
            int durationMs, string sessionId, string revitVersion,
            Exception ex = null)
        {
            var e = new UsageEvent
            {
                EventId = Guid.NewGuid().ToString("N"),
                DeviceId = License.DeviceId.Get(),
                SessionId = sessionId,
                CommandId = commandId,
                ProductCode = productCode,
                Status = status,
                DurationMs = durationMs,
                RevitVersion = revitVersion,
                AppVersion = Config.AppVersion,
                StartedAt = DateTimeOffset.UtcNow.AddMilliseconds(-durationMs)
                                .ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            };

            if (status == "error" && ex != null)
            {
                e.ErrorCode = ex.GetType().Name;
                e.ErrorMessage = Truncate(ex.Message, 1024);
                // Server caps at 8KB; we trim client-side too to keep payloads small.
                e.StackTrace = Truncate(ex.ToString(), 8 * 1024);
            }
            return e;
        }

        private static string Truncate(string s, int max)
        {
            if (string.IsNullOrEmpty(s)) return s;
            return s.Length <= max ? s : s.Substring(0, max);
        }
    }

    /// <summary>Batch wrapper: { "events": [ ... ] }.</summary>
    [DataContract]
    public class TelemetryBatch
    {
        [DataMember(Name = "events")]
        public UsageEvent[] Events { get; set; }
    }
}
