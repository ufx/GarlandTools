using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Models
{
    public class ExportHashRepository
    {
        static HashAlgorithm _hashAlgorithm = MD5.Create();
        HashSet<string> _writtenHashes = new HashSet<string>();
        string _hashRepoPath;

        public ExportHashRepository(string hashRepoPath)
        {
            _hashRepoPath = hashRepoPath;
        }

        public string Write(string extension, byte[] data)
        {
            if (data == null)
                return null;

            var hash = Hash(data);
            if (!_writtenHashes.Contains(hash))
            {
                _writtenHashes.Add(hash);
                //var hashBasePath = System.IO.Path.Combine(_hashRepoPath, hash.Substring(0, 2));
                var hashBasePath = _hashRepoPath;
                var hashPath = System.IO.Path.Combine(hashBasePath, hash) + extension;
                if (!File.Exists(hashPath))
                {
                    System.IO.Directory.CreateDirectory(hashBasePath);
                    File.WriteAllBytes(hashPath, data);
                }
            }

            return hash;
        }

        public string Write(SaintCoinach.Imaging.ImageFile sImageFile)
        {
            if (sImageFile == null)
                return null;

            var image = sImageFile.GetImage();
            using (var stream = new MemoryStream())
            {
                image.Save(stream, System.Drawing.Imaging.ImageFormat.Png);
                return Write(".png", stream.ToArray());
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
