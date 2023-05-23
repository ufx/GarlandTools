using Garland.Data.Models;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class SupplyDuties : Module
    {
        ItemSourceComplexity _complexity;
        Saint.IXivSheet<Saint.ParamGrow> _sParamGrow;

        public override string Name => "Supply Duties";

        public static int[] CURRENCIES = new int[] {
            10309,
            25199,
            10311,
            25200,
            10307,
            33913,
            33914,
            21072,
            21073,
            21074,
            21075,
            21076,
            21077,
            21078,
            21079,
            21080,
            21081,
            21172,
            21173,
            21935,
            22525,
            26533,
            26807,
            28063,
            28186,
            28187,
            28188,
            30341
        };

        public SupplyDuties(ItemSourceComplexity complexity)
        {
            _complexity = complexity;
            _sParamGrow = _builder.Sheet<Saint.ParamGrow>();
        }

        public override void Start()
        {
            BuildSatisfactionSupplyDuties();
            BuildGCSupplyAndProvisioningDuties();
            BuildCollectablesShopItemReward();
        }

        void BuildCollectablesShopItemReward()
        {
            // Modified from Masterpiece Supply Duty 
            // Collectables - Traded by the Collectable Appraiser in Mor Dhona and Idyllshire.
            var appraiserIds = new int[] { 1012300 }; // Just use this one for now.
            List<dynamic> appraisers = new List<dynamic>();
            foreach (var appraiserId in appraiserIds)
                appraisers.Add(_builder.Db.NpcsById[appraiserId]);

            foreach (var sCollectablesShopItem in _builder.Sheet2("CollectablesShopItem"))
            {
                // throw outdated 12-22 but 14 fish is still them
                float key = float.Parse(sCollectablesShopItem.FullKey, CultureInfo.InvariantCulture);
                if (key < 23)
                {
                    if (key >= 15)
                        continue;
                    if (key >= 12 && key < 14)
                        continue;
                }

                var sItem = (sCollectablesShopItem["Item"] as Saint.Item);
                if (sItem == null)
                    continue;

                var requiredItemKey = sItem.Key;
                if (requiredItemKey == 0)
                    continue;

                if (!_builder.Db.ItemsById.TryGetValue(requiredItemKey, out var item))
                {
                    DatabaseBuilder.PrintLine($"Required item {requiredItemKey} not found when building shop.");
                    continue;
                }

                var sReward = (Saint.XivRow)sCollectablesShopItem["CollectablesShopRewardScrip"];
                int sRewardId = Convert.ToInt32(sReward["Currency"]);
                dynamic rewardScrip = null;
                try
                {
                    rewardScrip = _builder.Db.ItemsById[CURRENCIES[sRewardId - 1]];
                }
                catch (IndexOutOfRangeException)
                {
                    DatabaseBuilder.PrintLine($"Currency {sRewardId} not found for {sItem.Name}.");
                    continue;
                }

                if (item.masterpiece == null)
                    item.masterpiece = new JObject();

                var sRefine = sCollectablesShopItem["CollectablesShopRefine"] as Saint.XivRow;

                item.masterpiece.rating = new JArray(sRefine["LowCollectability"], sRefine["MidCollectability"], sRefine["HighCollectability"]);
                item.masterpiece.amount = 1;
                item.masterpiece.stars = sCollectablesShopItem["Stars"];
                item.masterpiece.lvl = new JArray(sCollectablesShopItem["LevelMin"], sCollectablesShopItem["LevelMax"]);
                item.masterpiece.xp = new JArray(CalcCollectableExp(sCollectablesShopItem));
                item.masterpiece.reward = rewardScrip.id;

                _builder.Db.AddReference(item, "item", rewardScrip.id.Value, false);

                if (Convert.ToInt32(sReward["LowReward"]) == 0)
                {
                    item.masterpiece.rewardAmount = new JArray(0, 0, 0);
                    continue;
                }

                item.masterpiece.rewardAmount = new JArray(sReward["LowReward"], sReward["MidReward"], sReward["HighReward"]);

                // Add to nodes.
                foreach (var nodeView in _builder.Db.NodeViews)
                {
                    foreach (var itemView in nodeView.items)
                    {
                        if ((int)itemView.id == requiredItemKey)
                            itemView.scrip = rewardScrip.en.name.ToString();
                    }
                }

                // Add to fish.
                foreach (var fishView in _builder.Db.Fish)
                {
                    if ((int)fishView.id == requiredItemKey)
                        fishView.scrip = rewardScrip.en.name.ToString();
                }

                // Add supply data to reward.
                if (rewardScrip.supplyReward == null)
                    rewardScrip.supplyReward = new JArray();
                rewardScrip.supplyReward.Add(BuildSupplyReward(item));

                _builder.Db.AddReference(rewardScrip, "item", requiredItemKey, false);

            }
        }

        dynamic CalcCollectableExp(Saint.XivRow sCollectablesShopItem)
        {
            // By some verifications, the exp reward is still calculated in 
            // the same way as Masterpiece.
            var exps = new int[3];

            // Constrain level by valid range for this collectable.
            var level = Math.Max(Convert.ToInt32(sCollectablesShopItem["LevelMin"]),
                Convert.ToInt32(sCollectablesShopItem["LevelMax"]));
            // Find the base XP.
            var paramGrow = _sParamGrow[level];
            var ratio = ((float)paramGrow.ExpToNext) / 1000;

            var sReward = (Saint.XivRow)sCollectablesShopItem["CollectablesShopRewardScrip"];
            exps[0] = (int)(ratio * Convert.ToInt32(sReward["ExpRatioLow"]));
            exps[1] = (int)(ratio * Convert.ToInt32(sReward["ExpRatioMid"]));
            exps[2] = (int)(ratio * Convert.ToInt32(sReward["ExpRatioHigh"]));

            return exps;
        }

        dynamic BuildSupplyReward(dynamic item)
        {
            var itemId = (int)item.id;

            dynamic obj = new JObject();
            if (item.craft != null)
                obj.job = item.craft[0].job;
            else if (item.nodes != null)
            {
                dynamic node = _builder.Db.NodesById[item.nodes[0].Value];
                switch (node.type.Value)
                {
                    case 0:
                    case 1:
                        obj.job = 16;
                        break;
                    case 2:
                    case 3:
                        obj.job = 17;
                        break;
                    case 4:
                    case 5:
                        obj.job = 18;
                        break;
                }
            }
            else if (item.fish != null)
            {
                obj.job = 18;
            }
            obj.item = item.id;
            obj.reward = new JArray(item.masterpiece.rewardAmount);
            obj.complexity = _complexity.GetHqComplexity(itemId);
            obj.rating = item.masterpiece.rating[0];
            return obj;
        }

        void BuildSatisfactionSupplyDuties()
        {
            var sSatisfactionSupply = _builder.Sheet("SatisfactionSupply")
                .Cast<Saint.XivSubRow>()
                .ToArray();

            foreach (var sSatisfactionNpc in _builder.Sheet("SatisfactionNpc"))
            {
                var sNpc = (Saint.ENpcResident)sSatisfactionNpc["Npc"];
                if (sNpc == null || sNpc.Key == 0)
                    continue;

                for (var satisfactionLevel = 0; satisfactionLevel < 6; satisfactionLevel++)
                {
                    var supplyIndex = (int)sSatisfactionNpc["SupplyIndex[" + satisfactionLevel + "]"];
                    var relevantSupplyRows = sSatisfactionSupply.Where(r => r.ParentKey == supplyIndex);
                    foreach (var sSupply in relevantSupplyRows)
                    {
                        var sItem = sSupply["Item"] as Saint.IXivRow;
                        if (sItem == null || sItem.Key == 0)
                            continue;

                        // Requirements
                        var item = _builder.Db.ItemsById[sItem.Key];
                        if (item.satisfaction == null)
                            item.satisfaction = new JArray();

                        dynamic supply = new JObject();
                        item.satisfaction.Add(supply);

                        supply.level = satisfactionLevel;
                        supply.npc = sNpc.Key;
                        _builder.Db.AddReference(item, "npc", sNpc.Key, false);
                        supply.probability = sSupply["Probability<%>"];
                        supply.rating = new JArray(sSupply["Collectability{Low}"], sSupply["Collectability{Mid}"], sSupply["Collectability{High}"]);

                        // Rewards
                        var sSupplyReward = (Saint.IXivRow)sSupply["Reward"];
                        supply.satisfaction = new JArray(sSupplyReward["Satisfaction{Low}"], sSupplyReward["Satisfaction{Mid}"], sSupplyReward["Satisfaction{High}"]);
                        supply.gil = new JArray(sSupplyReward["Gil{Low}"], sSupplyReward["Gil{Mid}"], sSupplyReward["Gil{High}"]);

                        // Reward items
                        supply.items = new JArray();
                        for (var i = 0; i < 2; i++)
                        {
                            var rewardCurrencyKey = (ushort)sSupplyReward["Reward{Currency}[" + i + "]"];
                            if (rewardCurrencyKey == 0)
                                continue;

                            var rewardCurrencyItemKey = CURRENCIES[rewardCurrencyKey - 1];
                            var rewardGameItem = _builder.Sheet<Saint.Item>()[rewardCurrencyItemKey];

                            var rewardLow = (int)(UInt16)sSupplyReward["Quantity{Low}[" + i + "]"];

                            dynamic reward = new JObject();
                            reward.id = rewardGameItem.Key;
                            _builder.Db.AddReference(item, "item", rewardGameItem.Key, false);
                            reward.amount = new JArray(rewardLow, sSupplyReward["Quantity{Mid}[" + i + "]"], sSupplyReward["Quantity{High}[" + i + "]"]);
                            supply.items.Add(reward);
                        }
                    }
                }
            }
        }

        void BuildGCSupplyAndProvisioningDuties()
        {
            var sGCSupplyDutyRewards = _builder.Sheet("GCSupplyDutyReward");
            foreach (var sGCSupplyDuty in _builder.Sheet("GCSupplyDuty"))
            {
                if (sGCSupplyDuty.Key == 0)
                    continue;

                var sGCSupplyDutyReward = sGCSupplyDutyRewards[sGCSupplyDuty.Key];
                var xp = (int)(UInt32)sGCSupplyDutyReward.GetRaw("Experience{Supply}");
                var seals = (int)(UInt32)sGCSupplyDutyReward.GetRaw("Seals{Supply}");

                for (var i = 0; i <= 10; i++)
                {
                    for (var ii = 0; ii <= 2; ii++)
                    {
                        var itemKey = (int)sGCSupplyDuty.GetRaw("Item[" + ii + "][" + i + "]");
                        if (itemKey == 0)
                            continue;

                        var count = (byte)sGCSupplyDuty.GetRaw("ItemCount[" + ii + "][" + i + "]");

                        var item = _builder.Db.ItemsById[itemKey];
                        item.supply = new JObject();
                        item.supply.count = count;
                        item.supply.xp = xp;
                        item.supply.seals = seals;
                    }
                }
            }
        }
    }
}
