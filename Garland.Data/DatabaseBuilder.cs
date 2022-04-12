using Garland.Data.Models;
using Garland.Data.Modules;
using Garland.Data.Output;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data
{
    public class DatabaseBuilder
    {
        SaintCoinach.ARealmReversed _realm;
        GarlandDatabase _db;
        ItemIconDatabase _itemIconDatabase;
        SQLite.SQLiteConnection _libra;

        #region Builder state - to organize
        static Dictionary<long, JArray> _bossCurrency = new Dictionary<long, JArray>();

        public Dictionary<long, List<int>> ItemDropsByMobId = new Dictionary<long, List<int>>();
        public Dictionary<long, int> InstanceIdsByMobId = new Dictionary<long, int>();
        public int[] TomestoneIds = new int[3];
        #endregion

        public SQLite.SQLiteConnection Libra => _libra;
        public Localize Localize;
        public SaintCoinach.ARealmReversed Realm => _realm;
        public GarlandDatabase Db => _db;
        public ItemIconDatabase ItemIconDatabase => _itemIconDatabase;
        public Saint.Item[] ItemsToImport;
        public Dictionary<int, LocationInfo> LocationInfoByMapId = new Dictionary<int, LocationInfo>();
        public Dictionary<int, string> EmoteNamesById = new Dictionary<int, string>();
        public Dictionary<int, List<MapMarker>> MapMarkersByMapKey = new Dictionary<int, List<MapMarker>>();
        public Dictionary<Saint.InstanceContent, Saint.ContentFinderCondition> ContentFinderConditionByInstanceContent = new Dictionary<Saint.InstanceContent, Saint.ContentFinderCondition>();
        public static IPrinter Printer;

        public DatabaseBuilder(SQLite.SQLiteConnection libra, SaintCoinach.ARealmReversed realm)
        {
            _db = GarlandDatabase.Instance;
            _libra = libra;
            _realm = realm;
            Localize = new Localize(realm);
            _instance = this;
        }

        static DatabaseBuilder _instance;
        public static DatabaseBuilder Instance => _instance;

        public void Build(bool fetchIconsOnly)
        {
            OneTimeExports.Run(_realm);

            // Miscellaneous initialization
            _itemIconDatabase = new ItemIconDatabase(this);

            ItemsToImport = Sheet<Saint.Item>()
                .Where(i => !Hacks.IsItemSkipped(i.Name, i.Key))
                .ToArray();

            _itemIconDatabase.Initialize(ItemsToImport);

            if (fetchIconsOnly)
            {
                new Lodestone.LodestoneIconScraper(_itemIconDatabase).FetchIcons();
                PrintLine("All icons fetched.  Stopping.");
                return;
            }

            FileDatabase.Initialize();
            PatchDatabase.Initialize();

            var itemSourceComplexityModule = new ItemSourceComplexity();

            // All the modules.
            var modules = new Queue<Module>(new Module[]
            {
                new Indexes(),
                new Miscellaneous(),
                new Locations(),
                new Items(),
                //new ItemSets(),
                new Orchestrion(),
                new Actions(),
                new Statuses(),
                new Emotes(),
                new Weather(),
                new Instances(),
                new Nodes(),
                new NPCs(),
                new SpecialShops(),
                new DisposalShops(),
                new Recipes(),
                new Specializations(),
                new Mounts(),
                new Minions(),
                new Furniture(),
                new TripleTriad(),
                new Customize(),
                new Mobs(),
                new Quests(),
                new Talk(),
                new FishingSpots(),
                new Leves(),
                new Achievements(),
                new Fates(),
                new JobCategories(),
                new Ventures(),
                new Materia(),
                new WondrousTails(),
                new OtherItemSources(),
                new OtherItemInfo(),
                new Relics(),
                itemSourceComplexityModule,
                new SupplyDuties(itemSourceComplexityModule),
                new Maps(),
                new Territories(),
                new EquipmentScorer(),
                new Jobs(),
                new Dyes(),
                new NpcEquipment(itemSourceComplexityModule),
                new StatisticsModule(itemSourceComplexityModule),
            });

            itemSourceComplexityModule = null;

            var total = modules.Count;
            while (modules.Count > 0)
            {
                var module = modules.Dequeue();
                PrintLine($"* {module.Name}... {total - modules.Count}/{total}");
                module.Start();
            }
        }

        public void CreateNpcGilShop(GarlandShop gShop, dynamic npc)
        {
            var shopName = gShop.Name == "Shop" ? "Purchase Items" : gShop.Name;
            var shop = CreateShop(shopName, npc, false);
            if (shop == null)
                return; // Skipped.

            var npcId = (int)npc.id;
            foreach (var sItem in gShop.GtShopListings.SelectMany(l => l.Rewards.Select(r => r.Item)))
            {
                if (!_db.ItemsById.TryGetValue(sItem.Key, out var item))
                {
                    if (!string.IsNullOrWhiteSpace(sItem.Name))
                        DatabaseBuilder.PrintLine($"Skipping shop item: {sItem.Name}");
                    continue;
                }

                JArray vendors = item.vendors;
                if (vendors == null)
                    item.vendors = vendors = new JArray();

                if (!vendors.Any(i => (int)i == npcId))
                {
                    item.vendors.Add(npcId);
                    Db.AddReference(item, "npc", npcId, true);
                }

                shop.entries.Add(sItem.Key);
                Db.AddReference(npc, "item", sItem.Key, false);
            }
        }

        public dynamic CreateShop(string name, dynamic npc, bool isTrade)
        {
            // Check this isn't a duplicate shop on the npc.
            if (npc != null && npc.shops != null)
            {
                foreach (dynamic existingShop in npc.shops)
                {
                    if (existingShop.name == name)
                    {
                        //DatabaseBuilder.Print(string.Format("Skipping duplicate shop name {0} on {1}", name, (string)npc.name));
                        return null;
                    }
                }
            }

            // Create the shop.
            dynamic shop = new JObject();
            shop.name = name;
            shop.entries = new JArray();
            if (isTrade)
                shop.trade = 1;

            if (npc != null)
            {
                // Add the shop to this npc.
                if (npc.shops == null)
                    npc.shops = new JArray();
                npc.shops.Add(shop);
            }

            return shop;
        }

        public dynamic CreateShopEntry(List<GtShopListingItem> currency, List<GtShopListingItem> item)
        {
            dynamic entry = new JObject();

            entry.item = new JArray();
            foreach (var i in item)
                entry.item.Add(CreateShopListingItem(i));

            entry.currency = new JArray();
            foreach (var c in currency)
                entry.currency.Add(CreateShopListingItem(c));

            return entry;
        }

        private dynamic CreateShopListingItem(GtShopListingItem listingItem)
        {
            dynamic item = new JObject();
            item.id = listingItem.ItemId;
            item.amount = listingItem.Count;

            if (listingItem.IsHq)
                item.hq = 1;

            if (listingItem.CollectabilityRating > 0)
                item.collectability = listingItem.CollectabilityRating;

            return item;
        }

        public JArray GetCoords(Saint.Level level)
        {
            var x = Math.Round(level.MapX, 2);
            var y = Math.Round(level.MapY, 2);
            return new JArray(x, y);
        }

        public void AddBossCurrency(int amount, int currencyId, long mobId)
        {
            if (amount == 0)
                return;

            if (currencyId == 0)
                throw new ArgumentException("Bad currencyId", "currencyId");

            if (!_bossCurrency.TryGetValue(mobId, out var list))
            {
                list = new JArray();
                _bossCurrency[mobId] = list;
            }

            dynamic obj = new JObject();
            obj.amount = amount;
            obj.id = currencyId;
            list.Add(obj);
        }

        public JArray GetBossCurrency(long mobId)
        {
            return _bossCurrency.TryGetValue(mobId, out var result) ? result : null;
        }

        public dynamic CreateItem(object id)
        {
            dynamic item = new JObject();
            item.id = id;

            _db.Items.Add(item);
            _db.ItemsById[id] = item;
            return item;
        }

        public void UpgradeItem(dynamic downgrade, dynamic upgrade)
        {
            if (downgrade == null || upgrade == null || downgrade == upgrade)
                return;

            if (downgrade.upgrades == null)
                downgrade.upgrades = new JArray();
            JArray upgrades = downgrade.upgrades;
            if (!upgrades.Any(i => (int)i == (int)upgrade.id))
                upgrades.Add(upgrade.id);

            if (upgrade.downgrades == null)
                upgrade.downgrades = new JArray();
            JArray downgrades = upgrade.downgrades;
            if (!downgrades.Any(i => (int)i == (int)downgrade.id))
                downgrades.Add(downgrade.id);

            Db.AddReference(downgrade, "item", (int)upgrade.id, false);
            Db.AddReference(upgrade, "item", (int)downgrade.id, false);
        }

        public static void PrintLine(string str)
        {
            Printer.PrintLine(str);
            System.Diagnostics.Debug.WriteLine(str);
        }

        #region Sheet Helpers
        public Saint.IXivSheet<T> Sheet<T>() where T : Saint.IXivRow
        {
            return Realm.GameData.GetSheet<T>();
        }

        public Saint.IXivSheet<T> Sheet<T>(string name) where T : Saint.IXivRow
        {
            return Realm.GameData.GetSheet<T>(name);
        }

        public Saint.IXivSheet<Saint.XivRow> Sheet(string name)
        {
            return Realm.GameData.GetSheet(name);
        }

        public Saint.XivSheet2<Saint.XivSubRow> Sheet2(string name)
        {
            return Realm.GameData.GetSheet2(name);
        }
        #endregion
    }
}
