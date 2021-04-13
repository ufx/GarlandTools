using Garland.Data.Models;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class SupplyDuties : Module
    {
        ItemSourceComplexity _complexity;

        public override string Name => "Supply Duties";

        private static int[] CURRENCIES = new int[] {
            10309,
            17833,
            10311,
            17834,
            10307,
            25199,
            25200,
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
        }

        public override void Start()
        {
            BuildSatisfactionSupplyDuties();
            BuildGCSupplyAndProvisioningDuties();
            BuildCollectablesShopItemReward();
        }

        void BuildCollectablesShopItemReward()
        {
            foreach(var sCollectableShopItem in _builder.Sheet2("CollectablesShopItem"))
            {
                //TODO
                Console.WriteLine(sCollectableShopItem["Item"]);
            }
        }

        dynamic BuildSupplyReward(Saint.MasterpieceSupplyDuty sMasterpieceSupplyDuty, dynamic item)
        {
            var itemId = (int)item.id;

            dynamic obj = new JObject();
            obj.job = sMasterpieceSupplyDuty.ClassJob.Key;
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
