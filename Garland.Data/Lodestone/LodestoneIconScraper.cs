using Garland.Data.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SaintCoinach.Xiv;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web;

namespace Garland.Data.Lodestone
{
    public class LodestoneIconScraper : WebScraper
    {
        private const string _baseUrl = "http://na.finalfantasyxiv.com";
        private const string _baseItemIconUrl = "https://img.finalfantasyxiv.com/lds/pc/global/images/itemicon/";
        private const string _baseSearchFormat = _baseUrl + "/lodestone/playguide/db/item/?db_search_category=item&category2=&q={0}";
        private const string _itemUrlRegexFormat = "<a href=\"(/lodestone/playguide/db/item/.+)/\" .+>{0}</a>";
        private static Regex _iconSuffixRegex = new Regex("<img src=\"https://img.finalfantasyxiv.com/lds/pc/global/images/itemicon/(.*.png).*\".*>");

        public void FetchIcons()
        {
            // Run the process with an initial queue of items.
            var items = new Stack<Item>(ItemIconDatabase.ItemsNeedingIcons);
            while (items.Count > 0)
            {
                var item = items.Pop();

                if (!ItemIconDatabase.IconDataByItemId.TryGetValue(item.Key, out var data))
                {
                    data = new ItemIconData();
                    data.ItemId = item.Key;
                    data.RawIconKey = (UInt16)item.GetRaw("Icon");
                    data.Name = item.Name.ToString();
                    ItemIconDatabase.IconDataByItemId[item.Key] = data;
                }

                // Scrape search data from Lodestone.
                var itemUrl = SearchItem(item.Key, item.Name, data);
                string hash = null;
                if (itemUrl != null)
                    hash = FetchItem(item.Key, item.Name, itemUrl, data);

                if (hash == null)
                {
                    // This entry failed.  Enqueue an alternate to search for.
                    var alternate = ItemIconDatabase.DequeueAlternate(item.Icon);
                    if (alternate != null)
                       items.Push(alternate);
                    continue;
                }

                // Fetch the icon and write entries.
                WriteIcon(data, hash);
                WriteEntries();
            }
        }

        void WriteIcon(ItemIconData data, string hash)
        {
            var url = _baseItemIconUrl + hash;
            var bytes = RequestBytes(url);
            ItemIconDatabase.WriteNewIcon(data, bytes);
        }

        string SearchItem(int key, string name, ItemIconData data)
        {
            var url = string.Format(_baseSearchFormat, HttpUtility.UrlEncode(name));
            var itemUrlRegex = new Regex(string.Format(_itemUrlRegexFormat, SanitizeRegex(name)));

            var html = Request(url);
            
            var match = itemUrlRegex.Match(html);
            if (!match.Success || match.Groups.Count != 2)
            {
                DatabaseBuilder.PrintLine($"Search match fail on {key}: {name}");
                return null;
            }

            return _baseUrl + match.Groups[1].Value;
        }

        string FetchItem(int key, string name, string itemUrl, ItemIconData data)
        {
            var html = Request(itemUrl);

            var match = _iconSuffixRegex.Match(html);
            if (!match.Success || match.Groups.Count != 2)
            {
                DatabaseBuilder.PrintLine($"Fetch match fail on {key}: {name}");
                return null;
            }
            var iconSuffix = match.Groups[1].Value;

            var hash = match.Groups[1].Value;
            DatabaseBuilder.PrintLine($"{key}: {name} {hash}");
            return hash;
        }

        void WriteEntries()
        {
            var lines = ItemIconDatabase.IconDataByItemId.Values
                .Select(d => d.ToLine())
                .ToList();
            lines.Insert(0, "#ItemId    IconId  RawIconKey  Name");

            File.WriteAllLines(Config.SupplementalPath + "item-icon-db.tsv", lines, Encoding.UTF8);
        }

        static string SanitizeRegex(string name)
        {
            return name
                .Replace("(", "\\(")
                .Replace(")", "\\)");
        }
    }
}
