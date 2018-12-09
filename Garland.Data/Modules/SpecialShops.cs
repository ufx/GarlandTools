using Garland.Data.Models;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    // fixme: rename this to Shops
    public class SpecialShops : Module
    {
        List<GarlandShop> _shops = new List<GarlandShop>();
        Dictionary<int, GarlandShop> _shopsByKey;

        public override string Name => "Shops";

        public override void Start()
        {
            // Collect and index all shops to use.
            _shops.AddRange(GarlandShop.Convert(_builder.Sheet<Saint.GilShop>(), _builder));
            _shops.AddRange(GarlandShop.Convert(_builder.Sheet<Saint.SpecialShop>(), _builder));
            _shops.AddRange(GarlandShop.Convert(_builder.Sheet<Saint.GCShop>(), _builder));
            _shops.AddRange(GarlandShop.Convert(_builder.Sheet<Saint.FccShop>(), _builder));

            _shopsByKey = _shops.ToDictionary(s => s.Key);

            // Fill extra information on shop names and NPCs from chat tables and hacks.
            TopicSelectShops();
            CustomTalkShops();

            Hacks.SetManualShops(_builder.Realm, _shopsByKey);

            // FCC shop credit
            var fccredit = _builder.CreateItem("fccredit");
            fccredit.en = new JObject();
            fccredit.en.description = "Credits for the enrichment of an Eorzean free company.";
            fccredit.en.name = "Company Credit";
            fccredit.fr = new JObject();
            fccredit.fr.name = "Company Credit";
            fccredit.de = new JObject();
            fccredit.de.name = "Company Credit";
            fccredit.ja = new JObject();
            fccredit.ja.name = "Company Credit";
            fccredit.ilvl = 1;
            fccredit.category = 63; // Other
            fccredit.icon = "custom/fccredit";

            // Convert them.
            foreach (var shop in _shops)
                ConvertShop(shop);
        }

        void TopicSelectShops()
        {
            foreach (var sTopicSelect in _builder.Sheet("TopicSelect"))
            {
                var sNpcs = sTopicSelect.Sheet.Collection.ENpcs.FindWithData(sTopicSelect.Key).ToArray();
                if (sNpcs.Length == 0)
                    continue;

                for (var i = 0; i < 10; i++)
                {
                    var sShop = (Saint.IXivRow)sTopicSelect["Shop[" + i + "]"];
                    if (sShop == null || sShop.Key == 0)
                        continue;

                    if (sShop is Saint.SpecialShop sSpecialShop)
                    {
                        var shop = _shopsByKey[sShop.Key];
                        shop.ENpcs = sNpcs;
                    }
                    else if (sShop is Saint.GilShop sGilShop)
                    {
                        var fullName = sTopicSelect["Name"].ToString() + "<br>" + sGilShop.Name.ToString();
                        _shops.Add(new GarlandShop(fullName, sNpcs, sGilShop.Items));
                    }
                    else
                        throw new NotImplementedException();
                }
            }
        }

        void CustomTalkShops()
        {
            foreach (var sCustomTalk in _builder.Sheet("CustomTalk"))
            {
                var instructions = ScriptInstruction.Read(sCustomTalk, 30);

                var shopInstructions = instructions.Where(i => i.Label.Contains("SHOP") && !i.Label.Contains("LOGMSG")).ToArray();
                if (shopInstructions.Length == 0)
                    continue;

                var sNpcs = sCustomTalk.Sheet.Collection.ENpcs.FindWithData(sCustomTalk.Key).ToArray();
                if (sNpcs.Length == 0)
                    continue;

                foreach (var shopInstruction in shopInstructions)
                {
                    var shopKey = (int)shopInstruction.Argument;
                    if (Hacks.ExcludedShops.Contains(shopKey))
                        continue;

                    // Setup a disposal shop.
                    if (shopInstruction.Label == "SHOP_DISPOSAL")
                    {
                        DisposalShops.BuildShop(_builder, sNpcs, (int)shopInstruction.Argument);
                        continue;
                    }

                    // Missing shop definitions?
                    if (!_shopsByKey.TryGetValue(shopKey, out var shop))
                    {
                        // todo: print relevant NPCs, text?
                        DatabaseBuilder.PrintLine($"Shop {shopKey} not found, skipping.");
                        continue;
                    }

                    if (shop.Name == "Unknown Shop")
                    {
                        var name = Hacks.GetShopName((SaintCoinach.Text.XivString)sCustomTalk.GetRaw("Name"), shopInstruction);
                        if (name.Contains("[not in Saint]"))
                        {
                            DatabaseBuilder.PrintLine($"{string.Join(", ", sNpcs.Select(e => e.Singular.ToString()))} has shop {name}");
                            continue;
                        }
                        shop.Name = name;
                    }

                    shop.ENpcs = sNpcs.Union(shop.ENpcs).Distinct().ToArray();
                }
            }
        }

        void ConvertShop(GarlandShop gShop)
        {
            if (gShop.GtShopListings.Count == 0)
                return;

            if (Hacks.ExcludedShops.Contains(gShop.Key))
                return;

            // Create the NPCs to use.
            List<dynamic> npcs = new List<dynamic>();
            foreach (var sNpc in gShop.ENpcs)
                npcs.Add(_builder.GetOrCreateNpc(sNpc));

            // Shortcut for gil shops.
            if (gShop.GtShopListings.All(l => l.Costs.All(c => c.Item.Key == 1)))
            {
                foreach (var npc in npcs)
                    _builder.CreateNpcGilShop(gShop, npc);
                return;
            }

            // Build entries for trade shops.
            var shop = _builder.CreateShop(gShop.Name, null, true);
            foreach (var listing in gShop.GtShopListings.ToArray())
            {
                var isValid = true;

                if (listing.Costs.Any(c => c.ItemKey.HasValue && !_builder.Db.ItemsById.ContainsKey(c.ItemKey.Value)))
                    isValid = false;

                if (listing.Rewards.Any(r => r.ItemKey.HasValue && !_builder.Db.ItemsById.ContainsKey(r.ItemKey.Value)))
                    isValid = false;

                if (!isValid)
                {
                    var costNames = listing.Costs.Select(c => c.Count + " " + ((c.ItemKey.HasValue && _builder.Db.ItemsById.ContainsKey(c.ItemKey.Value)) ? _builder.Db.ItemsById[c.ItemKey.Value].en.name : c.ItemId));
                    var rewardNames = listing.Rewards.Select(c => c.Count + " " + ((c.ItemKey.HasValue && _builder.Db.ItemsById.ContainsKey(c.ItemKey.Value)) ? _builder.Db.ItemsById[c.ItemKey.Value].en.name : c.ItemId));
                    DatabaseBuilder.PrintLine($"Placeholder in '{shop.name}': {string.Join(", ", costNames)} -> {string.Join(", ", rewardNames)}");
                    gShop.GtShopListings.Remove(listing);
                    continue;
                }

                // Add the listing to the shop.
                shop.entries.Add(_builder.CreateShopEntry(listing.Costs, listing.Rewards));
            }
            gShop.AddItemTrades(_builder);

            // Add the shop to each npc.
            // Can't do it above because the shop is copied.
            foreach (var npc in npcs)
            {
                npc.trade = 1;

                if (npc.shops == null)
                    npc.shops = new JArray();
                npc.shops.Add(shop);
            }
        }
    }
}
