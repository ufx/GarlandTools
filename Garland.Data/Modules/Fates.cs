using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Fates : Module
    {
        private static string[] _separator = new string[] { ", " };

        public override string Name => "FATEs";
        private Dictionary<int, dynamic> _fateDataById = new Dictionary<int, dynamic>();

        public override void Start()
        {
            ImportSupplementalData();

            foreach (var sFate in _builder.Sheet<Game.Fate>())
                BuildFate(sFate);
        }

        void ImportSupplementalData()
        {
            var lines = Utils.Tsv(Path.Combine(Config.SupplementalPath, "FFXIV Data - Fates.tsv"));
            foreach (var line in lines.Skip(1))
            {
                var name = line[0];
                var id = int.Parse(line[1]);
                var zone = line[2];
                var coords = line[3];
                var patch = line[4]; // Unused
                var rewardItemNameStr = line[5];

                dynamic fate = new JObject();
                fate.name = name;
                fate.id = id;

                if (zone != "")
                    fate.map = _builder.Db.MapsByName[zone];

                if (coords != "")
                    fate.coords = new JArray(Utils.FloatComma(coords));

                if (rewardItemNameStr != "")
                {
                    var rewardItemNames = rewardItemNameStr.Split(_separator, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var rewardItemName in rewardItemNames)
                    {
                        var item = _builder.Db.ItemsByName[rewardItemName];
                        if (item.fates == null)
                            item.fates = new JArray();
                        item.fates.Add(id);

                        if (fate.items == null)
                            fate.items = new JArray();
                        fate.items.Add((int)item.id);
                        _builder.Db.AddReference(item, "fate", id, false);
                    }
                }

                _fateDataById[(int)fate.id] = fate;
            }
        }

        void BuildFate(Game.Fate sFate)
        {
            if (string.IsNullOrEmpty(sFate.Name.ToString()) || sFate.MaximumClassJobLevel <= 1)
                return;

            dynamic fate = new JObject();
            fate.id = sFate.Key;
            _builder.Localize.Strings((JObject)fate, sFate, x => Utils.RemoveLineBreaks(Utils.SanitizeTags(x)), "Name");
            _builder.Localize.HtmlStrings(fate, sFate, "Description");
            fate.patch = PatchDatabase.Get("fate", sFate.Key);
            fate.lvl = sFate.ClassJobLevel;
            fate.maxlvl = sFate.MaximumClassJobLevel;
            fate.type = MapIconToFateType(sFate.Key, sFate.Name, Utils.GetIconId(sFate.MapIcon));

            if (_fateDataById.TryGetValue(sFate.Key, out var data))
            {
                if (data.map != null)
                    fate.map = data.map;
                //else
                //    System.Diagnostics.Debug.WriteLine("FATE " + name + " has no zone");

                if (data.coords != null)
                {
                    var coords = ((JArray)data.coords).Select(t => (float)t).ToArray();
                    fate.coords = new JArray(coords);
                }

                if (data.items != null)
                {
                    fate.items = data.items;
                    foreach (int itemId in fate.items)
                        _builder.Db.AddReference(fate, "item", itemId, false);
                }
            }

            _builder.Db.Fates.Add(fate);
        }

        static string MapIconToFateType(int key, string name, int mapIconId)
        {
            switch (mapIconId)
            {
                case 60501: return "Slay Enemies";
                case 60502: return "Notorious Monster";
                case 60503: return "Gather";
                case 60504: return "Defense";
                case 60505: return "Escort";
                case 60506: return "Path";
                case 60958: return "EurekaNM";

                default:
                    DatabaseBuilder.PrintLine($"Unknown fate type: {key}, {name}, {mapIconId}");
                    return "Unknown";
            }
        }
    }
}
