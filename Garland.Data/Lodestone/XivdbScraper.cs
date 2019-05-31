using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Lodestone
{
    public class XivdbScraper : WebScraper
    {
        private const string _baseUrl = "https://api.xivdb.com/search?string=";
        private string[] _categories = new string[] { "achievements", "actions", "fates", "npcs", "enemies", "quests", "instances", "leves", "items" };

        private Dictionary<int, decimal> _patches;
        private JArray _patchData;

        public XivdbScraper()
        {
            _sleepMin = 250;
            _sleepMax = 250;

            _patches = new Dictionary<int, decimal>();
            _patches[1] = 1.0m; // patch 1.0-1.23
            _patches[2] = 2.0m; // A Realm Reborn
            _patches[3] = 2.05m; // Halloween 2013
            _patches[4] = 2.1m; // A Realm Awoken
            _patches[6] = 2.15m;
            _patches[7] = 2.16m;
            _patches[8] = 2.2m; // Through the Maelstrom
            _patches[9] = 2.25m;
            _patches[10] = 2.28m;
            _patches[11] = 2.3m; // Defenders of Eorzea
            _patches[12] = 2.35m;
            _patches[13] = 2.38m;
            _patches[14] = 2.4m; // Dreams of Ice
            _patches[15] = 2.45m;
            _patches[16] = 2.5m; // Before the Fall
            _patches[17] = 2.51m;
            _patches[18] = 2.55m;
            _patches[19] = 3.0m; // Heavensward
            _patches[20] = 3.01m;
            _patches[21] = 3.05m;
            _patches[22] = 3.07m;
            _patches[23] = 3.1m; // As Goes Light, So Goes Darkness
            _patches[24] = 3.15m;
            _patches[25] = 3.2m; // Gears of Change
            _patches[26] = 3.25m;

            _patchData = (JArray)JsonConvert.DeserializeObject(File.ReadAllText(Config.PatchesPath));
        }

        public void FetchPatches()
        {
            foreach (var patch in _patches.Values)
                FetchPatch(patch);
        }

        private void FetchPatch(decimal patch)
        {
            DatabaseBuilder.PrintLine($"Fetching xivdb patch {patch}");

            var patchStr = patch == 1.0m ? "1.0-1.23" : patch.ToString();
            var url = _baseUrl + "patch+" + patchStr + "&language=en";
            var requestStr = Request(url);
            var xivdbSearchResponse = (JObject) JsonConvert.DeserializeObject(requestStr);
            ProcessResponse(xivdbSearchResponse, patch, url);

            WritePatches();
        }

        private void ProcessResponse(dynamic xivdbSearchResponse, decimal patch, string originUrl)
        {
            foreach (var category in _categories)
            {
                var xivdbSearchCategory = xivdbSearchResponse[category];
                if (xivdbSearchCategory == null)
                    continue;

                var type = MapXivdbCategoryToType(category);

                // Create patch items from results.
                var xivdbSearchResults = xivdbSearchCategory.results;
                foreach (var xivdbResult in xivdbSearchResults)
                {
                    dynamic patchItem = new JObject();
                    patchItem.type = type;
                    patchItem.id = xivdbResult.id;
                    patchItem.patch = patch;
                    _patchData.Add(patchItem);
                }

                // Fetch next pages.
                var xivdbSearchPaging = xivdbSearchCategory.paging;
                var nextPage = (int)xivdbSearchPaging.page + 1;
                var totalPages = (int)xivdbSearchPaging.total;
                if (nextPage <= totalPages)
                {
                    var url = originUrl + "&one=" + category + "&page=" + nextPage;
                    var requestStr = Request(url);
                    var nextXivdbSearchResponse = (JObject)JsonConvert.DeserializeObject(requestStr);
                    ProcessResponse(nextXivdbSearchResponse, patch, originUrl);
                }
            }
        }

        private static string MapXivdbCategoryToType(string category)
        {
            if (category == "enemies")
                return "mob";

            return category.Substring(0, category.Length - 1);
        }

        private void WritePatches()
        {
            if (!Directory.Exists("output"))
                Directory.CreateDirectory("output");

            var contents = JsonConvert.SerializeObject(_patchData);
            contents = contents.Replace("},", "},\r\n");

            File.WriteAllText(Config.PatchesPath, contents, Encoding.UTF8);
        }
    }
}
