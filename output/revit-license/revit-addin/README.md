# RevitLicense — Revit Add-in (license client)

C# / .NET Framework 4.8 class library for **Revit 2024**. Implements the client
side of the subscription-license system:

- **Auth in Revit** — WPF dialog (Đăng nhập / Đăng ký / Quên mật khẩu) calling
  Supabase Auth (GoTrue) directly. Only the `refresh_token` is persisted
  (DPAPI); `access_token` lives in RAM.
- **Device activation + entitlement token** — `POST /api/activate` returns a
  compact JWT (Ed25519, "EdDSA"). Verified **offline** with an embedded public
  key. Cached encrypted at `%APPDATA%/RevitLicense/entitlement.dat`.
- **Per-command gate** — `LicenseClient.CanRun(commandId)` implements the hybrid
  algorithm: offline signature verify → if `now < exp` trust disciplines; if
  expired + online → refresh; if expired + offline + within `grace_until` →
  trust; else deny (with a VN upsell popup linking to the buy page).
- **Telemetry** — every command run logs `success` / `error` / `denied` to a
  RAM queue + `%APPDATA%/RevitLicense/telemetry-queue.jsonl`, flushed in batches
  (20 events or 30s) to `POST /api/telemetry`, fire-and-forget. Never blocks a
  command.

> **macOS note:** this project is **source only** and is **not** built here. Open
> and build on **Windows + Visual Studio 2022 + Revit 2024**.

---

## Project layout

```
RevitLicense.csproj          .NET 4.8 class library (PackageReference: BouncyCastle.Cryptography)
RevitLicense.addin           Revit manifest (Application + 2 sample Commands) — placeholder GUIDs
Config.cs                    API_BASE / SUPABASE_URL / ANON_KEY / public key PEM + KID / app version
Properties/AssemblyInfo.cs
Resources/public-key.pem     Embedded Ed25519 SPKI public key (optional; placeholder)

Auth/
  Models/AuthModels.cs       DTOs (GoTrue + business API)
  Models/Json.cs             DataContractJsonSerializer helpers (no 3rd-party JSON)
  SupabaseAuthClient.cs      SignUp / SignIn / Refresh / Recover (static HttpClient, 5s, VN errors)
  TokenStore.cs              DPAPI store for { refresh_token, user_id, email }

License/
  DeviceId.cs                SHA-256( MachineGuid + Windows SID + CPU id ), cached in RAM
  EntitlementToken.cs        compact-JWT parse + base64url codec
  Ed25519Verifier.cs         BouncyCastle Ed25519 verify, key-by-kid, embedded PEM
  TokenCache.cs              DPAPI store for the raw entitlement token
  RequiresProductAttribute.cs[RequiresProduct("ARC")]
  LicenseClient.cs           singleton: Activate / Refresh / IssueTrial / CanRun + background refresh

Telemetry/
  UsageEvent.cs              event model + batch wrapper
  EventQueue.cs              RAM + JSONL backup, flush @ 20 events / 30s
  TelemetryClient.cs         POST /api/telemetry (Bearer), retry on fail

App/
  Application.cs             IExternalApplication: silent refresh → LoginWindow → ribbon
  CommandBase.cs             IExternalCommand wrapper: Stopwatch + CanRun + telemetry

Commands/
  SampleCommands.cs          ARC.WallDimension, STR.ColumnRebar

UI/
  LoginWindow.xaml(.cs)      3-tab WPF dialog (VN labels, phone/email validation)
```

---

## Build on Windows (Visual Studio 2022)

### 1. Set the Revit API HintPaths

`RevitLicense.csproj` references `RevitAPI.dll` / `RevitAPIUI.dll` via the
`$(RevitApiDir)` property (default `C:\Program Files\Autodesk\Revit 2024`). If
your install differs, either:

- edit the `<RevitApiDir>` property at the top of the `.csproj`, **or**
- build with `msbuild RevitLicense.csproj /p:RevitApiDir="D:\Revit 2024"`.

Both Revit references have `<Private>false</Private>` (CopyLocal = false) — Revit
loads its own copies; never ship them with the add-in.

### 2. Restore NuGet

The only package is **`BouncyCastle.Cryptography`** (v2.4.0, PackageReference).
`dotnet restore` / NuGet restore on build pulls it. Ed25519 verification uses
`Org.BouncyCastle.Crypto.Signers.Ed25519Signer`.

### 3. Fill in `Config.cs` placeholders

