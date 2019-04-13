using MySql.Data.MySqlClient;
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
        static bool _ready;

        public static void Initialize()
        {
            Task.Factory.StartNew(() =>
            {
                LoadPaths("SELECT Id, Type, Lang, Version, HashCode FROM DataJson",
                    r => $"sql\\DataJson\\{r.GetString("Type")}\\{r.GetString("Lang")}\\{r.GetUInt16("Version")}\\{r.GetString("Id")}");
                // This intentionally overrides the paths of the above.
                LoadPaths("SELECT Id, Type, Lang, Version, HashCode FROM DataJsonTest",
                    r => $"sql\\DataJson\\{r.GetString("Type")}\\{r.GetString("Lang")}\\{r.GetUInt16("Version")}\\{r.GetString("Id")}");
                LoadPaths("SELECT Id, Type, Lang, HashCode FROM Search",
                    r => $"sql\\Search\\{r.GetString("Type")}\\{r.GetString("Lang")}\\0\\{r.GetString("Id")}");
                LoadPaths("SELECT Id, HashCode FROM SearchRecipe",
                    r => $"sql\\SearchRecipe\\search-recipe\\0\\{r.GetString("Id")}");
                LoadPaths("SELECT Id, HashCode FROM SearchItem",
                    r => $"sql\\SearchItem\\search-item\\0\\{r.GetString("Id")}");

                // Hashes only take a few seconds to load and aren't needed until
                // the end of processing (currently taking 2 minutes.)  If hash
                // database isn't ready by then something is wrong.
                _ready = true;
            });
        }

        static void LoadPaths(string sql, Func<MySqlDataReader, string> getPath)
        {
            SqlDatabase.WithReader(Config.ConnectionString, sql, reader =>
            {
                while (reader.Read())
                {
                    var path = getPath(reader);
                    var hashCode = reader.GetUInt32("HashCode");
                    _hashesByPath[path] = hashCode;
                }
            });
        }

        public static void WriteFile(string relativePath, string contents)
        {
            // Hashes are not used for local filesystem files.
            var fullPath = Config.BasePath + relativePath;
            if (File.ReadAllText(fullPath) == contents)
                return;

            DatabaseBuilder.PrintLine($"Writing {fullPath}");
            File.WriteAllText(fullPath, contents, Encoding.UTF8);
        }

        public static bool NeedsUpdate(string path, uint contentsHashCode)
        {
            if (!_ready)
                throw new InvalidOperationException("Hashes should have loaded by now.  Bad server connection?");

            if (_hashesByPath.TryGetValue(path, out var hash) && hash == contentsHashCode)
                return false; // Hash match.  No need to write.

            _hashesByPath[path] = contentsHashCode;
            return true;
        }
    }
}
