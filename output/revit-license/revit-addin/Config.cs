using System.Collections.Generic;

namespace RevitLicense
{
    /// <summary>
    /// Build-time configuration constants. Fill in the TODO placeholders before
    /// shipping. Everything here is public/non-secret: the add-in never holds a
    /// signing private key — only the Ed25519 PUBLIC key used to verify tokens,
    /// plus the Supabase anon key (publishable, RLS-guarded).
    /// </summary>
    public static class Config
    {
        // ------------------------------------------------------------------
        // Business API (Next.js / Edge Functions). HTTPS only.
        // TODO(Windows dev): set to your deployed API origin (no trailing slash).
        // ------------------------------------------------------------------
        public const string API_BASE = "https://your-api.example.com";

        // ------------------------------------------------------------------
        // Supabase Auth (GoTrue). SUPABASE_URL has NO trailing slash; the
        // /auth/v1 segment is appended by SupabaseAuthClient.
        // TODO(Windows dev): fill from your Supabase project settings.
        // ------------------------------------------------------------------
        public const string SUPABASE_URL = "https://your-project.supabase.co";
        public const string SUPABASE_ANON_KEY = "TODO_SUPABASE_ANON_KEY";

        // ------------------------------------------------------------------
        // Add-in version (sent in telemetry as app_version).
        // ------------------------------------------------------------------
        public const string AppVersion = "1.0.0";

        // Folder name under %APPDATA% for all persisted files.
        public const string AppDataFolderName = "RevitLicense";

        // HTTP timeout for all network calls (seconds).
        public const int HttpTimeoutSeconds = 5;

        // ------------------------------------------------------------------
        // Buy / renew page shown in the upsell popup when a discipline is not
        // entitled. TODO(Windows dev): your sales page URL.
        // ------------------------------------------------------------------
        public const string BuyPageUrl = "https://your-buy-page.example.com";

        // ------------------------------------------------------------------
        // Embedded Ed25519 public key(s) for offline signature verification.
        //
        // The token header carries a "kid"; we select the matching key here.
        // Keep multiple entries to support key rotation (old + new). The PEM is
        // an SPKI ("-----BEGIN PUBLIC KEY-----") Ed25519 public key.
        //
        // Source of truth: GET {API_BASE}/api/public-key -> { kid, public_key_pem }
        // (or generate locally with your `npm run gen-keys` script). Paste the
        // PEM below, OR ship it as the embedded resource Resources/public-key.pem
        // (Ed25519Verifier loads the resource first, then falls back to these).
        //
        // TODO(Windows dev): replace the placeholder PEM with the real key.
        // ------------------------------------------------------------------
        public const string DefaultKid = "k1";

        public static readonly IReadOnlyDictionary<string, string> PublicKeysPem =
            new Dictionary<string, string>
            {
                ["k1"] =
                    "-----BEGIN PUBLIC KEY-----\n" +
                    "TODO_BASE64_SPKI_ED25519_PUBLIC_KEY_FOR_KID_k1\n" +
                    "-----END PUBLIC KEY-----\n",
                // ["k2"] = "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n",
            };
    }
}
