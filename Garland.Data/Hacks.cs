using Garland.Data.Models;
using Newtonsoft.Json.Linq;
using SaintCoinach.Xiv;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data
{
    public static class Hacks
    {
        public static HashSet<int> ExcludedShops = new HashSet<int>() {
            1769474, // Currency Test
            1769475, // Materia Test
            1769524, // Items in Development
        };

        public static HashSet<int> NoModelCategories = new HashSet<int>()
        {
            33, // Fishing Tackle
            39, // Waist
            62  // Job Soul
        };

        public static string GetShopName(ScriptInstruction si)
        {
            if (si.Label.Contains("FCCSHOP"))
                return "Spend company credits (items)";
            else if (si.Label == "MOBSHOP1")
                return "Exchange Centurio Seals";
            else if (si.Label == "MOBSHOP2")
                return "Exchange Centurio Seals (Advanced)";
            else if (si.Label == "SHOP_SPOIL")
                return "Exchange Spoils";
            else if (si.Label == "SPECIAL_SHOP0" && si.Argument == 1769813)
                return "Achievement Rewards";
            else if (si.Label == "SPECIAL_SHOP1" && si.Argument == 1769845)
                return "Achievement Rewards 2";
            else if (si.Label == "SPECIAL_SHOP2" && si.Argument == 1769846)
                return "Achievement Rewards 3";
            else if (si.Label == "SHOP_0" && si.Argument == 1769842)
                return "Gold Certificates of Commendation";
            else if (si.Label == "SHOP_1" && si.Argument == 1769841)
                return "Silver Certificates of Commendation";
            else if (si.Label == "SHOP_2" && si.Argument == 1769956)
                return "Bronze Certificates of Commendation";
            else if (si.Label == "SHOP" && si.Argument == 1769812)
                return "PVP Rewards";
            else if (si.Label == "REPLICA_SHOP0" && si.Argument == 262918)
                return "Purchase a Eureka weapon replica (DoW).";
            else if (si.Label == "REPLICA_SHOP1" && si.Argument == 262922)
                return "Purchase a Eureka weapon replica (DoM).";
            else if (si.Label == "FREE_SHOP_BATTLE" && si.Argument == 1769898)
                return "Battle Achievement Rewards";
            else if (si.Label == "FREE_SHOP_PVP" && si.Argument == 1769899)
                return "PvP Achievement Rewards";
            else if (si.Label == "FREE_SHOP_CHARACTER" && si.Argument == 1769900)
                return "Character Achievement Rewards";
            else if (si.Label == "FREE_SHOP_ITEM" && si.Argument == 1769901)
                return "Item Achievement Rewards";
            else if (si.Label == "FREE_SHOP_CRAFT" && si.Argument == 1769902)
                return "Crafting Achievement Rewards";
            else if (si.Label == "FREE_SHOP_GATHERING" && si.Argument == 1769903)
                return "Gathering Achievement Rewards";
            else if (si.Label == "FREE_SHOP_QUEST" && si.Argument == 1769904)
                return "Quest Achievement Rewards";
            else if (si.Label == "FREE_SHOP_EXPLORATION" && si.Argument == 1769905)
                return "Exploration Achievement Rewards";
            else if (si.Label == "FREE_SHOP_GRANDCOMPANY" && si.Argument == 1769906)
                return "Grand Company Achievement Rewards";
            else
            {
                DatabaseBuilder.PrintLine($"Unknown shop label {si.Label}, arg {si.Argument}.");
                return si.Label;
            }
        }

        public static bool IsItemSkipped(string name, int key)
        {
            switch (key)
            {
                case 17557: // Dated Radz-at-Han Coin
                    return false;

                case 22357: // Wrapped Present (no icon)
                    return true;
            }

            if (name.Length == 0)
                return true;

            if (name.StartsWith("Dated"))
                return true;

            return false;
        }

        public static bool IsNpcSkipped(ENpc sNpc)
        {
            if (sNpc.Resident == null)
                return true;

            if (string.IsNullOrWhiteSpace(sNpc.Resident.Singular))
                return true;

            return false;
        }

        public static void SetManualShops(SaintCoinach.ARealmReversed realm, Dictionary<int, GarlandShop> shopsByKey)
        {
            var sENpcs = realm.GameData.ENpcs;

            // Special Shops
            var syndony = sENpcs[1016289];
            shopsByKey[1769635].ENpcs = new ENpc[] { syndony };

            var eunakotor = new ENpc[] { sENpcs[1017338] };
            shopsByKey[1769675].ENpcs = eunakotor;
            shopsByKey[1769869].Fill("Request to keep your aetherpool gear", eunakotor);

            var disreputablePriest = new ENpc[] { sENpcs[1018655] };
            shopsByKey[1769743].Fill("Exchange Wolf Marks (Melee)", disreputablePriest);
            shopsByKey[1769744].Fill("Exchange Wolf Marks (Ranged)", disreputablePriest);

            var eurekaGerolt = new ENpc[] { sENpcs[1025047] };
            shopsByKey[1769820].Fill("Create or augment Eureka gear. (Paladin)", eurekaGerolt);
            shopsByKey[1769821].Fill("Create or augment Eureka gear. (Warrior)", eurekaGerolt);
            shopsByKey[1769822].Fill("Create or augment Eureka gear. (Dark Knight)", eurekaGerolt);
            shopsByKey[1769823].Fill("Create or augment Eureka gear. (Dragoon)", eurekaGerolt);
            shopsByKey[1769824].Fill("Create or augment Eureka gear. (Monk)", eurekaGerolt);
            shopsByKey[1769825].Fill("Create or augment Eureka gear. (Ninja)", eurekaGerolt);
            shopsByKey[1769826].Fill("Create or augment Eureka gear. (Samurai)", eurekaGerolt);
            shopsByKey[1769827].Fill("Create or augment Eureka gear. (Bard)", eurekaGerolt);
            shopsByKey[1769828].Fill("Create or augment Eureka gear. (Machinist)", eurekaGerolt);
            shopsByKey[1769829].Fill("Create or augment Eureka gear. (Black Mage)", eurekaGerolt);
            shopsByKey[1769830].Fill("Create or augment Eureka gear. (Summoner)", eurekaGerolt);
            shopsByKey[1769831].Fill("Create or augment Eureka gear. (Red Mage)", eurekaGerolt);
            shopsByKey[1769832].Fill("Create or augment Eureka gear. (White Mage)", eurekaGerolt);
            shopsByKey[1769833].Fill("Create or augment Eureka gear. (Scholar)", eurekaGerolt);
            shopsByKey[1769834].Fill("Create or augment Eureka gear. (Astrologian)", eurekaGerolt);

            var confederateCustodian = new ENpc[] { sENpcs[1025848] };
            shopsByKey[1769871].Fill("Exchange artifacts", confederateCustodian);
            shopsByKey[1769870].Fill("Request to keep your empyrean aetherpool gear", confederateCustodian);

            // Gil Shops
            var domanJunkmonger = new ENpc[] { sENpcs[1025763] };
            shopsByKey[262919].ENpcs = domanJunkmonger;

            // Gemstone Traders
            shopsByKey[1769957].ENpcs = new ENpc[] { sENpcs[1027998] }; // Gramsol, Crystarium
            shopsByKey[1769958].ENpcs = new ENpc[] { sENpcs[1027538] }; // Pedronille, Eulmore
            shopsByKey[1769959].ENpcs = new ENpc[] { sENpcs[1027385] }; // Siulmet, Lakeland
            shopsByKey[1769960].ENpcs = new ENpc[] { sENpcs[1027497] }; // ??, Kholusia
            shopsByKey[1769961].ENpcs = new ENpc[] { sENpcs[1027892] }; // Halden, Amh Araeng
            shopsByKey[1769962].ENpcs = new ENpc[] { sENpcs[1027665] }; // Sul Lad, Il Mheg
            shopsByKey[1769963].ENpcs = new ENpc[] { sENpcs[1027709] }; // Nacille, Rak'tika
            shopsByKey[1769964].ENpcs = new ENpc[] { sENpcs[1027766] }; // ??, Tempest
        }

        public static bool IsMainAttribute (string attribute)
        {
            switch (attribute)
            {
                case "Strength":
                case "Dexterity":
                case "Vitality":
                case "Intelligence":
                case "Mind":
                case "Piety":
                    return true;
            }

            return false;
        }

        public static void CreateDiademNodes(GarlandDatabase db)
        {
            //dynamic mining = new JObject();
            //mining.id = 10000;
            //mining.type = 0;
            //mining.lvl = 60;
            //mining.name = "Node";
            //mining.zoneid = -2;
            //mining.items = new JArray(CreateNodeItem(12534), CreateNodeItem(12537), CreateNodeItem(12535), CreateNodeItem(13750));
            //db.Nodes.Add(mining);

            //dynamic quarrying = new JObject();
            //quarrying.id = 10001;
            //quarrying.type = 1;
            //quarrying.lvl = 60;
            //quarrying.name = "Node";
            //quarrying.zoneid = -2;
            //quarrying.items = new JArray(CreateNodeItem(13751));
            //db.Nodes.Add(quarrying);

            //dynamic logging = new JObject();
            //logging.id = 10001;
            //logging.type = 2;
            //logging.lvl = 60;
            //logging.name = "Node";
            //logging.zoneid = -2;
            //logging.items = new JArray(CreateNodeItem(12586), CreateNodeItem(12891), CreateNodeItem(12579), CreateNodeItem(13752));
            //db.Nodes.Add(logging);

            //dynamic harvesting = new JObject();
            //harvesting.id = 10002;
            //harvesting.type = 3;
            //harvesting.lvl = 60;
            //harvesting.name = "Node";
            //harvesting.zoneid = -2;
            //harvesting.items = new JArray(CreateNodeItem(12879), CreateNodeItem(12878), CreateNodeItem(13753));
            //db.Nodes.Add(harvesting);
        }

        private static dynamic CreateNodeItem(int itemId)
        {
            dynamic obj = new JObject();
            obj.id = itemId;
            return obj;
        }

        public static void SetInstanceIcon(ContentFinderCondition sContentFinderCondition, dynamic obj)
        {
            if (sContentFinderCondition.Content.Key == 55001)
            {
                // Aquapolis
                obj.fullIcon = 1;
                return;
            }

            if (sContentFinderCondition.Content.Key == 55002)
            {
                // Lost Canals of Uznair
                obj.fullIcon = 2;
                return;
            }

            if (sContentFinderCondition.Content.Key == 55003)
            {
                // Hidden Canals of Uznair
                obj.fullIcon = 3;
                return;
            }

            if (sContentFinderCondition.Image.Path.EndsWith("000000.tex"))
            {
                DatabaseBuilder.PrintLine($"Content {sContentFinderCondition.Content.Key} {sContentFinderCondition.Content} has no icon");
                return;
            }

            obj.fullIcon = IconDatabase.EnsureEntry("instance", sContentFinderCondition.Image);
        }

        public static string GetContentTypeNameOverride(ContentType sContentType)
        {
            switch (sContentType.Key)
            {
                case 20: return "Novice Hall";
                case 22: return "Seasonal Dungeon";
                case 23: return "Airship Expedition";
                case 27: return "The Masked Carnivale"; // fixme: verify this when content is released
            }

            throw new InvalidOperationException($"Invalid missing ContentType override for {sContentType}.");
        }

        public static string GetCategoryDamageAttribute(SaintCoinach.Xiv.ItemUICategory category)
        {
            // This needs to be maintained when new ClassJobs are added, usually
            // in an expansion.

            switch (category.Key)
            {
                case 1: // Pugilist's Arm
                case 2: // Gladiator's Arm
                case 3: // Marauder's Arm
                case 4: // Archer's Arm
                case 5: // Lancer's Arm
                case 12: // Carpenter's Primary Tool
                case 14: // Blacksmith's Primary Tool
                case 16: // Armorer's Primary Tool
                case 18: // Goldsmith's Primary Tool
                case 20: // Leatherworker's Primary Tool
                case 22: // Weaver's Primary Tool
                case 24: // Alchemist's Primary Tool
                case 26: // Culinarian's Primary Tool
                case 28: // Miner's Primary Tool
                case 30: // Botanist's Primary Tool
                case 32: // Fisher's Primary Tool
                case 84: // Rogue's Arms
                case 87: // Dark Knight's Arm
                case 88: // Machinist's Arm
                case 96: // Samurai's Arm
                    return "Physical Damage";

                case 6: // One–handed Thaumaturge's Arm
                case 7: // Two–handed Thaumaturge's Arm
                case 8: // One–handed Conjurer's Arm
                case 9: // Two–handed Conjurer's Arm
                case 10: // Arcanist's Grimoire
                case 89: // Astrologian's Arm
                case 97: // Red Mage's Arm
                case 98: // Scholar's Arm
                case 105: // Blue Mage's Arm
                    return "Magic Damage";

                default:
                    return null;
            }
        }
    }
}
