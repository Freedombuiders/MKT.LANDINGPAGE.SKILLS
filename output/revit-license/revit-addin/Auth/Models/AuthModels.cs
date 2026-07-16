using System.Runtime.Serialization;

namespace RevitLicense.Auth.Models
{
    // ----------------------------------------------------------------------
    // DTOs for Supabase Auth (GoTrue) and the business API.
    // Serialized/deserialized with DataContractJsonSerializer (no external JSON
    // dependency). Field names map 1:1 to the GoTrue / API JSON via DataMember.
    // ----------------------------------------------------------------------

    /// <summary>Successful GoTrue session response (signin / refresh).</summary>
    [DataContract]
    public class GoTrueSession
    {
        [DataMember(Name = "access_token", EmitDefaultValue = false)]
        public string AccessToken { get; set; }

        [DataMember(Name = "refresh_token", EmitDefaultValue = false)]
        public string RefreshToken { get; set; }

        [DataMember(Name = "token_type", EmitDefaultValue = false)]
        public string TokenType { get; set; }

        [DataMember(Name = "expires_in", EmitDefaultValue = false)]
        public long ExpiresIn { get; set; }

        [DataMember(Name = "user", EmitDefaultValue = false)]
        public GoTrueUser User { get; set; }
    }

    [DataContract]
    public class GoTrueUser
    {
        [DataMember(Name = "id", EmitDefaultValue = false)]
        public string Id { get; set; }

        [DataMember(Name = "email", EmitDefaultValue = false)]
        public string Email { get; set; }
    }

    /// <summary>GoTrue error body. Shapes vary; we capture the common fields.</summary>
    [DataContract]
    public class GoTrueError
    {
        [DataMember(Name = "error", EmitDefaultValue = false)]
        public string Error { get; set; }

        [DataMember(Name = "error_description", EmitDefaultValue = false)]
        public string ErrorDescription { get; set; }

        // Newer GoTrue uses { code, msg } or { error_code, message }.
        [DataMember(Name = "msg", EmitDefaultValue = false)]
        public string Msg { get; set; }

        [DataMember(Name = "message", EmitDefaultValue = false)]
        public string Message { get; set; }

        [DataMember(Name = "error_code", EmitDefaultValue = false)]
        public string ErrorCode { get; set; }

        [DataMember(Name = "code", EmitDefaultValue = false)]
        public string Code { get; set; }
    }

    // ---------------------- Request bodies ----------------------

    [DataContract]
    public class SignUpRequest
    {
        [DataMember(Name = "email")]
        public string Email { get; set; }

        [DataMember(Name = "password")]
        public string Password { get; set; }

        // Stored on auth.users.user_metadata -> mirrored to profiles by trigger.
        [DataMember(Name = "data", EmitDefaultValue = false)]
        public SignUpMetadata Data { get; set; }
    }

    [DataContract]
    public class SignUpMetadata
    {
        [DataMember(Name = "full_name", EmitDefaultValue = false)]
        public string FullName { get; set; }

        [DataMember(Name = "phone", EmitDefaultValue = false)]
        public string Phone { get; set; }
    }

    [DataContract]
    public class PasswordGrantRequest
    {
        [DataMember(Name = "email")]
        public string Email { get; set; }

        [DataMember(Name = "password")]
        public string Password { get; set; }
    }

    [DataContract]
    public class RefreshGrantRequest
    {
        [DataMember(Name = "refresh_token")]
        public string RefreshToken { get; set; }
    }

    [DataContract]
    public class RecoverRequest
    {
        [DataMember(Name = "email")]
        public string Email { get; set; }
    }

    // ---------------------- Business API: activate / refresh ----------------------

    [DataContract]
    public class ActivateRequest
    {
        [DataMember(Name = "device_id")]
        public string DeviceId { get; set; }

        [DataMember(Name = "device_name")]
        public string DeviceName { get; set; }
    }

    [DataContract]
    public class RefreshTokenRequest
    {
        [DataMember(Name = "device_id")]
        public string DeviceId { get; set; }
    }

    /// <summary>Response of /api/activate and /api/refresh-token.</summary>
    [DataContract]
    public class EntitlementResponse
    {
        [DataMember(Name = "token", EmitDefaultValue = false)]
        public string Token { get; set; }

        [DataMember(Name = "kid", EmitDefaultValue = false)]
        public string Kid { get; set; }

        [DataMember(Name = "exp", EmitDefaultValue = false)]
        public long Exp { get; set; }

        [DataMember(Name = "grace_until", EmitDefaultValue = false)]
        public long GraceUntil { get; set; }

        [DataMember(Name = "disciplines", EmitDefaultValue = false)]
        public string[] Disciplines { get; set; }
    }

    /// <summary>Response of GET /api/public-key.</summary>
    [DataContract]
    public class PublicKeyResponse
    {
        [DataMember(Name = "kid", EmitDefaultValue = false)]
        public string Kid { get; set; }

        [DataMember(Name = "public_key_pem", EmitDefaultValue = false)]
        public string PublicKeyPem { get; set; }
    }

    /// <summary>Issue-trial request body.</summary>
    [DataContract]
    public class IssueTrialRequest
    {
        [DataMember(Name = "device_fingerprint")]
        public string DeviceFingerprint { get; set; }
    }
}
