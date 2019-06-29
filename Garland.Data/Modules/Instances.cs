using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Instances : Module
    {
        public override string Name => "Instances";

        public override void Start()
        {
            BuildDutyRoulette();

            var skippedInstances = new[] { 0, 20015, 20016, 50002, 65000, 30048 };

            // Index conditions.  Some PvP instances have multiple conditions, but it doesn't matter.
            foreach (var sContentFinderCondition in _builder.Sheet<Saint.ContentFinderCondition>())
            {
                if (sContentFinderCondition.Key == 0)
                    continue;

                if (sContentFinderCondition.Content is Saint.InstanceContent sInstanceContent)
                    _builder.ContentFinderConditionByInstanceContent[sInstanceContent] = sContentFinderCondition;
            }

            // todo: add new player bonus currency
            // todo: add weekly restriction stuff?

            foreach (var sInstanceContent in _builder.Sheet<Saint.InstanceContent>())
            {
                if (skippedInstances.Contains(sInstanceContent.Key))
                    continue; // Skip test and fan fest instances.

                // Find entry conditions.
                if (!_builder.ContentFinderConditionByInstanceContent.TryGetValue(sInstanceContent, out var sContentFinderCondition))
                    continue; // Skip unreleased content.

                // Skip some instances.
                switch (sContentFinderCondition.ContentType.Key)
                {
                    case 3: // Guildhests
                    case 7: // Quest Battles
                    case 8: // FATEs
                    case 20: // Novice Hall
                        continue;
                }

                var name = sContentFinderCondition.Name.ToString();
                if (name == "")
                    continue;

                var sContentFinderConditionTransient = _builder.Sheet("ContentFinderConditionTransient")[sContentFinderCondition.Key];

                dynamic instance = new JObject();
                instance.id = sInstanceContent.Key;
                _builder.Localize.Strings((JObject)instance, sContentFinderCondition, Utils.SanitizeInstanceName, "Name");
                instance.patch = PatchDatabase.Get("instance", sInstanceContent.Key);
                instance.categoryIcon = IconDatabase.EnsureEntry("instance/type", sContentFinderCondition.ContentType.Icon);
                _builder.Localize.Column((JObject)instance, sContentFinderCondition.ContentType, "Name", "category",
                    x => string.IsNullOrEmpty(x) ? Hacks.GetContentTypeNameOverride(sContentFinderCondition.ContentType) : x);
               
                _builder.Localize.Strings((JObject)instance, sContentFinderConditionTransient, "Description");
                instance.time = (int)sInstanceContent.TimeLimit.TotalMinutes;
                instance.min_lvl = sContentFinderCondition.RequiredClassJobLevel;

                Hacks.SetInstanceIcon(sContentFinderCondition, instance);

                if (sContentFinderCondition.ContentMemberType.HealersPerParty > 0)
                    instance.healer = sContentFinderCondition.ContentMemberType.HealersPerParty;

                if (sContentFinderCondition.ContentMemberType.TanksPerParty > 0)
                    instance.tank = sContentFinderCondition.ContentMemberType.TanksPerParty;

                if (sContentFinderCondition.ContentMemberType.RangedPerParty > 0)
                    instance.ranged = sContentFinderCondition.ContentMemberType.RangedPerParty;

                if (sContentFinderCondition.ContentMemberType.MeleesPerParty > 0)
                    instance.melee = sContentFinderCondition.ContentMemberType.MeleesPerParty;

                // fixme: find where this went.
                //if (conditions.ContentRoulette.Key > 0)
                //    instance.roulette = conditions.ContentRoulette.Key;

                if (sContentFinderCondition.ClassJobLevelSync > 0)
                    instance.max_lvl = sContentFinderCondition.ClassJobLevelSync;

                if (sContentFinderCondition.RequiredItemLevel > 0)
                    instance.min_ilvl = sContentFinderCondition.RequiredItemLevel;

                if (sContentFinderCondition.ItemLevelSync > 0)
                    instance.max_ilvl = sContentFinderCondition.ItemLevelSync;

                var treasureSet = new HashSet<int>();
                var currency = new Dictionary<string, int>();

                // Bosses
                var sFights = new List<Saint.InstanceContentData.Fight>();
                if (sInstanceContent.Data.Boss != null)
                    sFights.Add(sInstanceContent.Data.Boss);
                if (sInstanceContent.Data.MidBosses != null)
                    sFights.AddRange(sInstanceContent.Data.MidBosses);

                var fights = new JArray();
                foreach (var sFight in sFights)
                {
                    var bossCurrency = new Dictionary<string, int>();
                    if (sFight.CurrencyA > 0)
                    {
                        currency["ClearA"] = currency.ContainsKey("ClearA") ? currency["ClearA"] + sFight.CurrencyA : sFight.CurrencyA;
                        bossCurrency["ClearA"] = sFight.CurrencyA;
                    }
                    if (sFight.CurrencyB > 0)
                    {
                        currency["ClearB"] = currency.ContainsKey("ClearB") ? currency["ClearB"] + sFight.CurrencyB : sFight.CurrencyB;
                        bossCurrency["ClearB"] = sFight.CurrencyB;
                    }
                    if (sFight.CurrencyC > 0)
                    {
                        currency["ClearC"] = currency.ContainsKey("ClearC") ? currency["ClearC"] + sFight.CurrencyC : sFight.CurrencyC;
                        bossCurrency["ClearC"] = sFight.CurrencyC;
                    }
                    if (sFight.PrimaryBNpcs.Count() == 0 && sFight.Treasures.Count() == 0)
                        continue;

                    dynamic fight = new JObject();
                    fights.Add(fight);

                    if (bossCurrency.Count > 0)
                        fight.currency = CreateCurrencyArray(bossCurrency);

                    fight.type = (sFight == sInstanceContent.Data.Boss) ? "Boss" : "MidBoss";

                    var fightCoffer = CreateTreasureCoffer(instance, sFight.Treasures, sInstanceContent, treasureSet);
                    if (fightCoffer != null)
                        fight.coffer = fightCoffer;

                    var mobs = new JArray();
                    fight.mobs = mobs;
                    
                    foreach (var sBoss in sFight.PrimaryBNpcs)
                    {
                        _builder.InstanceIdsByMobId[sBoss.Key] = sInstanceContent.Key;

                        if (!mobs.Any(b => ((long)b) == sBoss.Key))
                        {
                            _builder.Db.AddReference(instance, "mob", sBoss.Key.ToString(), false);
                            mobs.Add(sBoss.Key);
                        }

                        if (!_builder.ItemDropsByMobId.TryGetValue(sBoss.Key, out var itemIds))
                        {
                            itemIds = new List<int>();
                            _builder.ItemDropsByMobId[sBoss.Key] = itemIds;
                        }

                        foreach (var sTreasureItem in sFight.Treasures.SelectMany(t => t.Items))
                        {
                            if (!itemIds.Contains(sTreasureItem.Key))
                                itemIds.Add(sTreasureItem.Key);

                            var item = _builder.Db.ItemsById[sTreasureItem.Key];
                            if (item.drops == null)
                                item.drops = new JArray();
                            JArray drops = item.drops;
                            if (!drops.Any(t => ((long)t) == sBoss.Key))
                            {
                                drops.Add(sBoss.Key);
                                _builder.Db.AddReference(instance, "item", sTreasureItem.Key, false);
                                _builder.Db.AddReference(item, "instance", sInstanceContent.Key, true);
                            }
                        }

                        if (sFight.CurrencyA > 0)
                            _builder.AddBossCurrency(sFight.CurrencyA, _builder.TomestoneIds[0], sBoss.Key);
                        if (sFight.CurrencyB > 0)
                            _builder.AddBossCurrency(sFight.CurrencyB, _builder.TomestoneIds[1], sBoss.Key);
                        if (sFight.CurrencyC > 0)
                            _builder.AddBossCurrency(sFight.CurrencyC, _builder.TomestoneIds[2], sBoss.Key);
                    }
                }

                if (fights.Count > 0)
                    instance.fights = fights;

                // Treasures
                var coffers = new JArray();
                if (sInstanceContent.Data.MapTreasures != null)
                {
                    foreach (var sTreasure in sInstanceContent.Data.MapTreasures)
                    {
                        var coffer = CreateTreasureCoffer(instance, new Saint.InstanceContentData.Treasure[] { sTreasure }, sInstanceContent, treasureSet);
                        if (coffer != null)
                            coffers.Add(coffer);
                    }

                    if (coffers.Count > 0)
                        instance.coffers = coffers;
                }

                // Some items are not referenced by the instance, but by the item itself.
                // This snags them.
                if (_builder.Db.ItemsByInstanceId.TryGetValue(sInstanceContent.Key, out var instanceItems))
                {
                    var otherItemRewards = new JArray();
                    foreach (var item in instanceItems)
                    {
                        int itemId = item.id;
                        if (!treasureSet.Contains(itemId))
                        {
                            otherItemRewards.Add(itemId);
                            _builder.Db.AddReference(instance, "item", itemId, false);
                        }
                    }

                    if (otherItemRewards.Count > 0)
                        instance.rewards = otherItemRewards;
                }

                // Currency
                var currencyArray = CreateCurrencyArray(currency);
                if (currencyArray.Count > 0)
                    instance.currency = currencyArray;

                _builder.Db.Instances.Add(instance);
                _builder.Db.InstancesById[sInstanceContent.Key] = instance;
            }
        }

        void BuildDutyRoulette()
        {
            foreach (var sContentRoulette in _builder.Sheet<Saint.ContentRoulette>())
            {
                if (sContentRoulette.Key == 0)
                    continue;

                dynamic roulette = new JObject();
                roulette.id = sContentRoulette.Key;
                roulette.name = sContentRoulette.Name.ToString();

                // Currency
                var dict = new Dictionary<string, int>();
                var currencyA = sContentRoulette.AsInt32("Reward{TomeA}");
                if (currencyA > 0)
                    dict["ClearA"] = currencyA;

                var currencyB = sContentRoulette.AsInt32("Reward{TomeB}");
                if (currencyB > 0)
                    dict["ClearB"] = currencyB;

                var currencyC = sContentRoulette.AsInt32("Reward{TomeC}");
                if (currencyC > 0)
                    dict["ClearC"] = currencyC;

                var currencyArray = CreateCurrencyArray(dict);
                if (currencyArray.Count > 0)
                    roulette.reward = currencyArray;

                _builder.Db.DutyRoulette.Add(roulette);
            }
        }

        JObject CreateTreasureCoffer(dynamic instance, IEnumerable<Saint.InstanceContentData.Treasure> sTreasures, Saint.InstanceContent sInstanceContent, HashSet<int> treasureSet)
        {
            dynamic treasures = new JObject();
            var treasureItems = new JArray();
            treasures.items = treasureItems;

            foreach (var sTreasure in sTreasures)
            {
                if (sTreasure.Coordinates != null)
                {
                    treasures.coords = new JArray
                    {
                        sTreasure.Coordinates.Value.X,
                        sTreasure.Coordinates.Value.Y
                    };
                }

                foreach (var sItem in sTreasure.Items)
                {
                    if (treasureItems.Any(i => (int)i == sItem.Key))
                        continue;

                    treasureSet.Add(sItem.Key);
                    treasureItems.Add(sItem.Key);
                    var item = _builder.Db.ItemsById[sItem.Key];
                    if (item.instances == null)
                        item.instances = new JArray();
                    JArray itemInstances = item.instances;
                    if (!itemInstances.Any(i => (int)i == sInstanceContent.Key))
                        itemInstances.Add(sInstanceContent.Key);

                    _builder.Db.AddReference(instance, "item", sItem.Key, false);
                    _builder.Db.AddReference(item, "instance", (string)instance.id, true);
                }
            }

            return treasureItems.Count > 0 ? treasures : null;
        }

        JArray CreateCurrencyArray(Dictionary<string, int> currency)
        {
            var result = new JArray();
            foreach (var pair in currency)
            {
                dynamic obj = new JObject();
                if (pair.Key == "ClearA")
                    obj.id = _builder.TomestoneIds[0];
                else if (pair.Key == "ClearB")
                    obj.id = _builder.TomestoneIds[1];
                else if (pair.Key == "ClearC")
                    obj.id = _builder.TomestoneIds[2];
                else
                    throw new NotImplementedException();
                obj.amount = pair.Value;
                result.Add(obj);
            }
            return result;
        }
    }
}
