using System;
using System.Management;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32;

namespace RevitLicense.License
{
    /// <summary>
    /// Produces a stable, non-PII device fingerprint:
    /// SHA-256( MachineGuid + Windows SID + CPU id ). Cached in RAM for the
    /// lifetime of the process. Each component is best-effort; a missing one is
    /// substituted with a stable placeholder so the hash stays deterministic on
    /// a given machine but never throws.
    /// </summary>
    public static class DeviceId
    {
        private static readonly object Gate = new object();
        private static string _cached;

        /// <summary>Lower-case hex SHA-256 fingerprint. Computed once.</summary>
        public static string Get()
        {
            if (_cached != null) return _cached;
            lock (Gate)
            {
                if (_cached != null) return _cached;

                string machineGuid = ReadMachineGuid();
                string sid = ReadUserSid();
                string cpuId = ReadCpuId();

                string material = string.Join("|",
                    "RevitLicense.device.v1", machineGuid, sid, cpuId);

                using (var sha = SHA256.Create())
                {
                    byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(material));
                    _cached = ToHex(hash);
                }
                return _cached;
            }
        }

        /// <summary>Human-readable device name for /activate (machine + OS user).</summary>
        public static string GetDeviceName()
        {
            try
            {
                string host = Environment.MachineName;
                string user = Environment.UserName;
                return string.IsNullOrEmpty(host) ? user : host + " / " + user;
            }
            catch
            {
                return "Unknown device";
            }
        }

        // ------------------------------------------------------------------

        private static string ReadMachineGuid()
        {
            // HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid — read from the
            // 64-bit view so a 32-bit process still sees the real value.
            try
            {
                using (var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
                using (var key = baseKey.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography"))
                {
                    var val = key?.GetValue("MachineGuid") as string;
                    if (!string.IsNullOrEmpty(val)) return val;
                }
            }
            catch { /* fall through */ }
            return "no-machine-guid";
        }

        private static string ReadUserSid()
        {
            try
            {
                using (var identity = WindowsIdentity.GetCurrent())
                {
                    var sid = identity?.User?.Value;
                    if (!string.IsNullOrEmpty(sid)) return sid;
                }
            }
            catch { /* fall through */ }
            return "no-sid";
        }

        private static string ReadCpuId()
        {
            // WMI Win32_Processor.ProcessorId. Falls back to processor count if
            // WMI is unavailable (e.g. locked-down environments).
            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor"))
                using (var results = searcher.Get())
                {
                    foreach (ManagementObject mo in results)
                    {
                        var id = mo["ProcessorId"] as string;
                        mo.Dispose();
                        if (!string.IsNullOrEmpty(id)) return id;
                    }
                }
            }
            catch { /* fall through */ }
            return "no-cpu-id-" + Environment.ProcessorCount;
        }

        private static string ToHex(byte[] bytes)
        {
            var sb = new StringBuilder(bytes.Length * 2);
            foreach (byte b in bytes) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }
}
