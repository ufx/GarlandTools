using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Output
{
    public class UpdatePackage
    {
        const int PackageSizeLimit = 200 * 1000000;
        const int BatchSizeLimit = 2 * 1000000;

        List<Row> _rows = new List<Row>();
        string _name;

        public string FileName { get; private set; }
        public string Path { get; private set; }
        public DateTime? LastRun { get; private set; }
        public bool IncludeAll { get; set; }

        public UpdatePackage(string name)
        {
            _name = name;
        }

        public void IncludeDocument(string id, string type, string lang, int version, string json)
        {
            // Version is purposely ignored in the path as this package only
            // concerns itself with changed files.
            Include(new DataJsonRow() { Id = id, Type = type, Lang = lang, Version = version, Json = json });
        }

        public void Include(Row row)
        {
            if (IncludeAll || FileDatabase.NeedsUpdate(row.Path, row.Json))
                _rows.Add(row);
        }

        public void Write()
        {
            var packageSize = 0;
            var batch = new List<Row>();

            foreach (var row in _rows)
            {
                if (packageSize > PackageSizeLimit)
                {
                    WriteUpdatePackageBatch(batch.ToArray());
                    batch.Clear();
                    packageSize = 0;
                }

                batch.Add(row);
                packageSize += row.Json.Length;
            }

            if (batch.Count > 0)
                WriteUpdatePackageBatch(batch.ToArray());
        }

        void WriteUpdatePackageBatch(Row[] batch)
        {
            SetFileName();

            using (var stream = File.OpenWrite(FileName))
            {
                using (var writer = new StreamWriter(stream))
                {
                    // Update count\n\n
                    writer.WriteLine(batch.Length);
                    writer.WriteLine();

                    foreach (var row in batch)
                        row.WriteToBatchFile(writer);
                }
            }
        }

        void SetFileName()
        {
            var counter = 1;
            var fileName = Config.UpdatesPath + _name + counter.ToString("00") + ".update";

            while (File.Exists(fileName))
            {
                counter++;
                fileName = Config.UpdatesPath + _name + counter.ToString("00") + ".update";
            }

            FileName = fileName;
        }

        public static UpdatePackage Load(string path)
        {
            Debug.WriteLine($"Loading update package {System.IO.Path.GetFullPath(path)}");

            var fileName = System.IO.Path.GetFileName(path);
            var package = new UpdatePackage(fileName);
            package.FileName = fileName;
            package.Path = path;

            using (var stream = File.OpenRead(path))
            {
                using (var reader = new StreamReader(stream))
                {
                    var count = reader.ReadLine();
                    reader.ReadLine();

                    while (!reader.EndOfStream)
                        package._rows.Add(Row.ReadFromBatchFile(reader));
                }
            }
            return package;
        }

        public void Run (IPrinter output, MySqlConnection conn)
        {
            if (LastRun != null)
            {
                output.PrintLine($"Update was already run on {LastRun.Value}.  Aborting.");
                return;
            }

            output.PrintLine($"Updating {_rows.Count} records.");

            using (var cmd = conn.CreateCommand())
            {
                var stopwatch = new Stopwatch();
                stopwatch.Start();

                RunCore(output, cmd);

                output.PrintLine($"Update elapsed: {stopwatch.Elapsed}");
            }

            LastRun = DateTime.Now;
        }

        void RunCore(IPrinter output, MySqlCommand cmd)
        {
            var currentHeader = _rows[0].TableHeader;
            var sql = new StringBuilder(currentHeader);

            var count = 0;
            foreach (var row in _rows)
            {
                // Run a batch if table header differs from the current header, or
                // max batch size has been reached.
                count++;
                if (row.TableHeader != currentHeader || sql.Length > BatchSizeLimit)
                {
                    RunBatch(sql, cmd);
                    output.PrintLine($"Wrote {count} / {_rows.Count}");

                    currentHeader = row.TableHeader;
                    sql = new StringBuilder(currentHeader);
                }

                row.WriteToSql(sql);
            }

            // Send any pending statements.
            if (sql.Length > 0)
            {
                RunBatch(sql, cmd);
                output.PrintLine($"Wrote {_rows.Count}");
            }
        }

        void RunBatch(StringBuilder sql, MySqlCommand cmd)
        {
            sql.Remove(sql.Length - 1, 1);
            cmd.CommandText = sql.ToString();
            cmd.ExecuteNonQuery();
        }

        public List<Row> Rows => _rows;

        public override string ToString() => $"{FileName}  ({_rows.Count}) {LastRun?.ToString() ?? ""}";
    }
}
