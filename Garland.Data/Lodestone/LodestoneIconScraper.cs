using Garland.Data.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Saint = SaintCoinach.Xiv;
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
        private const string _baseSearchFormat = _baseUrl + "/lodestone/playguide/db/item/?db_search_category=item&category2=&q=\"{0}\"";
        private const string _itemUrlRegexFormat = "<a href=\"(/lodestone/playguide/db/item/.+)/\" .+>{0}</a>";
        private static Regex _iconSuffixRegex = new Regex("<img src=\"https://img.finalfantasyxiv.com/lds/pc/global/images/itemicon/(.*.png).*\".*>");
        private ItemIconDatabase _itemIconDatabase;

        public LodestoneIconScraper(ItemIconDatabase itemIconDatabase)
        {
            _itemIconDatabase = itemIconDatabase;
        }

        public void FetchIcons()
        {
            // Start at a random place in the set.
            var start = (new Random()).Next(_itemIconDatabase.ItemsNeedingIcons.Count);
            var itemsToFetch = new List<Saint.Item>(_itemIconDatabase.ItemsNeedingIcons.Skip(start));
            itemsToFetch.AddRange(_itemIconDatabase.ItemsNeedingIcons.Take(start));

            var count = 0;
            var options = new ParallelOptions() { MaxDegreeOfParallelism = 2 };
            Parallel.ForEach(itemsToFetch, options, sItem =>
            {
                var num = Interlocked.Increment(ref count);

                // A prior item may share this icon, so always check if it was written.
                var iconId = (UInt16)sItem.GetRaw("Icon");
                if (_itemIconDatabase.HasIcon(iconId))
                    return;

                var progress = $"{num}/{itemsToFetch.Count}, {100*num/itemsToFetch.Count}%";

                // Scrape search data from Lodestone.
                var itemUrl = SearchItem(iconId, sItem.Name, progress);
                string hash = null;
                if (itemUrl != null)
                    hash = FetchItem(iconId, sItem.Name, itemUrl, progress);

                if (hash == null)
                {
                    // Can't find this entry.  Move on.
                    return;
                }

                // Fetch the icon and write entries.
                WriteIcon(iconId, hash);
            });
        }

        void WriteIcon(UInt16 iconId, string hash)
        {
            var url = _baseItemIconUrl + hash;
            var bytes = RequestBytes(url);
            _itemIconDatabase.WriteIcon(iconId, bytes);
        }

        string SearchItem(UInt16 iconId, string name, string progress)
        {
            var url = string.Format(_baseSearchFormat, HttpUtility.UrlEncode(name));
            var itemUrlRegex = new Regex(string.Format(_itemUrlRegexFormat, SanitizeRegex(name)));

            var html = Request(url);

            var match = itemUrlRegex.Match(html);
            if (!match.Success || match.Groups.Count != 2)
            {
                DatabaseBuilder.PrintLine($"Search match fail on {iconId}: {name} ({progress})");
                return null;
            }

            return _baseUrl + match.Groups[1].Value;
        }

        string FetchItem(int iconId, string name, string itemUrl, string progress)
        {
            var html = Request(itemUrl);

            var match = _iconSuffixRegex.Match(html);
            if (!match.Success || match.Groups.Count != 2)
            {
                DatabaseBuilder.PrintLine($"Fetch match fail on {iconId}: {name} ({progress})");
                return null;
            }
            var iconSuffix = match.Groups[1].Value;

            var hash = match.Groups[1].Value;
            DatabaseBuilder.PrintLine($"{iconId}: {name} {hash} ({progress})");
            return hash;
        }

        static string SanitizeRegex(string name)
        {
            return name
                .Replace("(", "\\(")
                .Replace(")", "\\)");
        }
    }
}
