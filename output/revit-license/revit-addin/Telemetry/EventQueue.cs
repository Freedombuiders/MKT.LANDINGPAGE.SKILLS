using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using RevitLicense.Auth.Models;

namespace RevitLicense.Telemetry
{
    /// <summary>
    /// In-memory queue with a JSONL backup at
    /// %APPDATA%/RevitLicense/telemetry-queue.jsonl. Flushes when it reaches
    /// FlushThreshold events OR every FlushIntervalSeconds. Flushing delegates
    /// the network send to TelemetryClient; on failure the events are kept
    /// (offline-safe) for the next attempt.
    ///
    /// All public methods are non-blocking from the caller's perspective: the
    /// actual HTTP send runs on a background Task inside TelemetryClient.
    /// </summary>
    public sealed class EventQueue : IDisposable
    {
        public const int FlushThreshold = 20;
        public const int FlushIntervalSeconds = 30;
        private const int MaxBufferedEvents = 5000; // hard cap to avoid unbounded growth

        private static readonly Lazy<EventQueue> _instance =
            new Lazy<EventQueue>(() => new EventQueue(), LazyThreadSafetyMode.ExecutionAndPublication);
        public static EventQueue Instance => _instance.Value;

        private readonly object _gate = new object();
        private readonly List<UsageEvent> _buffer = new List<UsageEvent>();
        private readonly Timer _timer;
        private readonly TelemetryClient _client = new TelemetryClient();
        private int _flushing; // 0/1 via Interlocked
        private bool _disposed;

        private static string BackupPath
        {
            get
            {
                var dir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    Config.AppDataFolderName);
                Directory.CreateDirectory(dir);
                return Path.Combine(dir, "telemetry-queue.jsonl");
            }
        }

        private EventQueue()
        {
            // Recover any events left on disk from a previous session.
            LoadBackup();

            _timer = new Timer(_ => FlushFireAndForget(),
                null,
                TimeSpan.FromSeconds(FlushIntervalSeconds),
                TimeSpan.FromSeconds(FlushIntervalSeconds));
        }

        /// <summary>Enqueue an event. Triggers a flush if the threshold is hit.</summary>
        public void Enqueue(UsageEvent e)
        {
            if (e == null || _disposed) return;

            bool shouldFlush;
            lock (_gate)
            {
                _buffer.Add(e);
                AppendBackupLine(e);
                if (_buffer.Count > MaxBufferedEvents)
                    _buffer.RemoveRange(0, _buffer.Count - MaxBufferedEvents);
                shouldFlush = _buffer.Count >= FlushThreshold;
            }

            if (shouldFlush) FlushFireAndForget();
        }

        /// <summary>Kick a background flush; never blocks the caller.</summary>
        public void FlushFireAndForget()
        {
            if (_disposed) return;
            if (Interlocked.CompareExchange(ref _flushing, 1, 0) != 0) return;

            Task.Run(async () =>
            {
                try { await FlushAsync().ConfigureAwait(false); }
                catch { /* swallow — telemetry must never crash Revit */ }
                finally { Interlocked.Exchange(ref _flushing, 0); }
            });
        }

        private async Task FlushAsync()
        {
            UsageEvent[] batch;
            lock (_gate)
            {
                if (_buffer.Count == 0) return;
                batch = _buffer.ToArray();
            }

            bool ok = await _client.SendAsync(batch).ConfigureAwait(false);
            if (!ok) return; // keep buffer + backup for retry next time

            // Remove exactly the sent events (by event_id) — new ones may have
            // arrived during the await.
            lock (_gate)
            {
                var sentIds = new HashSet<string>(batch.Select(b => b.EventId));
                _buffer.RemoveAll(b => sentIds.Contains(b.EventId));
                RewriteBackup();
            }
        }

        // ------------------------------------------------------------------
        // Disk backup (JSONL: one JSON object per line)
        // ------------------------------------------------------------------

        private void AppendBackupLine(UsageEvent e)
        {
            try
            {
                string line = Json.Serialize(e).Replace("\r", "").Replace("\n", "");
                File.AppendAllText(BackupPath, line + Environment.NewLine, Encoding.UTF8);
            }
            catch { /* best effort */ }
        }

        private void RewriteBackup()
        {
            try
            {
                if (_buffer.Count == 0)
                {
                    if (File.Exists(BackupPath)) File.Delete(BackupPath);
                    return;
                }
                var sb = new StringBuilder();
                foreach (var e in _buffer)
                    sb.AppendLine(Json.Serialize(e).Replace("\r", "").Replace("\n", ""));
                File.WriteAllText(BackupPath, sb.ToString(), Encoding.UTF8);
            }
            catch { /* best effort */ }
        }

        private void LoadBackup()
        {
            try
            {
                if (!File.Exists(BackupPath)) return;
                foreach (var line in File.ReadAllLines(BackupPath, Encoding.UTF8))
                {
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    var e = Json.TryDeserialize<UsageEvent>(line);
                    if (e != null) _buffer.Add(e);
                }
                if (_buffer.Count > MaxBufferedEvents)
                    _buffer.RemoveRange(0, _buffer.Count - MaxBufferedEvents);
            }
            catch { /* corrupt backup — ignore */ }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            try { _timer?.Dispose(); } catch { }
            // Final best-effort flush on shutdown.
            try { FlushAsync().GetAwaiter().GetResult(); } catch { }
        }
    }
}
