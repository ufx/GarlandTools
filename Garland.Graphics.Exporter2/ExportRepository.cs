using ImageMagick;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Graphics.Exporter
{
    public class ExportRepository
    {
        static HashAlgorithm _hashAlgorithm = MD5.Create();
        HashSet<string> _writtenHashes = new HashSet<string>();
        string _hashRepoPath;

        public ExportRepository(string hashRepoPath)
        {
            _hashRepoPath = hashRepoPath;
        }

        public string Write(string extension, byte[] data)
        {
            if (data == null)
                return null;

            var hash = Hash(data);
            if (!_writtenHashes.Add(hash))
                return hash;

            var hashBasePath = Path.Combine(_hashRepoPath, hash.Substring(0, 2));
            var hashPath = Path.Combine(hashBasePath, hash) + extension;
            if (!File.Exists(hashPath))
            {
                Directory.CreateDirectory(hashBasePath);
                File.WriteAllBytes(hashPath, data);
            }

            return hash;
        }

        public string Write(byte[] source, PixelReadSettings settings, bool defineAlpha)
        {
            if (source == null || source.Length == 0)
                return null;

            using (var image = new MagickImage(source, settings))
            {
                var bytes = image.ToByteArray(MagickFormat.Png);
                return Write(".png", bytes);
            }
        }

        static string Hash(byte[] data)
        {
            var hash = _hashAlgorithm.ComputeHash(data);
            return string.Join("", hash.Select(b => b.ToString("X2")));
        }
    }

    public class ExportMetadata
    {
        [JsonProperty("name")]
        public string Name;

        [JsonProperty("sets")]
        public List<ExportSetMetadata> Sets = new List<ExportSetMetadata>();
    }

    public class ExportSetMetadata
    {
        [JsonProperty("name")]
        public string Name; // e.g. Hyur Midlander Female

        [JsonProperty("models")]
        public List<ExportModelMetadata> Models = new List<ExportModelMetadata>();
    }

    public class ExportModelMetadata
    {
        [JsonProperty("obj")]
        public string Obj;

        [JsonProperty("alpha")]
        public string Alpha;

        [JsonProperty("diffuse")]
        public string Diffuse;

        [JsonProperty("emissive")]
        public string Emissive;

        [JsonProperty("normal")]
        public string Normal;

        [JsonProperty("specular")]
        public string Specular;
    }
}
