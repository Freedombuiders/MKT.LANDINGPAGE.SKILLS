using System;
using System.IO;
using System.Runtime.Serialization.Json;
using System.Text;

namespace RevitLicense.Auth.Models
{
    /// <summary>
    /// Minimal JSON (de)serialization helpers built on DataContractJsonSerializer
    /// so the add-in has no third-party JSON dependency. UTF-8, no BOM.
    /// </summary>
    public static class Json
    {
        private static readonly DataContractJsonSerializerSettings Settings =
            new DataContractJsonSerializerSettings { UseSimpleDictionaryFormat = true };

        public static string Serialize<T>(T obj)
        {
            var serializer = new DataContractJsonSerializer(typeof(T), Settings);
            using (var ms = new MemoryStream())
            {
                serializer.WriteObject(ms, obj);
                return Encoding.UTF8.GetString(ms.ToArray());
            }
        }

        public static T Deserialize<T>(string json)
        {
            if (string.IsNullOrEmpty(json)) return default(T);
            var serializer = new DataContractJsonSerializer(typeof(T), Settings);
            using (var ms = new MemoryStream(Encoding.UTF8.GetBytes(json)))
            {
                return (T)serializer.ReadObject(ms);
            }
        }

        /// <summary>Deserialize but never throw — returns default(T) on malformed input.</summary>
        public static T TryDeserialize<T>(string json)
        {
            try { return Deserialize<T>(json); }
            catch (Exception) { return default(T); }
        }
    }
}
