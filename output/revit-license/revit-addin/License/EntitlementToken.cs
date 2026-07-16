using System;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using RevitLicense.Auth.Models;

namespace RevitLicense.License
{
    /// <summary>JWT header: {"alg":"EdDSA","kid":"k1"}.</summary>
    [DataContract]
    public class TokenHeader
    {
        [DataMember(Name = "alg", EmitDefaultValue = false)]
        public string Alg { get; set; }

        [DataMember(Name = "kid", EmitDefaultValue = false)]
        public string Kid { get; set; }
    }

    /// <summary>
    /// JWT payload per the entitlement contract:
    /// {sub, device, disciplines:[string], plan, iat, exp, grace_until, jti}.
    /// Times are Unix seconds (UTC).
    /// </summary>
    [DataContract]
    public class TokenPayload
    {
        [DataMember(Name = "sub", EmitDefaultValue = false)]
        public string Sub { get; set; }

        [DataMember(Name = "device", EmitDefaultValue = false)]
        public string Device { get; set; }

        [DataMember(Name = "disciplines", EmitDefaultValue = false)]
        public string[] Disciplines { get; set; }

        [DataMember(Name = "plan", EmitDefaultValue = false)]
        public string Plan { get; set; }

        [DataMember(Name = "iat", EmitDefaultValue = false)]
        public long Iat { get; set; }

        [DataMember(Name = "exp", EmitDefaultValue = false)]
        public long Exp { get; set; }

        [DataMember(Name = "grace_until", EmitDefaultValue = false)]
        public long GraceUntil { get; set; }

        [DataMember(Name = "jti", EmitDefaultValue = false)]
        public string Jti { get; set; }
    }

    /// <summary>
    /// Parsed compact JWT. Holds the decoded header/payload PLUS the exact bytes
    /// needed for signature verification:
    ///   SigningInput = ASCII( b64url(header) + "." + b64url(payload) )
    ///   Signature    = base64url-decoded third segment.
    /// </summary>
    public sealed class EntitlementToken
    {
        public string RawCompact { get; private set; }
        public TokenHeader Header { get; private set; }
        public TokenPayload Payload { get; private set; }

        /// <summary>ASCII bytes of "b64url(header).b64url(payload)" — what Ed25519 signs.</summary>
        public byte[] SigningInput { get; private set; }

        /// <summary>Raw signature bytes (64 for Ed25519).</summary>
        public byte[] Signature { get; private set; }

        public string Kid => Header?.Kid;

        // Convenience accessors.
        public string[] Disciplines => Payload?.Disciplines ?? Array.Empty<string>();
        public DateTimeOffset ExpUtc => DateTimeOffset.FromUnixTimeSeconds(Payload?.Exp ?? 0);
        public DateTimeOffset GraceUntilUtc => DateTimeOffset.FromUnixTimeSeconds(Payload?.GraceUntil ?? 0);

        public bool HasDiscipline(string product) =>
            !string.IsNullOrEmpty(product) &&
            Disciplines.Any(d => string.Equals(d, product, StringComparison.OrdinalIgnoreCase));

        public bool IsExpired(DateTimeOffset now) => now >= ExpUtc;
        public bool WithinGrace(DateTimeOffset now) => now < GraceUntilUtc;

        private EntitlementToken() { }

        /// <summary>
        /// Parse a compact JWT "b64url(header).b64url(payload).b64url(sig)".
        /// Throws FormatException on structural problems. Does NOT verify the
        /// signature — that is Ed25519Verifier's job.
        /// </summary>
        public static EntitlementToken Parse(string compact)
        {
            if (string.IsNullOrWhiteSpace(compact))
                throw new FormatException("Token rỗng.");

            string[] parts = compact.Split('.');
            if (parts.Length != 3)
                throw new FormatException("Token không đúng định dạng JWT (cần 3 phần).");

            string headerB64 = parts[0];
            string payloadB64 = parts[1];
            string sigB64 = parts[2];

            var header = Json.TryDeserialize<TokenHeader>(
                Encoding.UTF8.GetString(Base64Url.Decode(headerB64)));
            if (header == null)
                throw new FormatException("Header token không hợp lệ.");

            var payload = Json.TryDeserialize<TokenPayload>(
                Encoding.UTF8.GetString(Base64Url.Decode(payloadB64)));
            if (payload == null)
                throw new FormatException("Payload token không hợp lệ.");

            // Signing input is the ASCII of the first two segments joined by '.'.
            byte[] signingInput = Encoding.ASCII.GetBytes(headerB64 + "." + payloadB64);
            byte[] signature = Base64Url.Decode(sigB64);

            return new EntitlementToken
            {
                RawCompact = compact,
                Header = header,
                Payload = payload,
                SigningInput = signingInput,
                Signature = signature
            };
        }
    }

    /// <summary>
    /// base64url codec: standard base64 with '+'->'-', '/'->'_', padding ('=')
    /// stripped. Decode re-adds padding before delegating to Convert.
    /// </summary>
    public static class Base64Url
    {
        public static string Encode(byte[] bytes)
        {
            if (bytes == null) return string.Empty;
            return Convert.ToBase64String(bytes)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }

        public static byte[] Decode(string input)
        {
            if (string.IsNullOrEmpty(input)) return Array.Empty<byte>();

            string s = input.Replace('-', '+').Replace('_', '/');
            switch (s.Length % 4)
            {
                case 2: s += "=="; break;
                case 3: s += "="; break;
                case 0: break;
                default:
                    throw new FormatException("Chuỗi base64url không hợp lệ.");
            }
            return Convert.FromBase64String(s);
        }
    }
}
