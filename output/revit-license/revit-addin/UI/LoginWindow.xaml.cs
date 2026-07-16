using System;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using RevitLicense.Auth;
using RevitLicense.Auth.Models;

namespace RevitLicense.UI
{
    /// <summary>
    /// WPF login dialog with three tabs: Đăng nhập / Đăng ký / Quên mật khẩu.
    /// Talks to SupabaseAuthClient. On a successful sign-in the resulting
    /// <see cref="Session"/> is exposed and DialogResult is set true.
    ///
    /// access_token / refresh_token handling is the caller's responsibility
    /// (App.Application persists only the refresh_token via DPAPI).
    /// </summary>
    public partial class LoginWindow : Window
    {
        // Shared with the form fields (CLAUDE/system rule): VN-market phone format.
        private static readonly Regex PhoneRegex = new Regex(@"^(0|\+84)[0-9]{9}$", RegexOptions.Compiled);
        private static readonly Regex EmailRegex =
            new Regex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

        private readonly SupabaseAuthClient _auth;

        /// <summary>Set when sign-in (or silent refresh) succeeds.</summary>
        public GoTrueSession Session { get; private set; }

        public LoginWindow(SupabaseAuthClient auth)
        {
            _auth = auth ?? throw new ArgumentNullException(nameof(auth));
            InitializeComponent();
        }

        // ------------------------------------------------------------------
        // Đăng nhập
        // ------------------------------------------------------------------
        private async void OnLoginClick(object sender, RoutedEventArgs e)
        {
            string email = (LoginEmail.Text ?? "").Trim();
            string password = LoginPassword.Password ?? "";

            if (!IsValidEmail(email)) { ShowError("Email không hợp lệ. Anh/chị nhập lại giúp em."); return; }
            if (string.IsNullOrEmpty(password)) { ShowError("Anh/chị nhập mật khẩu giúp em."); return; }

            await RunBusy(async () =>
            {
                var session = await _auth.SignInAsync(email, password).ConfigureAwait(true);
                if (session == null || string.IsNullOrEmpty(session.AccessToken))
                {
                    ShowError("Đăng nhập thất bại. Anh/chị thử lại giúp em.");
                    return;
                }
                Session = session;
                DialogResult = true;
                Close();
            });
        }

        // ------------------------------------------------------------------
        // Đăng ký
        // ------------------------------------------------------------------
        private async void OnRegisterClick(object sender, RoutedEventArgs e)
        {
            string fullName = (RegFullName.Text ?? "").Trim();
            string phone = (RegPhone.Text ?? "").Trim();
            string email = (RegEmail.Text ?? "").Trim();
            string password = RegPassword.Password ?? "";

            if (string.IsNullOrEmpty(fullName)) { ShowError("Anh/chị nhập họ tên giúp em."); return; }
            if (!PhoneRegex.IsMatch(phone)) { ShowError("Số điện thoại không hợp lệ (VD: 0901234567 hoặc +84901234567)."); return; }
            if (!IsValidEmail(email)) { ShowError("Email không hợp lệ. Anh/chị nhập lại giúp em."); return; }
            if (password.Length < 6) { ShowError("Mật khẩu cần tối thiểu 6 ký tự."); return; }

            await RunBusy(async () =>
            {
                await _auth.SignUpAsync(email, password, fullName, phone).ConfigureAwait(true);
                ShowInfo("Đăng ký thành công. Anh/chị mở email và bấm link xác nhận, sau đó quay lại tab Đăng nhập giúp em.");
                Tabs.SelectedIndex = 0; // jump to sign-in tab
                LoginEmail.Text = email;
            });
        }

        // ------------------------------------------------------------------
        // Quên mật khẩu
        // ------------------------------------------------------------------
        private async void OnRecoverClick(object sender, RoutedEventArgs e)
        {
            string email = (RecoverEmail.Text ?? "").Trim();
            if (!IsValidEmail(email)) { ShowError("Email không hợp lệ. Anh/chị nhập lại giúp em."); return; }

            await RunBusy(async () =>
            {
                await _auth.RecoverAsync(email).ConfigureAwait(true);
                ShowInfo("Đã gửi link đặt lại mật khẩu qua email. Anh/chị đặt lại mật khẩu trên trang web rồi quay lại đăng nhập giúp em.");
            });
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private static bool IsValidEmail(string email) =>
            !string.IsNullOrEmpty(email) && EmailRegex.IsMatch(email);

        /// <summary>Run an async action with the busy bar + uniform error handling.</summary>
        private async Task RunBusy(Func<Task> action)
        {
            SetBusy(true);
            ClearStatus();
            try
            {
                await action().ConfigureAwait(true);
            }
            catch (AuthException ex)
            {
                ShowError(ex.Message);
            }
            catch (Exception ex)
            {
                ShowError("Có lỗi xảy ra: " + ex.Message);
            }
            finally
            {
                SetBusy(false);
            }
        }

        private void SetBusy(bool busy)
        {
            Busy.Visibility = busy ? Visibility.Visible : Visibility.Collapsed;
            LoginButton.IsEnabled = !busy;
            RegisterButton.IsEnabled = !busy;
            RecoverButton.IsEnabled = !busy;
        }

        private void ClearStatus()
        {
            StatusText.Text = "";
        }

        private void ShowError(string msg)
        {
            StatusText.Foreground = System.Windows.Media.Brushes.Firebrick;
            StatusText.Text = msg;
        }

        private void ShowInfo(string msg)
        {
            StatusText.Foreground = System.Windows.Media.Brushes.SeaGreen;
            StatusText.Text = msg;
        }
    }
}
