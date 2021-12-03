using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Output
{
    public abstract class Row
    {
        [JsonIgnore] public abstract string Table { get; }
        public abstract string TableHeader { get; }

        public abstract string Id { get; set; }
        public abstract string Type { get; set; }
        [JsonIgnore] public virtual int Version { get => 0; set => throw new NotImplementedException(); }
        [JsonIgnore] public virtual string Lang { get => ""; set => throw new NotImplementedException(); }
        public abstract string Json { get; set; }
        [JsonIgnore] public string Summary => Json?.Substring(0, Math.Min(300, Json.Length));

        [JsonIgnore]
        public string Path
        {
            get
            {
                if (string.IsNullOrEmpty(Lang))
                    return $"sql\\{Table}\\{Type}\\{Version}\\{Id}";
                else
                    return $"sql\\{Table}\\{Type}\\{Lang}\\{Version}\\{Id}";
            }
        }

        public abstract void WriteToSql(StringBuilder sql);
        public abstract void WriteToBatchFile(StreamWriter writer);

        uint _jsonHashCode;
        public uint GetJsonHashCode()
        {
            if (_jsonHashCode == 0)
                _jsonHashCode = (uint)Json.GetHashCode();
            return _jsonHashCode;
        }

        public static Row ReadFromBatchFile(StreamReader reader)
        {
            var line = reader.ReadLine();
            var metadata = line.Split(' ');
            var rowType = metadata[0];
            if(rowType == "") {
                return null;
            }
            if (rowType == "DataJson")
                return DataJsonRow.ReadFromBatchFile(metadata, reader);
            else if (rowType == "Search")
                return SearchRow.ReadFromBatchFile(metadata, reader);
            else if (rowType == "SearchItem")
                return SearchItemRow.ReadFromBatchFile(metadata, reader);
            else if (rowType == "SearchRecipe")
                return SearchRecipeRow.ReadFromBatchFile(metadata, reader);
            else
                throw new NotImplementedException($"No reader for Type {rowType}");
        }
    }

    public class SearchRow : Row
    {
        public override string TableHeader => "REPLACE INTO Search (Id, Type, Lang, Name, OriginalName, HashCode, Json) VALUES";

        public override string Id { get; set; }
        public override string Table => "Search";
        public override string Type { get; set; }
        public override string Lang { get; set; }
        public string Name { get; set; }
        public override string Json { get; set; }

        public override void WriteToSql(StringBuilder sql)
        {
            var json = Utils.SqlEscape(Json);
            var originalName = Utils.SqlEscape(Name);
            sql.Append($"('{Id}', '{Type}', '{Lang}', {MakeKey(Name)}, '{originalName}', {GetJsonHashCode()}, '{json}'),");
        }

        static string[] SearchKeyDelimiters = new[] { " ", "'", "-" };
        static string MakeKey(string str)
        {
            if (str == null)
                return "NULL";

            // Delimiters are handled two ways.  They are:
            // 1. Eliminated for indexing purposes to allow searches to work without them, e.g. Wind-up becomes Windup.
            // 2. Split up to allow both sides of the delimiter to be indexes.  E.g. Mini-Shinryu becomes Mini Shinryu.
            // 3. Concatenated into one string index.
            //
            // Examples:
            // Mini-Shinryu = MiniShinryu Mini Shinryu
            // Wind-up Louisoux = Windup Louisoux Wind up

            str = Utils.SanitizeTags(str);

            var key = new StringBuilder();
            var keySuffix = new StringBuilder();

            var tokens = Utils.Tokenize(SearchKeyDelimiters, str);
            var lastValidTokenIndex = 0;
            for (var i = 0; i < tokens.Length; i++)
            {
                var token = tokens[i];
                if (token == "'" || token == "-")
                {
                    if (i > 0 && i < tokens.Length - 1 && tokens[i + 1].Length > 2)
                        keySuffix.Append(tokens[lastValidTokenIndex] + " " + tokens[i + 1]);
                    continue;
                }

                lastValidTokenIndex = i;
                key.Append(token);
            }

            if (keySuffix.Length > 0)
            {
                key.Append(" ");
                key.Append(keySuffix);
            }

            return "'" + key.ToString() + "'";
        }

        public override void WriteToBatchFile(StreamWriter writer)
        {
            // Search
            var metadata = $"Search {Id} {Type} {Lang}";
            writer.WriteLine(metadata);

            // Keys
            writer.WriteLine(Name);

            // json\n\n
            writer.WriteLine(Json);
            writer.WriteLine();
        }

        public static SearchRow ReadFromBatchFile(string[] metadata, StreamReader reader)
        {
            var row = new SearchRow();
            row.Id = metadata[1];
            row.Type = metadata[2];
            row.Lang = metadata[3];
            row.Name = reader.ReadLine();
            row.Json = reader.ReadLine();

            reader.ReadLine();
            return row;
        }
    }

    public class SearchItemRow : Row
    {
        public override string Id { get; set; }
        public override string Table => "SearchItem";
        public short ItemLevel { get; set; }
        public byte Rarity { get; set; }
        public short Category { get; set; }
        public byte Jobs { get; set; }
        public byte EquipLevel { get; set; }
        public bool IsPvP { get; set; }
        public bool IsCraftable { get; set; }
        public bool IsDesynthable { get; set; }
        public bool IsCollectable { get; set; }
        [JsonIgnore] public override string Type { get => "search-item"; set => throw new NotImplementedException(); }
        [JsonIgnore] public override string Json { get; set; }
        [JsonIgnore] public override string TableHeader => "REPLACE INTO SearchItem(Id, ItemLevel, Rarity, Category, Jobs, EquipLevel, IsPvP, IsCraftable, IsDesynthable, IsCollectable, HashCode) VALUES";

        public override void WriteToSql(StringBuilder sql)
        {
            var isPvP = IsPvP ? 1 : 0;
            var isCraftable = IsCraftable ? 1 : 0;
            var isDesynthable = IsDesynthable ? 1 : 0;
            var isCollectable = IsCollectable ? 1 : 0;
            sql.Append($"('{Id}', {ItemLevel}, {Rarity}, {Category}, {Jobs}, {EquipLevel}, b'{isPvP}', b'{isCraftable}', b'{isDesynthable}', b'{isCollectable}', {GetJsonHashCode()}),");
        }

        public override void WriteToBatchFile(StreamWriter writer)
        {
            writer.WriteLine($"SearchItem {Id} {ItemLevel} {Rarity} {Category} {Jobs} {EquipLevel} {IsPvP} {IsCraftable} {IsDesynthable} {IsCollectable}");
        }

        public static SearchItemRow ReadFromBatchFile(string[] metadata, StreamReader reader)
        {
            var row = new SearchItemRow();
            row.Id = metadata[1];
            row.ItemLevel = short.Parse(metadata[2]);
            row.Rarity = byte.Parse(metadata[3]);
            row.Category = short.Parse(metadata[4]);
            row.Jobs = byte.Parse(metadata[5]);
            row.EquipLevel = byte.Parse(metadata[6]);
            row.IsPvP = bool.Parse(metadata[7]);
            row.IsCraftable = bool.Parse(metadata[8]);
            row.IsDesynthable = bool.Parse(metadata[9]);
            row.IsCollectable = bool.Parse(metadata[10]);
            row.Json = JsonConvert.SerializeObject(row);
            return row;
        }
    }

    public class SearchRecipeRow : Row
    {
        public override string Id { get; set; }
        public override string Table => "SearchRecipe";
        public string ItemId { get; set; }
        public byte Job { get; set; }
        public short JobLevel { get; set; }
        public byte Stars { get; set; }
        public short RecipeLevel { get; set; }
        [JsonIgnore] public override string Type { get => "search-recipe"; set => throw new NotImplementedException(); }
        [JsonIgnore] public override string Json { get; set; }
        [JsonIgnore] public override string TableHeader => "REPLACE INTO SearchRecipe(Id, ItemId, Job, JobLevel, Stars, RecipeLevel, HashCode) VALUES";

        public override void WriteToBatchFile(StreamWriter writer)
        {
            writer.WriteLine($"SearchRecipe {Id} {ItemId} {Job} {JobLevel} {Stars} {RecipeLevel}");
        }

        public static SearchRecipeRow ReadFromBatchFile(string[] metadata, StreamReader reader)
        {
            var row = new SearchRecipeRow();
            row.Id = metadata[1];
            row.ItemId = metadata[2];
            row.Job = byte.Parse(metadata[3]);
            row.JobLevel = short.Parse(metadata[4]);
            row.Stars = byte.Parse(metadata[5]);
            row.RecipeLevel = short.Parse(metadata[6]);
            row.Json = JsonConvert.SerializeObject(row);
            return row;
        }

        public override void WriteToSql(StringBuilder sql)
        {
            sql.Append($"('{Id}', '{ItemId}', {Job}, {JobLevel}, {Stars}, {RecipeLevel}, {GetJsonHashCode()}),");
        }
    }

    public class DataJsonRow : Row
    {
        public override string TableHeader => "REPLACE INTO DataJsonTest (Id, Type, Lang, Version, HashCode, Json) VALUES";

        public override string Id { get; set; }
        public override string Table => "DataJson";
        public override string Type { get; set; }
        public override string Lang { get; set; }
        public override int Version { get; set; }
        public override string Json { get; set; }

        public override void WriteToSql(StringBuilder sql)
        {
            var json = Utils.SqlEscape(Json);
            sql.Append($"('{Id}', '{Type}', '{Lang}', {Version}, {GetJsonHashCode()}, '{json}'),");
        }

        public static DataJsonRow ReadFromBatchFile(string[] metadata, StreamReader reader)
        {
            var row = new DataJsonRow();

            row.Type = metadata[1];
            row.Id = metadata[2];
            row.Lang = metadata[3];
            row.Version = int.Parse(metadata[4]);
            row.Json = reader.ReadLine();

            reader.ReadLine(); // Empty separator
            return row;
        }

        public override void WriteToBatchFile(StreamWriter writer)
        {
            // DataJson type id version\n
            var metadata = $"DataJson {Type} {Id} {Lang} {Version}";
            writer.WriteLine(metadata);

            // json\n\n
            writer.WriteLine(Json);
            writer.WriteLine();
        }
    }
}
