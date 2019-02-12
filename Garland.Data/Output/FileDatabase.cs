using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Output
{
    public static class FileDatabase
    {
        static Dictionary<string, uint> _hashesByPath = new Dictionary<string, uint>();
        static bool _hashChanges = false;
        const string HashPath = Config.SupplementalPath + "hash-db.txt";

        public static void Initialize()
        {
            foreach (var line in File.ReadAllLines(HashPath))
            {
                var parts = line.Split(',');
                var hash = uint.Parse(parts[1]);
                _hashesByPath[parts[0]] = hash;
            }
        }

        public static void Write(string relativePath, string contents)
        {
            var fullPath = Config.DeployPath + relativePath;
            WriteCore(fullPath, relativePath, contents);
        }

        static void WriteCore(string fullPath, string hashPath, string contents)
        {
            if (NeedsUpdate(hashPath, contents))
            {
                DatabaseBuilder.PrintLine($"Writing {fullPath}");
                File.WriteAllText(fullPath, contents, Encoding.UTF8);
            }
        }

        public static bool NeedsUpdate(string path, string contents)
        {
            var contentsHash = (uint)contents.GetHashCode();
            if (_hashesByPath.TryGetValue(path, out var hash) && hash == contentsHash)
                return false; // Hash match.  No need to write.

            _hashesByPath[path] = contentsHash;
            _hashChanges = true;
            return true;
        }

        public static void WriteHashUpdates()
        {
            if (!_hashChanges)
                return;

            DatabaseBuilder.PrintLine($"Writing hashes: {HashPath}");

            var lines = _hashesByPath.Select(kv => kv.Key + "," + kv.Value);
            File.WriteAllLines(HashPath, lines);
        }
    }
}
