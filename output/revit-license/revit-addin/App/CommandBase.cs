using System;
using System.Diagnostics;
using System.Reflection;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RevitLicense.License;
using RevitLicense.Telemetry;

namespace RevitLicense.App
{
    /// <summary>
    /// Base class for all licensed commands. Wraps execution with:
    ///   - a Stopwatch for duration,
    ///   - a LicenseClient.CanRun gate (denied -> VN upsell popup + 'denied'
    ///     telemetry + Result.Cancelled),
    ///   - try/catch logging 'success' or 'error' (with stack) to telemetry.
    /// Telemetry is fire-and-forget; it never blocks or fails the command.
    ///
    /// Derived classes implement ExecuteCommand and carry the [Transaction] and
    /// [RequiresProduct] attributes (the latter is optional — the command-id is
    /// the primary key into the product registry).
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public abstract class CommandBase : IExternalCommand
    {
        /// <summary>Stable command id, e.g. "ARC.WallDimension". Used by the
        /// product registry and telemetry.</summary>
        protected abstract string CommandId { get; }

        /// <summary>The real command logic. Throw on failure to log an error.</summary>
        protected abstract Result ExecuteCommand(
            ExternalCommandData commandData, ref string message, ElementSet elements);

        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            string product = LicenseClient.RequiredProduct(CommandId) ?? ResolveProductFromAttribute();
            var sw = Stopwatch.StartNew();

            // ---- License gate ----
            LicenseDecision decision;
            try
            {
                decision = LicenseClient.Instance.CanRun(CommandId);
            }
            catch (Exception ex)
            {
                // Treat unexpected gate failures as a soft deny — never crash.
                sw.Stop();
                LogSafe(product, "denied", (int)sw.ElapsedMilliseconds, ex);
                ShowUpsell("Không kiểm tra được license: " + ex.Message);
                return Result.Cancelled;
            }

            if (!decision.Allowed)
            {
                sw.Stop();
                LogSafe(product, "denied", (int)sw.ElapsedMilliseconds, null);
                ShowUpsell(decision.Reason);
                return Result.Cancelled;
            }

            if (decision.InGrace)
                ShowGraceBanner(decision.GraceDaysLeft);

            // ---- Real logic ----
            try
            {
                Result result = ExecuteCommand(commandData, ref message, elements);
                sw.Stop();
                LogSafe(product, "success", (int)sw.ElapsedMilliseconds, null);
                return result;
            }
            catch (Exception ex)
            {
                sw.Stop();
                LogSafe(product, "error", (int)sw.ElapsedMilliseconds, ex);
                message = "Lỗi khi chạy lệnh: " + ex.Message;
                return Result.Failed;
            }
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private string ResolveProductFromAttribute()
        {
            var attr = GetType().GetCustomAttribute<RequiresProductAttribute>(inherit: true);
            return attr?.Product;
        }

        private void LogSafe(string product, string status, int durationMs, Exception ex)
        {
            try
            {
                var ev = UsageEvent.Create(
                    CommandId, product, status, durationMs,
                    Application.SessionId, Application.RevitVersion, ex);
                EventQueue.Instance.Enqueue(ev);
            }
            catch
            {
                // Telemetry must NEVER affect command behaviour.
            }
        }

        private static void ShowUpsell(string reason)
        {
            var td = new TaskDialog("Cần kích hoạt license")
            {
                MainInstruction = "Tính năng này chưa sẵn sàng",
                MainContent = (reason ?? "Bộ môn chưa được kích hoạt.") +
                    "\n\nAnh/chị có thể mua hoặc gia hạn để mở khoá ngay.",
                CommonButtons = TaskDialogCommonButtons.Close,
                FooterText = "<a href=\"" + Config.BuyPageUrl + "\">Mua / gia hạn license tại đây</a>"
            };
            td.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Mở trang mua / gia hạn");

            TaskDialogResult res = td.Show();
            if (res == TaskDialogResult.CommandLink1)
                OpenBuyPage();
        }

        private static void ShowGraceBanner(int daysLeft)
        {
            TaskDialog.Show("Chế độ offline",
                $"Anh/chị đang dùng license ở chế độ offline. Còn {Math.Max(0, daysLeft)} ngày trước khi cần kết nối mạng để xác thực lại.");
        }

        private static void OpenBuyPage()
        {
            try { Process.Start(new ProcessStartInfo(Config.BuyPageUrl) { UseShellExecute = true }); }
            catch { /* user can copy the URL from the footer link */ }
        }
    }
}
