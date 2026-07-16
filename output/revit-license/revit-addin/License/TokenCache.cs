using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace RevitLicense.License
{
    /// <summary>
    /// DPAPI-encrypted store for the raw compact entitlement token at
    /// %APPDATA%/RevitLicense/entitlement.dat (CurrentUser scope).
    ///
    /// We persist the compact JWT string verbatim; on load we re-parse AND the
    /// caller must re-verify the signature (a tampered/foreign blob will either
    /// fail to decrypt or fail signature verification).
    /// </summary>
    public static class TokenCache
    {
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("RevitLicense.entitlement.v1");

        private static string FilePath
        {
            get
            {
                var dir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    Config.AppDataFolderName);
                Directory.CreateDirectory(dir);
                return Path.Combine(dir, "entitlement.dat");
            }
        }

        public static void Save(string compactToken)
        {
            if (string.IsNullOrEmpty(compactToken)) return;
            byte[] plain = Encoding.UTF8.GetBytes(compactToken);
            byte[] cipher = ProtectedData.Protect(plain, Entropy, DataProtectionScope.CurrentUser);
            File.WriteAllBytes(FilePath, cipher);
        }

        /// <summary>Raw compact token string, or null if absent/corrupt.</summary>
        public static string LoadRaw()
        {
            try
            {
                if (!File.Exists(FilePath)) return null;
                byte[] cipher = File.ReadAllBytes(FilePath);
                if (cipher.Length == 0) return null;
                byte[] plain = ProtectedData.Unprotect(cipher, Entropy, DataProtectionScope.CurrentUser);
                string s = Encoding.UTF8.GetString(plain);
                return string.IsNullOrWhiteSpace(s) ? null : s;
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>Load + parse the cached token, or null if absent/unparseable.</summary>
        public static EntitlementToken Load()
        {
            string raw = LoadRaw();
            if (raw == null) return null;
            try { return EntitlementToken.Parse(raw); }
            catch (Exception) { return null; }
        }

        public static void Clear()
        {
            try { if (File.Exists(FilePath)) File.Delete(FilePath); }
            catch { /* best effort */ }
        }
    }
}
