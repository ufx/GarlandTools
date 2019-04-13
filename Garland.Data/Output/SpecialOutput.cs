using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Output
{
    public static class SpecialOutput
    {

        public static void Run()
        {
            //ExportFishTsv();
            ExportZoneWeather();
        }

        static void ExportZoneWeather()
        {
            var db = GarlandDatabase.Instance;
            var parts = new List<string>();

            // Weather index
            var weatherIndex = string.Join(",", db.Weather.Select(w => "\"" + w + "\""));
            parts.Add($"$weatherIndex = array({weatherIndex})");

            // Zone weather
            var zoneWeather = new List<string>();
            foreach (var location in db.Locations)
            {
                if (!db.LocationReferences.Contains((int)location.id))
                    continue;

                if (location.weatherRate == null)
                    continue;

                string zoneName = location.name;
                if (string.IsNullOrEmpty(zoneName))
                    continue;

                var weatherRateId = (int)location.weatherRate;
                var weatherRate = db.WeatherRates.First(r => r.id == weatherRateId);

                JArray rates = weatherRate.rates;
                var rateList = string.Join(", ", rates.Select(r => $"array('Rate' => {r["rate"]}, 'Weather' => {r["weather"]})"));
                zoneWeather.Add($"'{PhpEscape(zoneName)}' => array({rateList})");
            }

            parts.Add($"$zoneWeather = array({string.Join(",\r\n    ", zoneWeather)})");

            // Done
            parts.Add("");
            var result = "<?php\r\n\r\n" + string.Join(";\r\n\r\n", parts) + "?>\r\n";
            FileDatabase.WriteFile("Garland.Server\\api\\weather.inc.php", result);
        }

        static string PhpEscape(string str)
        {
            return str
                .Replace("\\", "\\\\")
                .Replace("'", "\\'");
        }

        static void ExportFishTsv()
        {
            var db = GarlandDatabase.Instance;
            var lines = new List<string>();

            // Fishing spots
            foreach (var spot in db.FishingSpots)
            {
                lines.Add((string)spot.en.name);

                foreach (var fishingSpotItem in spot.items)
                {
                    var item = db.ItemsById[(int)fishingSpotItem.id];
                    var fish = item.fish;

                    var name = item.en.name;
                    var bait = fish.bait == null ? "" : string.Join(", ", ((JArray)fish.bait).Select(id => db.ItemsById[(int)id].en.name));
                    var start = fish.during == null ? "" : fish.during.start;
                    var end = fish.during == null ? "" : fish.during.end;
                    var transition = fish.transition == null ? "" : string.Join(", ", (JArray)fish.transition);
                    var weather = fish.weather == null ? "" : string.Join(", ", (JArray)fish.weather);
                    var predators = fish.predator == null ? "" : string.Join(", ", ((JArray)fish.predator).Select(p => db.ItemsById[(int)p["id"]].en.name + ", " + p["amount"]));
                    var hookset = fish.hookset == null ? "" : ((string)fish.hookset).Replace(" Hookset", "");
                    var gathering = fish.gatheringReq == null ? "" : (string)fish.gatheringReq;
                    var snagging = fish.snagging == null ? "" : "1";
                    var fishEyes = fish.fishEyes == null ? "" : "1";
                    var cbh = fish.cbh;

                    lines.Add($"{name}\t{bait}\t{start}\t{end}\t{transition}\t{weather}\t{predators}\t{hookset}\t{gathering}\t{snagging}\t{fishEyes}\t{cbh}");
                }
            }

            // Spearfishing nodes
            foreach (var node in db.Nodes.Where(n => n.type == 4))
            {
                lines.Add((string)node.name);

                foreach (var nodeItem in node.items)
                {
                    var item = db.ItemsById[(int)nodeItem.id];
                    var fish = item.fish;

                    var name = item.en.name;
                    var gig = fish.gig == null ? "" : string.Join(", ", (JArray)fish.gig);
                    var predators = fish.predator == null ? "" : string.Join(", ", ((JArray)fish.predator).Select(p => db.ItemsById[(int)p["id"]].en.name + ", " + p["amount"]));
                    var cbh = fish.cbh;

                    lines.Add($"{name}\t{gig}\t\t\t\t\t\t\t\t\t\t{cbh}");
                }
            }

            System.IO.File.WriteAllLines("Fishing.tsv", lines);
        }
    }
}
