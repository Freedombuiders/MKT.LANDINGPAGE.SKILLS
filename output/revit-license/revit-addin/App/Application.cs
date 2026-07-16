using System;
using System.Reflection;
using System.Threading.Tasks;
using Autodesk.Revit.UI;
using RevitLicense.Auth;
using RevitLicense.Auth.Models;
using RevitLicense.License;
using RevitLicense.Telemetry;
using RevitLicense.UI;

namespace RevitLicense.App
{
    /// <summary>
    /// Revit entry point. On startup:
    ///   1. Generate a per-session id (one GUID per Revit launch) for telemetry.
    ///   2. Try silent login via the persisted refresh_token; if that fails,
    ///      show the WPF LoginWindow.
    ///   3. On a valid access_token, prime the LicenseClient (best-effort
    ///      /activate runs lazily on the first CanRun).
    ///   4. Build a ribbon panel with the sample commands.
    /// Nothing here blocks Revit beyond the short, bounded auth calls.
    /// </summary>
    public class Application : IExternalApplication
    {
        // Shared across all commands this session.
        public static string SessionId { get; private set; }
        public static string RevitVersion { get; private set; }

        private static readonly SupabaseAuthClient Auth = new SupabaseAuthClient();

        public Result OnStartup(UIControlledApplication app)
        {
            SessionId = Guid.NewGuid().ToString("N");
            try { RevitVersion = app.ControlledApplication.VersionNumber; } catch { RevitVersion = "unknown"; }

            try
            {
                BuildRibbon(app);
            }
            catch (Exception ex)
            {
                TaskDialog.Show("RevitLicense",
                    "Không tạo được thanh công cụ add-in: " + ex.Message);
            }

            // Auth must run on the UI thread context (WPF dialog). Revit calls
            // OnStartup on the main thread, so this is safe.
            try
            {
                EnsureLoggedIn();
            }
            catch (Exception ex)
            {
                // Never block Revit from loading because of auth issues — the
                // user can still launch and will be gated at command time.
                TaskDialog.Show("RevitLicense",
                    "Đăng nhập license chưa hoàn tất: " + ex.Message +
                    "\nAnh/chị có thể đăng nhập lại khi chạy lệnh đầu tiên.");
            }

            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication app)
        {
            try { EventQueue.Instance.Dispose(); } catch { }
            return Result.Succeeded;
        }

        // ------------------------------------------------------------------
        // Auth bootstrap
        // ------------------------------------------------------------------

        /// <summary>
        /// Silent refresh from stored refresh_token; if missing/invalid, open the
        /// login dialog. On success the LicenseClient receives the access_token.
        /// </summary>
        private static void EnsureLoggedIn()
        {
            var stored = TokenStore.Load();
            if (stored != null && !string.IsNullOrEmpty(stored.RefreshToken))
            {
                try
                {
                    var session = RunSync(Auth.RefreshAsync(stored.RefreshToken));
                    if (session != null && !string.IsNullOrEmpty(session.AccessToken))
                    {
                        ApplySession(session);
                        return;
                    }
                }
                catch (AuthException)
                {
                    // Stored token no longer valid — fall through to login.
                    TokenStore.Clear();
                }
            }

            ShowLogin();
        }

        /// <summary>Open the WPF login dialog and apply the resulting session.</summary>
        public static void ShowLogin()
        {
            var window = new LoginWindow(Auth);
            bool? ok = window.ShowDialog();
            if (ok == true && window.Session != null)
                ApplySession(window.Session);
        }

        private static void ApplySession(GoTrueSession session)
        {
            // access_token -> RAM only (LicenseClient).
            LicenseClient.Instance.SetAccessToken(session.AccessToken);

            // Persist only the refresh_token (DPAPI).
            if (!string.IsNullOrEmpty(session.RefreshToken))
            {
                TokenStore.Save(new StoredAuth
                {
                    RefreshToken = session.RefreshToken,
                    UserId = session.User?.Id,
                    Email = session.User?.Email
                });
            }

            // Best-effort eager activation so the first command is instant.
            Task.Run(async () =>
            {
                try { await LicenseClient.Instance.ActivateAsync().ConfigureAwait(false); }
                catch { /* lazy /activate on first CanRun will retry */ }
            });
        }

        /// <summary>Run an async auth call synchronously on the startup thread.</summary>
        private static T RunSync<T>(Task<T> task) => task.GetAwaiter().GetResult();

        // ------------------------------------------------------------------
        // Ribbon
        // ------------------------------------------------------------------

        private static void BuildRibbon(UIControlledApplication app)
        {
            const string tabName = "License Demo";
            try { app.CreateRibbonTab(tabName); }
            catch (Autodesk.Revit.Exceptions.ArgumentException) { /* tab already exists */ }

            RibbonPanel panel = app.CreateRibbonPanel(tabName, "Bộ công cụ");
            string assemblyPath = Assembly.GetExecutingAssembly().Location;

            AddButton(panel, assemblyPath,
                "ARC.WallDimension",
                "Ghi kích thước\ntường (ARC)",
                "RevitLicense.Commands.WallDimensionCommand",
                "Tự động ghi kích thước tường — yêu cầu bộ môn Kiến trúc (ARC).");

            AddButton(panel, assemblyPath,
                "STR.ColumnRebar",
                "Bố trí thép\ncột (STR)",
                "RevitLicense.Commands.ColumnRebarCommand",
                "Bố trí thép cột — yêu cầu bộ môn Kết cấu (STR).");
        }

        private static void AddButton(RibbonPanel panel, string assemblyPath,
            string name, string text, string className, string tooltip)
        {
            var data = new PushButtonData(name, text, assemblyPath, className)
            {
                ToolTip = tooltip
            };
            panel.AddItem(data);
        }
    }
}