| Constant | Fill with |
|---|---|
| `API_BASE` | Your deployed API origin, e.g. `https://api.yourdomain.com` (no trailing slash) |
| `SUPABASE_URL` | Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase **anon** (publishable) key — safe to embed |
| `BuyPageUrl` | Your sales / renew landing page |
| `PublicKeysPem["k1"]` + `DefaultKid` | The Ed25519 **public** key PEM and its kid |

Get the public key one of two ways:

- **From the server:** `GET {API_BASE}/api/public-key` → `{ kid, public_key_pem }`.
- **From your key-gen script:** e.g. `npm run gen-keys` in the backend repo —
  copy the SPKI `-----BEGIN PUBLIC KEY-----` block.

You can paste the PEM **inline** in `Config.cs` (`PublicKeysPem`) **or** ship it
as the embedded resource `Resources/public-key.pem` (first line = kid, then the
PEM block). `Ed25519Verifier` checks the resource first, then `Config`. Keep
multiple kids for key rotation.

> The placeholder `TODO_BASE64_SPKI_...` is intentionally rejected by the
> verifier, so an unconfigured build denies every command (fail-closed).

### 4. Build

`Build → Release`. Output: `bin\Release\RevitLicense.dll` +
`BouncyCastle.Cryptography.dll`.

---

## Install the add-in

Copy to `%APPDATA%\Autodesk\Revit\Addins\2024\`:

```
%APPDATA%\Autodesk\Revit\Addins\2024\RevitLicense.addin
%APPDATA%\Autodesk\Revit\Addins\2024\RevitLicense\RevitLicense.dll
%APPDATA%\Autodesk\Revit\Addins\2024\RevitLicense\BouncyCastle.Cryptography.dll
```

The `.addin` `<Assembly>` path is relative (`RevitLicense\RevitLicense.dll`).
Regenerate the placeholder GUIDs in `RevitLicense.addin` and
`Properties/AssemblyInfo.cs` (keep `ClientId` stable across releases).

There is an optional commented `DeployAddin` target in the `.csproj` that copies
both files on each build for F5 debugging — uncomment + adjust on Windows.

On Revit launch you get a **License Demo** ribbon tab with two sample buttons.
First run shows the login dialog (unless a valid `refresh_token` is cached).

---

## Runtime behaviour notes

- **Offline / TLS:** `ServicePointManager` is set to TLS 1.2+ (some .NET 4.8
  hosts default lower). All HTTP uses a single static `HttpClient`, 5s timeout.
- **Grace mode:** when a token is expired and the machine is offline but still
  within `grace_until`, commands run and a "còn N ngày offline" banner shows.
- **Tamper resistance:** hand-editing `entitlement.dat` breaks DPAPI decryption
  **or** the Ed25519 signature → the add-in clears the cache and forces a
  re-activation. Copying `auth.dat`/`entitlement.dat` to another Windows user
  fails to decrypt (DPAPI CurrentUser).
- **Telemetry user_id:** the client never sends `user_id`; the server derives it
  from the Bearer token (anti-spoof per module 06).

---

## Hardening for release (recommended)

.NET assemblies are decompilable. Per module 10 of the design doc, apply an
obfuscator (**ConfuserEx** or Dotfuscator) to the release DLL — at minimum
rename + control-flow on `License/*` and `Ed25519Verifier`. This raises crack
cost above the license price; it is not 100% DRM. Also consider lowering the
token `exp` (e.g. 1–4h) if you need faster refund/revocation enforcement.

---

## TODOs the Windows dev must fill before building

1. **`Config.cs`** — `API_BASE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `BuyPageUrl`, and the real Ed25519 public key PEM + `kid`
   (`PublicKeysPem` / `DefaultKid`), or `Resources/public-key.pem`.
2. **`RevitLicense.csproj`** — `$(RevitApiDir)` if Revit isn't at the default path.
3. **`RevitLicense.addin`** — regenerate the 3 `<ClientId>` GUIDs and set
   `VendorId` / `VendorDescription`.
4. **`Properties/AssemblyInfo.cs`** — regenerate the assembly `Guid`, set company.
5. **`Commands/SampleCommands.cs`** — replace the two `TaskDialog` placeholders
   with the real Revit logic.
6. *(Optional)* Adjust `LicenseClient.CommandProductMap` / `RequiredProduct`, or
   wire it to the server `command_registry`, as you add commands.
7. *(Optional)* Confirm the BouncyCastle package version restores on your feed
   (pinned to `2.4.0`).
```
