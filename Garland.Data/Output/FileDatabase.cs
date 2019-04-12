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

        public static void Initialize()
        {
            //LoadPaths("SELECT Id, Type, Lang, Version, HashCode FROM DataJson",
            //    r => $"sql\\DataJson\\{r.GetString("Type")}\\{r.GetString("Lang")}\\{r.GetUInt16("Version")}\\{r.GetString("Id")}");
            //// This intentionally overrides the paths of the above.
            //LoadPaths("SELECT Id, Type, Lang, Version, HashCode FROM DataJsonTest",
            //    r => $"sql\\DataJson\\{r.GetString("Type")}\\{r.GetString("Lang")}\\{r.GetUInt16("Version")}\\{r.GetString("Id")}");
            //LoadPaths("SELECT Id, Type, Lang, HashCode FROM Search", 
            //    r => $"sql\\Search\\{r.GetString("Type")}\\{r.GetString("Lang")}\\0\\{r.GetString("Id")}");
            //LoadPaths("SELECT Id, HashCode FROM SearchRecipe",
            //    r => $"sql\\SearchRecipe\\search-recipe\\0\\{r.GetString("Id")}");
            //LoadPaths("SELECT Id, HashCode FROM SearchItem",
            //    r => $"sql\\SearchItem\\search-item\\0\\{r.GetString("Id")}");

            //foreach (var line in File.ReadAllLines(HashPath))
            //{
            //    var parts = line.Split(',');
            //    var hash = uint.Parse(parts[1]);
            //    _hashesByPath[parts[0]] = hash;
            //}
        }

        static void LoadPaths(string sql, Func<MySqlDataReader, string> getPath)
        {
            SqlDatabase.WithConnection(Config.ConnectionString, conn =>
            {
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = sql;

                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            var path = getPath(reader);
                            var hashCode = reader.GetUInt32("HashCode");
                            _hashesByPath[path] = hashCode;
                        }
                    }
                }
            });
        }

        public static void Write(string relativePath, string contents)
        {
            // Hashes are not used for local filesystem files.
            var fullPath = Config.DeployPath + relativePath;
            if (File.ReadAllText(fullPath) == contents)
                return;

            DatabaseBuilder.PrintLine($"Writing {fullPath}");
            File.WriteAllText(fullPath, contents, Encoding.UTF8);
        }

        public static bool NeedsUpdate(string path, uint contentsHashCode)
        {
            if (_hashesByPath.TryGetValue(path, out var hash) && hash == contentsHashCode)
                return false; // Hash match.  No need to write.

            _hashesByPath[path] = contentsHashCode;
            return true;
        }
    }
}
