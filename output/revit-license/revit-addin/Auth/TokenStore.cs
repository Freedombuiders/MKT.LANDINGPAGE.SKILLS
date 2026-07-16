using System;
using System.IO;
using System.Runtime.Serialization;
using System.Security.Cryptography;
using System.Text;
using RevitLicense.Auth.Models;

namespace RevitLicense.Auth
{
    /// <summary>Persisted auth record: only the refresh_token is secret.</summary>
    [DataContract]
    public class StoredAuth
    {
        [DataMember(Name = "refresh_token")]
        public string RefreshToken { get; set; }

        [DataMember(Name = "user_id")]
        public string UserId { get; set; }

        [DataMember(Name = "email")]
        public string Email { get; set; }
    }

    /// <summary>
    /// Stores { refresh_token, user_id, email } encrypted with DPAPI
    /// (CurrentUser scope) at %APPDATA%/RevitLicense/auth.dat.
    ///
    /// The file is bound to the current Windows user — copying it to another
    /// machine/user cannot be decrypted. access_token is NEVER persisted.
    /// </summary>
    public static class TokenStore
    {
        // Extra entropy mixed into DPAPI so the blob is specific to this app.
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("RevitLicense.auth.v1");

        private static string FilePath
        {
            get
            {
                var dir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    Config.AppDataFolderName);
                Directory.CreateDirectory(dir);
                return Path.Combine(dir, "auth.dat");
            }
        }

        public static void Save(StoredAuth auth)
        {
            if (auth == null || string.IsNullOrEmpty(auth.RefreshToken))
                throw new ArgumentException("StoredAuth requires a refresh_token.");

            byte[] plain = Encoding.UTF8.GetBytes(Json.Serialize(auth));
            byte[] cipher = ProtectedData.Protect(plain, Entropy, DataProtectionScope.CurrentUser);
            File.WriteAllBytes(FilePath, cipher);
        }

        /// <summary>Returns the stored auth, or null if absent/corrupt/undecryptable.</summary>
        public static StoredAuth Load()
        {
            try
            {
                if (!File.Exists(FilePath)) return null;
                byte[] cipher = File.ReadAllBytes(FilePath);
                if (cipher.Length == 0) return null;
                byte[] plain = ProtectedData.Unprotect(cipher, Entropy, DataProtectionScope.CurrentUser);
                var auth = Json.TryDeserialize<StoredAuth>(Encoding.UTF8.GetString(plain));
                return (auth != null && !string.IsNullOrEmpty(auth.RefreshToken)) ? auth : null;
            }
            catch (Exception)
            {
                // Corrupt/foreign blob -> treat as logged out.
                return null;
            }
        }

        public static void Clear()
        {
            try { if (File.Exists(FilePath)) File.Delete(FilePath); }
            catch { /* best effort */ }
        }
    }
}
