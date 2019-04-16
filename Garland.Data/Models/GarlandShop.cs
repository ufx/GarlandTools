using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Models
{
    public class GarlandShop
    {
        public int Key { get; set; }
        public string Name { get; set; }
        public IEnumerable<Saint.ENpc> ENpcs { get; set; }
        public List<GtShopListing> GtShopListings { get; set; }

        public GarlandShop(string name, IEnumerable<Saint.ENpc> enpcs, IEnumerable<Saint.IShopListing> listings)
        {
            Name = string.IsNullOrEmpty(name) ? "Shop" : name;
            ENpcs = enpcs;
            GtShopListings = listings.Select(l => new GtShopListing(l)).ToList();
        }

        public GarlandShop(Saint.IShop shop)
            : this(shop.Name, shop.ENpcs, shop.ShopListings) { }

        public static IEnumerable<GarlandShop> Convert(IEnumerable<Saint.IShop> sShops, DatabaseBuilder builder)
        {
            var results = new List<GarlandShop>();
            foreach (var sShop in sShops)
            {
                var shop = new GarlandShop(sShop.Name, sShop.ENpcs, FilterListings(sShop.ShopListings, builder));
                shop.Key = sShop.Key;
                results.Add(shop);
            }
            return results;
        }

        static IEnumerable<Saint.IShopListing> FilterListings(IEnumerable<Saint.IShopListing> sShopListings, DatabaseBuilder builder)
        {
            return sShopListings.Where(l => !IsFilteredShopListing(l, builder));
        }

        static bool IsFilteredShopListing(Saint.IShopListing sShopListing, DatabaseBuilder builder)
        {
            if (sShopListing.Costs.Any(li => builder.Db.IgnoredCurrencyItemIds.Contains(li.Item.Key)))
                return true;

            if (sShopListing.Rewards.Any(li => builder.Db.IgnoredCurrencyItemIds.Contains(li.Item.Key)))
                return true;

            return false;
        }

        public void AddItemTrades(DatabaseBuilder builder)
        {
            foreach (var listing in GtShopListings)
            {
                var relatedItemIds = listing.Costs.Union(listing.Rewards)
                    .Select(l => l.ItemId)
                    .Distinct()
                    .ToArray();

                foreach (var itemId in relatedItemIds)
                    AddItemTrades(builder, itemId, relatedItemIds, listing);
            }
        }

        void AddItemTrades(DatabaseBuilder builder, string itemId, string[] relatedItemIds, GtShopListing listing)
        {
            // Trade structure {
            //   shop: shopName,
            //   npcs: [ npc id  1, npc id 2, ... ],
            //   listings: [ { shop entry 1 }, ... ]
            // }

            object itemKey = itemId;
            if (int.TryParse(itemId, out var itemNumber))
                itemKey = itemNumber;

            if (!builder.Db.ItemsById.TryGetValue(itemKey, out var item))
                throw new InvalidOperationException();

            // Find the side this trade item is on in the trade.
            JArray trades;
            if (listing.Costs.Any(l => l.ItemId == itemId))
            {
                if (item.tradeCurrency == null)
                    item.tradeCurrency = new JArray();
                trades = item.tradeCurrency;
            }
            else if (listing.Rewards.Any(l => l.ItemId == itemId))
            {
                if (item.tradeShops == null)
                    item.tradeShops = new JArray();
                trades = item.tradeShops;
            }
            else
                throw new InvalidOperationException("No visible trades");

            // Find the shop name in this trade array.
            dynamic shop = trades.FirstOrDefault(t => (string)t["shop"] == Name);
            if (shop == null)
            {
                shop = new JObject();
                shop.shop = Name;
                shop.npcs = new JArray();
                shop.listings = new JArray();
                trades.Add(shop);
            }

            // Add related NPCs.
            foreach (var sNpc in ENpcs)
            {
                var npc = builder.Db.NpcsById[sNpc.Key];
                builder.Db.AddReference(item, "npc", sNpc.Key, true);
                builder.Db.AddReference(npc, "item", relatedItemIds, false);

                JArray shopNpcs = shop.npcs;
                if (!shopNpcs.Any(t => (int)t == sNpc.Key))
                    shopNpcs.Add(sNpc.Key);
            }

            // Finally, add the shop listing.
            var entry = builder.CreateShopEntry(listing.Costs, listing.Rewards);
            if (!HasShopEntry((JArray)shop.listings, entry))
            {
                var otherItemIds = relatedItemIds.Where(id => id != itemId);
                builder.Db.AddReference(item, "item", otherItemIds, true);
                shop.listings.Add(entry);
            }
        }

        static bool HasShopEntry(JArray entries, dynamic entry)
        {
            var entryJson = JsonConvert.SerializeObject(entry);

            foreach (dynamic entry2 in entries)
            {
                var entry2Json = JsonConvert.SerializeObject(entry2);
                if (entryJson == entry2Json)
                    return true;
            }

            return false;
        }

        public void Fill(string name, Saint.ENpc[] npcs)
        {
            Name = name;
            ENpcs = npcs;
        }

        public override string ToString()
        {
            return Name + " (" + GtShopListings.Count + " listings)";
        }
    }

    public class GtShopListing
    {
        public List<GtShopListingItem> Costs { get; set; }
        public List<GtShopListingItem> Rewards { get; set; }

        public GtShopListing() { }

        public GtShopListing(Saint.IShopListing sShopListing)
        {
            Costs = sShopListing.Costs.Select(s => new GtShopListingItem(s)).ToList();
            Rewards = sShopListing.Rewards.Select(s => new GtShopListingItem(s)).ToList();
        }
    }

    public class GtShopListingItem
    {
        public GtShopListingItem(Saint.IShopListingItem sShopListingItem)
            : this(sShopListingItem.Count, sShopListingItem.Item.Key, sShopListingItem.IsHq, sShopListingItem.CollectabilityRating)
        {
            Item = sShopListingItem.Item;
        }

        public GtShopListingItem(int count, int itemKey, bool isHq, int collectabilityRating)
        {
            if (itemKey == 6559)
            {
                // Use the special fccredit item when the company chest appears.
                ItemId = "fccredit";
            }
            else
            {
                ItemKey = itemKey;
                ItemId = itemKey.ToString();
            }

            Count = count;
            IsHq = isHq;
            CollectabilityRating = collectabilityRating;
        }

        public int Count { get; set; }
        public bool IsHq { get; set; }
        public string ItemId { get; set; }
        public int? ItemKey { get; set; }
        public int CollectabilityRating { get; set; }
        public Saint.Item Item { get; set; }
    }
}
