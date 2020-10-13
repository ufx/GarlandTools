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

        public SupplyDuties(ItemSourceComplexity complexity)
        {
            _complexity = complexity;
        }

        public override void Start()
        {
            BuildMasterpieceSupplyDuties();
            BuildSatisfactionSupplyDuties();
            BuildGCSupplyAndProvisioningDuties();
            BuildCollectablesShopItemReward();
        }

        void BuildMasterpieceSupplyDuties()
        {
            // Collectables - Traded by the Collectable Appraiser in Mor Dhona and Idyllshire.
            var appraiserIds = new int[] { 1012300 }; // Just use this one for now.
            List<dynamic> appraisers = new List<dynamic>();
            foreach (var appraiserId in appraiserIds)
                appraisers.Add(_builder.Db.NpcsById[appraiserId]);

            foreach (var sMasterpieceSupplyDuty in _builder.Sheet<Saint.MasterpieceSupplyDuty>())
            {
                if (sMasterpieceSupplyDuty.ClassJob.Key == 0)
                    continue;

                var sRewardCurrency = (Saint.XivRow)sMasterpieceSupplyDuty["Reward{Currency}"];
                var sRewardItem = (Saint.Item)sRewardCurrency["Item"];

                foreach (var sCollectableItem in sMasterpieceSupplyDuty.CollectableItems)
                {
                    var requiredItemKey = sCollectableItem.RequiredItem.Key;
                    if (requiredItemKey == 0)
                        continue;

                    var item = _builder.Db.ItemsById[requiredItemKey];

                    if (item.masterpiece == null)
                        item.masterpiece = new JObject();

                    item.masterpiece.rating = new JArray(sCollectableItem.CollectabilityBase, sCollectableItem.CollectabilityBonus, sCollectableItem.CollectabilityHighBonus);
                    item.masterpiece.amount = sCollectableItem.Quantity;
                    item.masterpiece.stars = sCollectableItem.Stars;
                    item.masterpiece.lvl = new JArray(sMasterpieceSupplyDuty.ClassJobLevel, sCollectableItem.MaxClassJobLevel);
                    item.masterpiece.xp = new JArray(sCollectableItem.CalculateExp(sCollectableItem.MaxClassJobLevel));
                    item.masterpiece.reward = sRewardItem.Key;

                    _builder.Db.AddReference(item, "item", sRewardItem.Key, false);

                    if (sCollectableItem.ScripRewards == 0) {
                        item.masterpiece.rewardAmount = new JArray(0, 0, 0);
                        continue;
                    }

                    item.masterpiece.rewardAmount = new JArray(sCollectableItem.CalculateScripRewards());

                    // Add to nodes.
                    foreach (var nodeView in _builder.Db.NodeViews)
                    {
                        foreach (var itemView in nodeView.items)
                        {
                            if ((int)itemView.id == requiredItemKey)
                                itemView.scrip = sRewardItem.Name.ToString();
                        }
                    }

                    // Add to fish.
                    foreach (var fishView in _builder.Db.Fish)
                    {
                        if ((int)fishView.id == requiredItemKey)
                            fishView.scrip = sRewardItem.Name.ToString();
                    }

                    // Add supply data to reward.
                    var rewardItem = _builder.Db.ItemsById[sRewardItem.Key];
                    if (rewardItem.supplyReward == null)
                        rewardItem.supplyReward = new JArray();
                    rewardItem.supplyReward.Add(BuildSupplyReward(sMasterpieceSupplyDuty, item));

                    _builder.Db.AddReference(rewardItem, "item", requiredItemKey, false);
                }
            }
        }

        void BuildCollectablesShopItemReward()
        {
            foreach(var sCollectableShopItem in _builder.Sheet2("CollectablesShopItem"))
            {
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
                            var rewardCurrency = (Saint.IXivRow)sSupplyReward["Reward{Currency}[" + i + "]"];
                            if (rewardCurrency == null || rewardCurrency.Key == 0)
                                continue;

                            var rewardGameItem = (Saint.Item)rewardCurrency["Item"];

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
