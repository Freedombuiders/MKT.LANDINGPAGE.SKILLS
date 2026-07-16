using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Crypto.Signers;
using Org.BouncyCastle.OpenSsl;
using Org.BouncyCastle.Security;

namespace RevitLicense.License
{
    /// <summary>
    /// Verifies entitlement-token signatures with Ed25519 (RFC 8032) using
    /// BouncyCastle. Public keys are SPKI PEM ("-----BEGIN PUBLIC KEY-----"),
    /// selected by the token header's "kid".
    ///
    /// Key sources, tried in order and merged:
    ///   1. Embedded resource RevitLicense.Resources.public-key.pem (optional,
    ///      may contain a leading "kid" line before the PEM block).
    ///   2. Config.PublicKeysPem (inline, kid -> PEM).
    ///
    /// Parsed keys are cached by kid. Verification is offline and ~microseconds.
    /// </summary>
    public static class Ed25519Verifier
    {
        private static readonly object Gate = new object();
        private static Dictionary<string, Ed25519PublicKeyParameters> _keys;

        /// <summary>
        /// Verify the token's Ed25519 signature over its SigningInput using the
        /// public key whose kid matches the token header. Returns false on any
        /// failure (unknown kid, bad alg, malformed key, invalid signature).
        /// Never throws.
        /// </summary>
        public static bool Verify(EntitlementToken token)
        {
            if (token == null || token.SigningInput == null || token.Signature == null)
                return false;

            // Only EdDSA is accepted (defends against alg-confusion).
            if (token.Header == null ||
                !string.Equals(token.Header.Alg, "EdDSA", StringComparison.Ordinal))
                return false;

            // Ed25519 signatures are exactly 64 bytes.
            if (token.Signature.Length != 64)
                return false;

            var key = GetKey(token.Kid);
            if (key == null)
                return false;

            try
            {
                var verifier = new Ed25519Signer();
                verifier.Init(false, key);
                verifier.BlockUpdate(token.SigningInput, 0, token.SigningInput.Length);
                return verifier.VerifySignature(token.Signature);
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>Allow tests / runtime key rotation to add a fetched PEM by kid.</summary>
        public static void RegisterKey(string kid, string pem)
        {
            if (string.IsNullOrEmpty(kid) || string.IsNullOrWhiteSpace(pem)) return;
            var key = ParsePem(pem);
            if (key == null) return;
            lock (Gate)
            {
                EnsureLoaded_NoLock();
                _keys[kid] = key;
            }
        }

        // ------------------------------------------------------------------

        private static Ed25519PublicKeyParameters GetKey(string kid)
        {
            lock (Gate)
            {
                EnsureLoaded_NoLock();
                if (string.IsNullOrEmpty(kid)) return null;
                return _keys.TryGetValue(kid, out var k) ? k : null;
            }
        }

        private static void EnsureLoaded_NoLock()
        {
            if (_keys != null) return;
            _keys = new Dictionary<string, Ed25519PublicKeyParameters>(StringComparer.Ordinal);

            // 1) Embedded resource (optional).
            TryLoadEmbeddedResource(_keys);

            // 2) Inline config keys (do not overwrite an embedded key for same kid).
            foreach (var kv in Config.PublicKeysPem)
            {
                if (_keys.ContainsKey(kv.Key)) continue;
                var parsed = ParsePem(kv.Value);
                if (parsed != null) _keys[kv.Key] = parsed;
            }
        }

        private static void TryLoadEmbeddedResource(Dictionary<string, Ed25519PublicKeyParameters> dict)
        {
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                const string resName = "RevitLicense.Resources.public-key.pem";
                using (Stream s = asm.GetManifestResourceStream(resName))
                {
                    if (s == null) return;
                    using (var reader = new StreamReader(s))
                    {
                        string content = reader.ReadToEnd();
                        // Optional leading "kid" line before the PEM block.
                        string kid = Config.DefaultKid;
                        int beginIdx = content.IndexOf("-----BEGIN", StringComparison.Ordinal);
                        if (beginIdx > 0)
                        {
                            string head = content.Substring(0, beginIdx).Trim();
                            if (!string.IsNullOrEmpty(head)) kid = head.Split('\n', '\r')[0].Trim();
                        }
                        string pem = beginIdx >= 0 ? content.Substring(beginIdx) : content;

                        // Skip the placeholder shipped in source control.
                        if (pem.Contains("TODO_BASE64_SPKI")) return;

                        var parsed = ParsePem(pem);
                        if (parsed != null) dict[kid] = parsed;
                    }
                }
            }
            catch (Exception)
            {
                // Embedded key is optional; ignore failures.
            }
        }

        /// <summary>
        /// Parse an SPKI PEM into Ed25519 public key params. Returns null on any
        /// problem (incl. the placeholder PEM or a non-Ed25519 key).
        /// </summary>
        private static Ed25519PublicKeyParameters ParsePem(string pem)
        {
            if (string.IsNullOrWhiteSpace(pem) || pem.Contains("TODO_BASE64_SPKI"))
                return null;

            try
            {
                using (var sr = new StringReader(pem))
                {
                    var pemReader = new PemReader(sr);
                    object obj = pemReader.ReadObject();

                    // Common case: PemReader returns the parsed key parameter.
                    if (obj is Ed25519PublicKeyParameters ed) return ed;
                    if (obj is AsymmetricKeyParameter akp) return akp as Ed25519PublicKeyParameters;

                    // Fallback: PemReader returned a SubjectPublicKeyInfo (the raw
                    // SPKI structure). Build the key parameter from it.
                    if (obj is Org.BouncyCastle.Asn1.X509.SubjectPublicKeyInfo spki)
                        return PublicKeyFactory.CreateKey(spki) as Ed25519PublicKeyParameters;

                    return null;
                }
            }
            catch (Exception)
            {
                return null;
            }
        }
    }
}
