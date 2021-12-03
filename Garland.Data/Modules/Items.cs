using Garland.Data.Helpers;
using Garland.Data.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Items : Module
    {
        Dictionary<string, List<dynamic>> _itemsBySlotModelId = new Dictionary<string, List<dynamic>>();
        HashSet<int> _armoireIndex = new HashSet<int>();
        List<Saint.Item> _gardeningSeeds = new List<Saint.Item>();
        Saint.BaseParam[] _crafterParams;
        Saint.BaseParam[] _gathererParams;
        Saint.BaseParam[] _baseParams;

        public override string Name => "Items";

        public override void Start()
        {
            Setup();

            BuildItems();
            BuildModelSharing();
            BuildItemSeries();
            BuildTutorial();
        }

        void Setup()
        {
            BuildItemCategories();

            _baseParams = _builder.Sheet<Saint.BaseParam>()
                .Where(bp => !string.IsNullOrEmpty(bp.Name))
                .ToArray();

            var gathererParamNames = new string[] { "GP", "Gathering", "Perception" };
            _gathererParams = gathererParamNames.Select(n => _baseParams.First(bp => bp.Name == n)).ToArray();

            var crafterParamNames = new string[] { "CP", "Craftsmanship", "Control" };
            _crafterParams = crafterParamNames.Select(n => _baseParams.First(bp => bp.Name == n)).ToArray();

            foreach (var row in _builder.Sheet("Cabinet"))
            {
                var id = (int)row.GetRaw("Item");
                if (id > 0)
                    _armoireIndex.Add(id);
            }
        }

        void BuildItems()
        {
            var libraIndex = _builder.Libra.Table<Libra.Item>()
                .ToArray()
                .ToDictionary(i => i.Key);

            foreach (var sItem in _builder.ItemsToImport)
            {
                var item = _builder.CreateItem(sItem.Key);
                _builder.Localize.Strings(item, sItem, "Name");
                _builder.Localize.HtmlStrings(item, sItem, "Description");
                _builder.Db.ItemsByName[(string)item.en.name] = item;
                item.patch = PatchDatabase.Get("item", sItem.Key);
                item.patchCategory = PatchDatabase.GetPatchCategory(sItem);
                item.price = sItem.Ask;
                item.ilvl = sItem.ItemLevel.Key;
                item.category = sItem.ItemUICategory.Key;

                if (sItem.IsUnique)
                    item.unique = 1;

                if (sItem.IsDyeable)
                    item.dyeable = 1;

                if (!sItem.IsUntradable)
                    item.tradeable = 1;

                if (sItem.Bid > 0)
                    item.sell_price = sItem.Bid;

                var rarity = sItem.As<byte>("Rarity");
                if (rarity > 0)
                    item.rarity = rarity;

                if (sItem.IsConvertable)
                    item.convertable = 1;

                if (sItem.IsAetherialReducible)
                    item.reducible = 1;

                if (sItem.ItemSearchCategory.Key == 0)
                    item.unlistable = 1;

                if (sItem.IsCollectable)
                    item.collectable = 1;

                // Mark applicable materia for advanced melding.
                if (sItem.ItemUICategory.Key == 58 && !sItem.IsAdvancedMeldingPermitted)
                    item.advancedMeldingForbidden = 1;

                item.stackSize = sItem.StackSize;

                if (sItem.RepairClassJob.Key != 0)
                    item.repair = sItem.RepairClassJob.Key;

                BuildAttributes(item, sItem);

                item.icon = ItemIconDatabase.EnsureIcon(sItem);

                // Additional data
                var additionalData = sItem.AdditionalData;
                if (additionalData != null)
                {
                    if (additionalData.Sheet.Name == "GardeningSeed")
                        _gardeningSeeds.Add(sItem);
                }

                #region Libra Supplement
                libraIndex.TryGetValue(sItem.Key, out var lItem);

                if (lItem != null && lItem.data != null)
                {
                    dynamic extraLibraData = JsonConvert.DeserializeObject(lItem.data);

                    // Mob drops
                    if (extraLibraData.bnpc != null && extraLibraData.bnpc.Count > 0)
                    {
                        var mobIds = new JArray();
                        foreach (long mob in extraLibraData.bnpc)
                        {
                            mobIds.Add(mob);

                            if (!_builder.ItemDropsByMobId.TryGetValue(mob, out var itemIds))
                            {
                                itemIds = new List<int>();
                                _builder.ItemDropsByMobId[mob] = itemIds;
                            }
                            itemIds.Add(sItem.Key);
                        }

                        // References are added by Mobs module.
                        item.drops = mobIds;
                    }

                    // Instances
                    if (extraLibraData.instance_content != null)
                    {
                        foreach (int instanceId in extraLibraData.instance_content)
                        {
                            if (!_builder.Db.ItemsByInstanceId.TryGetValue(instanceId, out var instanceItems))
                                _builder.Db.ItemsByInstanceId[instanceId] = instanceItems = new List<dynamic>();

                            instanceItems.Add(item);

                            if (item.instances == null)
                                item.instances = new JArray();

                            JArray itemInstances = item.instances;
                            if (!itemInstances.Contains(instanceId))
                            {
                                itemInstances.Add(instanceId);
                                _builder.Db.AddReference(item, "instance", instanceId, true);
                            }
                        }
                    }
                }
                #endregion

                //todo: item.repair_price = ? Not important

                // Mark embedded categories
                if (sItem.ItemUICategory.Key == 59)
                {
                    // Crystals
                    _builder.Db.EmbeddedIngredientItems.Add(item);
                    _builder.Db.EmbeddedPartialItemIds.Add(sItem.Key);
                }
                if (sItem.ItemUICategory.Key == 60 && sItem.ItemSearchCategory.Key == 59)
                    _builder.Db.EmbeddedPartialItemIds.Add(sItem.Key); // Catalysts with a matching search category.
            }

            // Needs another pass once all items are processed.
            BuildAdditionalItemData();
        }

        void BuildAdditionalItemData()
        {
            foreach (var sSeedItem in _gardeningSeeds)
            {
                var sGardeningSeed = (Saint.XivRow)sSeedItem.AdditionalData;
                var sResultItem = sGardeningSeed.As<Saint.Item>();

                var resultItem = _builder.Db.ItemsById[sResultItem.Key];
                var seedItem = _builder.Db.ItemsById[sSeedItem.Key];
                AddGardeningPlant(_builder, seedItem, resultItem);
            }
        }

        public static void AddGardeningPlant(DatabaseBuilder builder, dynamic seedItem, dynamic resultItem)
        {
            if (resultItem.seeds != null)
                throw new InvalidOperationException("resultItem.seeds already exists");

            resultItem.seeds = new JArray();
            resultItem.seeds.Add((int)seedItem.id);

            if (seedItem.grow == null)
                seedItem.grow = new JArray();
            seedItem.grow.Add((int)resultItem.id);

            builder.Db.AddReference(resultItem, "item", (int)seedItem.id, false);
            builder.Db.AddReference(seedItem, "item", (int)resultItem.id, false);
        }

        void BuildAttributes(dynamic item, Saint.Item sItem)
        {
            var attr = new JObject();
            var attr_hq = new JObject();
            var attr_max = new JObject();
            if (sItem is Saint.Items.Equipment sEquipment)
            {
                item.equip = 1;

                if (sEquipment.FreeMateriaSlots > 0)
                {
                    item.sockets = sEquipment.FreeMateriaSlots;

                    // Only equipment with slots should possibly be forbidden.
                    if (!sItem.IsAdvancedMeldingPermitted)
                        item.advancedMeldingForbidden = 1;
                }

                /** TODO Fix
                if (sEquipment.RepairItem != null && sEquipment.RepairItem.Key > 0)
                    item.repair_item = sEquipment.RepairItem.Key;
                */

                if (sEquipment.IsPvP)
                    item.pvp = 1;

                if (sEquipment.IsCrestWorthy)
                    item.crestworthy = 1;

                if (sEquipment.IsGlamourous)
                    item.glamourous = 1;

                var expertSeals = sEquipment.ExpertDeliverySeals;
                if (expertSeals > 0)
                    item.delivery = expertSeals;

                if (_armoireIndex.Contains(sItem.Key))
                    item.storable = 1;

                item.slot = sEquipment.EquipSlotCategory.Key;
                item.elvl = sEquipment.EquipmentLevel;
                item.jobs = sEquipment.ClassJobCategory.Key;
                _builder.Localize.Column(item, sEquipment.ClassJobCategory, "Name", "jobCategories");

                // Set all normal and hq parameters specified on the item.
                Saint.BaseParam[] extraParams = null;
                foreach (var sParameter in sEquipment.AllParameters)
                {
                    if (_crafterParams.Contains(sParameter.BaseParam))
                        extraParams = _crafterParams;
                    else if (_gathererParams.Contains(sParameter.BaseParam))
                        extraParams = _gathererParams;

                    ParamHelper.SetValue(sParameter, attr, attr_hq, false);
                }

                // Set maximums for every parameter.
                foreach (var sBaseParam in _baseParams)
                    ParamHelper.SetMaxValue(sEquipment, sBaseParam, attr_max);

                // For gatherer and crafter equ, set normal attributes even
                // if they're 0 so their maximums always show up.
                if (extraParams != null)
                {
                    foreach (var sBaseParam in extraParams)
                    {
                        var key = sBaseParam.Name.ToString();
                        if (attr_max[key] != null && attr[key] == null && attr_hq[key] == null)
                            attr[key] = 0;
                    }
                }

                /**
                 * TODO Fix
                var characterType = sEquipment.GetModelCharacterType();
                if (characterType != 0 && !Hacks.NoModelCategories.Contains(sEquipment.ItemUICategory.Key))
                {
                    // Record model information for viewer.
                    item.models = new JArray();
                    item.models.Add(sEquipment.PrimaryModelKey.ToString().Replace(", ", "-"));
                    if (!sEquipment.SecondaryModelKey.IsEmpty)
                        item.models.Add(sEquipment.SecondaryModelKey.ToString().Replace(", ", "-"));

                    if (sEquipment.Rarity != 7)
                    {
                        var sEquipSlot = sEquipment.EquipSlotCategory.PossibleSlots.First();
                        var modelKey = sEquipSlot.GetModelKey(sEquipment.PrimaryModelKey, characterType);

                        // We compare only the primary model key for now.
                        // Not sure if the secondary key is valuable too?
                        if (!_itemsBySlotModelId.TryGetValue(modelKey, out var itemsWithModel))
                        {
                            itemsWithModel = new List<dynamic>();
                            _itemsBySlotModelId[modelKey] = itemsWithModel;
                        }
                        itemsWithModel.Add(item);
                    }
                }
                */

                // ItemSpecialBonus
                if (sEquipment.ItemSpecialBonus != null && sEquipment.ItemSpecialBonus.Name != "")
                {
                    item.special = new JObject();
                    item.special.bonusId = sEquipment.ItemSpecialBonus.Key;

                    if (sEquipment.ItemSpecialBonusParam > 0)
                        item.special.bonusParam = sEquipment.ItemSpecialBonusParam;

                    if (sEquipment.ItemSeries.Key > 0)
                    {
                        item.special.seriesId = sEquipment.ItemSeries.Key;

                        if (!_builder.Db.ItemsBySeriesId.TryGetValue(sEquipment.ItemSeries.Key, out var itemsInSeries))
                            _builder.Db.ItemsBySeriesId[sEquipment.ItemSeries.Key] = itemsInSeries = new List<dynamic>();
                        itemsInSeries.Add(item);
                    }

                    item.special.attr = new JArray();
                    foreach (var sParam in sEquipment.SecondaryParameters)
                    {
                        foreach (var paramValue in sParam.Values.Select(pv => ParameterInfo.From(pv)))
                        {
                            if (paramValue.Type != Saint.ParameterType.Sanction &&
                                paramValue.Type != Saint.ParameterType.SetBonus &&
                                paramValue.Type != Saint.ParameterType.SetBonusCapped &&
                                paramValue.Type != Saint.ParameterType.EurekaEffect)
                                continue;

                            dynamic obj = new JObject();
                            obj.name = sParam.BaseParam.Name.ToString();
                            obj.value = (int)paramValue.Amount;
                            obj.index = paramValue.Index;

                            item.special.attr.Add(obj);
                        }
                    }
                }
            }

            if (sItem is Saint.Items.Usable sUsable)
            {
                JObject action = new JObject();
                JObject action_hq = new JObject();

                foreach (var param in sUsable.Parameters)
                    ParamHelper.SetValue(param, action, action_hq, true);

                if (action.Count > 0)
                    attr.Add("action", action);
                if (action_hq.Count > 0)
                    attr_hq.Add("action", action_hq);
            }

            if (attr.Count > 0)
                item.attr = attr;
            if (attr_hq.Count > 0)
                item.attr_hq = attr_hq;
            if (attr_max.Count > 0)
                item.attr_max = attr_max;
        }

        void BuildModelSharing()
        {
            // todo: needs work with green summer top / green summer halter (different equip restrictions)

            foreach (var items in _itemsBySlotModelId.Values)
            {
                if (items.Count <= 1)
                    continue;

                foreach (var item in items)
                {
                    item.sharedModels = new JArray();
                    foreach (var item2 in items)
                    {
                        if (item2 != item)
                        {
                            item.sharedModels.Add(item2.id);
                            _builder.Db.AddReference(item, "item", (string)item2.id, false);
                        }
                    }
                }
            }
        }

        void BuildItemCategories()
        {
            foreach (var sCategory in _builder.Sheet<Saint.ItemUICategory>())
            {
                if (sCategory.Key == 0 || sCategory.Name == "")
                    continue;

                dynamic category = new JObject();
                category.id = sCategory.Key;
                category.name = sCategory.Name.ToString();

                var damageAttribute = Hacks.GetCategoryDamageAttribute(sCategory);
                if (damageAttribute != null)
                    category.attr = damageAttribute;

                _builder.Db.ItemCategories.Add(category);
            }
        }

        void BuildItemSeries()
        {
            foreach (var sItemSpecialBonus in _builder.Sheet<Saint.ItemSpecialBonus>())
            {
                if (sItemSpecialBonus.Key == 0 || sItemSpecialBonus.Name == "")
                    continue;

                dynamic bonus = new JObject();
                bonus.id = sItemSpecialBonus.Key;
                bonus.name = sItemSpecialBonus.Name.ToString();

                _builder.Db.ItemSpecialBonus.Add(bonus);
            }

            foreach (var sItemSeries in _builder.Sheet<Saint.ItemSeries>())
            {
                if (sItemSeries.Key == 0 || sItemSeries.Name == "")
                    continue;

                dynamic series = new JObject();
                series.id = sItemSeries.Key;
                series.name = sItemSeries.Name.ToString();

                _builder.Db.ItemSeries.Add(series);
            }

            // Record item series on each item.
            foreach (var itemSeries in _builder.Db.ItemsBySeriesId.Values)
            {
                // Skip the big item sets (GC uniforms)
                if (itemSeries.Count > 20)
                    continue;

                foreach (var item in itemSeries)
                {
                    var others = itemSeries.Where(i => i != item).Select(i => (int)i.id).ToArray();
                    item.special.series = new JArray(others);
                    _builder.Db.AddReference(item, "item", others, false);
                }
            }
        }

        void BuildTutorial()
        {
            foreach (var sTutorial in _builder.Sheet("Tutorial"))
            {
                var sItems = new Saint.Item[]
                {
                    (Saint.Item)sTutorial["Reward{Tank}"],
                    (Saint.Item)sTutorial["Reward{Melee}"],
                    (Saint.Item)sTutorial["Reward{Ranged}"]
                };

                foreach (var sItem in sItems)
                { 
                    if (sItem.Key == 0)
                        continue;

                    var item = _builder.Db.ItemsById[sItem.Key];
                    item.tutorialReward = 1;
                }
            }
        }
    }
}
