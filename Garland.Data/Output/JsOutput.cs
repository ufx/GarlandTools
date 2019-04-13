using Garland.Data.Models;
using Garland.Data.Output;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Output
{
    public class JsOutput
    {
        GarlandDatabase _db;
        UpdatePackage _update;
        ConcurrentDictionary<object, HashSet<int>> _componentsByItemId = new ConcurrentDictionary<object, HashSet<int>>();
        Dictionary<Tuple<string, string>, Dictionary<string, JObject>> _partialsByLangTypeById = new Dictionary<Tuple<string, string>, Dictionary<string, JObject>>();
        Dictionary<dynamic, dynamic> _ingredientsByItem = new Dictionary<dynamic, dynamic>();
        static JsonConverter[] _converters = new[] { new WrapperConverter() };
        static string[] _languagesCodes = new[] { "en", "ja", "de", "fr" };

        public JsOutput(UpdatePackage update)
        {
            _db = GarlandDatabase.Instance;
            _update = update;
        }

        public void Write()
        {
            ItemIconDatabase.WriteUpdates();
            IconDatabase.WriteUpdates();

            foreach (var lang in _languagesCodes)
            {
                CreatePartials(lang);
                WriteCore(lang);

                WriteEquipmentCalculators(lang);
                WriteItems(lang);
                WriteQuests(lang);
                WriteLeves(lang);
                WriteNpcs(lang);
                WriteActions(lang);
                WriteFish(lang);
                WriteNodes(lang);
                WriteAchievements(lang);
                WriteInstances(lang);
                WriteFates(lang);
                WriteMobs(lang);
                WriteBrowsers(lang);

                PatchDatabase.WritePatchLists(this, _update, lang);
            }

            PatchDatabase.WriteMasterPatchList();
        }

        void CreatePartials(string lang)
        {
            // Actions
            var actions = _partialsByLangTypeById[Tuple.Create(lang, "action")] = new Dictionary<string, JObject>();
            foreach (var action in _db.Actions)
            {
                dynamic partial = new JObject();
                partial.i = action.id;
                partial.n = (string)action[lang]["name"];
                partial.c = action.icon;
                partial.j = action.job;
                partial.t = action.category;
                partial.l = action.lvl;

                actions[(string)action.id] = partial;
            }

            // Achievements
            var achievements = _partialsByLangTypeById[Tuple.Create(lang, "achievement")] = new Dictionary<string, JObject>();
            foreach (var achievement in _db.Achievements)
            {
                dynamic partial = new JObject();
                partial.i = achievement.id;
                partial.n = (string)achievement[lang]["name"];
                partial.c = achievement.icon;
                partial.t = achievement.category;

                var rewards = new List<string>();
                if (achievement.title != null)
                    rewards.Add((string)achievement.title);
                else if (achievement.item != null)
                {
                    var item = _db.ItemsById[(int)achievement.item];
                    rewards.Add((string)item.en.name);
                }

                if (rewards.Count > 0)
                    partial.b = string.Join(", ", rewards);
                else // todo: need to localize this
                    partial.b = new string(((string)achievement.en.description).Take(50).ToArray());

                achievements[(string)achievement.id] = partial;
            }

            // Leves
            var leves = _partialsByLangTypeById[Tuple.Create(lang, "leve")] = new Dictionary<string, JObject>();
            foreach (var leve in _db.Leves)
            {
                dynamic partial = new JObject();
                partial.i = leve.id;
                partial.n = (string)leve[lang]["name"];
                partial.l = leve.lvl;
                partial.j = leve.jobCategory;
                partial.p = leve.areaid;

                leves[(string)leve.id] = partial;
            }

            // Fates
            var fates = _partialsByLangTypeById[Tuple.Create(lang, "fate")] = new Dictionary<string, JObject>();
            foreach (var fate in _db.Fates)
            {
                dynamic partial = new JObject();
                partial.i = fate.id;
                partial.n = (string)fate[lang]["name"];
                partial.l = fate.lvl;
                partial.t = fate.type;

                if (fate.zoneid != null)
                    partial.z = fate.zoneid;

                fates[(string)fate.id] = partial;
            }

            // Quests
            var quests = _partialsByLangTypeById[Tuple.Create(lang, "quest")] = new Dictionary<string, JObject>();
            foreach (var quest in _db.Quests)
            {
                dynamic partial = new JObject();
                partial.i = quest.id;
                partial.n = (string)quest[lang]["name"];
                partial.g = quest.genre;
                partial.l = (string)quest[lang]["location"];
                partial.s = quest.sort;
                if (quest.repeatable != null)
                    partial.r = 1;
                if (quest.unlocksFunction != null)
                    partial.f = 1;

                quests[(string)quest.id] = partial;
            }

            // NPCs
            var npcs = _partialsByLangTypeById[Tuple.Create(lang, "npc")] = new Dictionary<string, JObject>();
            foreach (var npc in _db.Npcs)
            {
                dynamic partial = new JObject();
                partial.i = npc.id;
                partial.n = (string)npc[lang]["name"];
                if (npc.zoneid != null)
                    partial.l = npc.zoneid;
                if (npc.shops != null)
                    partial.s = (int)npc.shops.Count;
                if (npc.quests != null)
                    partial.q = (int)npc.quests.Count;
                if (npc.talk != null)
                    partial.k = (int)npc.talk.Count;
                if (npc.title != null)
                    partial.t = npc.title;
                if (npc.trade == 1)
                    partial.r = 1;

                if (npc.shops != null || npc.trade == 1)
                {
                    if (npc.areaid != null)
                        partial.a = npc.areaid;
                    if (npc.coords != null)
                        partial.c = npc.coords;
                }

                npcs[(string)npc.id] = partial;
            }

            // Mobs
            var mobs = _partialsByLangTypeById[Tuple.Create(lang, "mob")] = new Dictionary<string, JObject>();
            foreach (var mob in _db.Mobs)
            {
                dynamic partial = new JObject();
                partial.i = mob.id;
                partial.n = (string)mob[lang]["name"];
                partial.l = mob.lvl;

                if (mob.zoneid != null)
                    partial.z = mob.zoneid;
                if (mob.instance != null)
                    partial.t = (string)_db.InstancesById[(int)mob.instance][lang]["name"];

                mobs[(string)mob.id] = partial;
            }

            // Instances
            var instances = _partialsByLangTypeById[Tuple.Create(lang, "instance")] = new Dictionary<string, JObject>();
            foreach (var instance in _db.Instances)
            {
                dynamic partial = new JObject();
                partial.i = instance.id;
                partial.n = (string)instance[lang]["name"];
                partial.c = instance.categoryIcon;
                partial.t = (string)instance[lang]["category"];

                partial.min_lvl = instance.min_lvl;
                if (instance.max_lvl != null)
                    partial.max_lvl = instance.max_lvl;
                if (instance.min_ilvl != null)
                    partial.min_ilvl = instance.min_ilvl;
                if (instance.max_ilvl != null)
                    partial.max_ilvl = instance.max_ilvl;

                instances[(string)instance.id] = partial;
            }

            // Items
            var items = _partialsByLangTypeById[Tuple.Create(lang, "item")] = new Dictionary<string, JObject>();
            foreach (var item in _db.Items)
            {
                dynamic partial = new JObject();
                partial.i = item.id;
                partial.n = (string)item[lang]["name"];
                partial.l = item.ilvl;
                partial.c = item.icon;
                partial.t = item.category;

                if (item.vendors != null)
                    partial.p = item.price;

                if (item.materia != null)
                    partial.materia = item.materia;

                items[(string)item.id] = partial;
            }

            // Fishing Spots
            var fishing = _partialsByLangTypeById[Tuple.Create(lang, "fishing")] = new Dictionary<string, JObject>();
            foreach (var spot in _db.FishingSpots)
            {
                dynamic partial = new JObject();
                partial.i = spot.id;
                partial.n = (string)spot[lang]["name"];
                partial.l = spot.lvl;
                partial.c = spot.category;

                if (spot.zoneid != null)
                    partial.z = spot.zoneid;
                if (spot.x != null)
                    partial.x = spot.x;
                if (spot.y != null)
                    partial.y = spot.y;

                fishing[(string)spot.id] = partial;
            }

            // Nodes
            var nodes = _partialsByLangTypeById[Tuple.Create(lang, "node")] = new Dictionary<string, JObject>();
            foreach (var node in _db.Nodes)
            {
                dynamic partial = new JObject();
                partial.i = node.id;
                partial.n = node.name;
                partial.l = node.lvl;
                partial.t = node.type;
                partial.z = node.zoneid;

                if (node.stars != null)
                    partial.s = node.stars;

                if (node.limitType != null)
                    partial.lt = node.limitType;

                if (node.time != null)
                    partial.ti = node.time;

                nodes[(string)node.id] = partial;
            }
        }

        void WriteCore(string lang)
        {
            // todo: get localized strings for all this stuff.

            dynamic core = new JObject();

            // Patches
            core.patch = new JObject();
            core.patch.current = GarlandDatabase.MajorPatches.Last().Id;

            core.patch.partialIndex = new JObject();
            foreach (var patch in GarlandDatabase.MajorPatches)
                core.patch.partialIndex.Add(patch.FormattedId, patch.ToJObject());

            core.patch.categoryIndex = new JObject();
            foreach (var category in PatchDatabase.ItemPatchCategories)
                core.patch.categoryIndex.Add(category.Key.ToString(), category.Value);

            // Experience
            core.xp = new JArray(_db.ExperienceToNextByLevel.Values);

            // Jobs
            core.jobs = new JArray(_db.Jobs);

            core.jobCategories = new JObject();
            foreach (var category in _db.JobCategories)
                core.jobCategories.Add((string)category.id, category);

            // Dyes
            core.dyes = new JObject();
            foreach (var dye in _db.Dyes)
                core.dyes.Add((string)dye.id, dye);

            // Nodes
            core.nodeBonusIndex = new JObject();
            foreach (var bonus in _db.NodeBonuses)
                core.nodeBonusIndex.Add((string)bonus.id, bonus);

            // Locations
            var relevantLocations = _db.Locations.Where(l => l.id < 0 || _db.LocationReferences.Contains((int)l.id)).ToArray();
            core.locationIndex = new JObject();
            foreach (var location in relevantLocations)
                core.locationIndex.Add((string)location.id, location);

            // Skywatcher
            core.skywatcher = new JObject();
            core.skywatcher.weatherIndex = new JArray(_db.Weather);

            core.skywatcher.weatherRateIndex = new JObject();
            foreach (var rate in _db.WeatherRates)
                core.skywatcher.weatherRateIndex.Add((string)rate.id, rate);

            // Quest Journal Genres
            core.questGenreIndex = new JObject();
            foreach (var genre in _db.QuestJournalGenres)
                core.questGenreIndex.Add((string)genre.id, genre);

            // Ventures
            core.ventureIndex = new JObject();
            foreach (var venture in _db.Ventures)
                core.ventureIndex.Add((string)venture.id, venture);

            // Action
            core.action = new JObject();
            core.action.categoryIndex = new JObject();
            foreach (var category in _db.ActionCategories)
                core.action.categoryIndex.Add((string)category.id, category);

            // Achievement Categories
            core.achievementCategoryIndex = new JObject();
            foreach (var category in _db.AchievementCategories)
                core.achievementCategoryIndex.Add((string)category.id, category);

            // Item
            core.item = new JObject();
            core.item.categoryIndex = new JObject();
            foreach (var category in _db.ItemCategories)
                core.item.categoryIndex.Add((string)category.id, category);

            core.item.specialBonusIndex = new JObject();
            foreach (var specialBonus in _db.ItemSpecialBonus)
                core.item.specialBonusIndex.Add((string)specialBonus.id, specialBonus);

            core.item.seriesIndex = new JObject();
            foreach (var series in _db.ItemSeries)
                core.item.seriesIndex.Add((string)series.id, series);

            // Embedded item partials and ingredients
            core.item.partialIndex = new JObject();
            foreach (var id in _db.EmbeddedPartialItemIds)
                core.item.partialIndex.Add(id.ToString(), _partialsByLangTypeById[Tuple.Create(lang, "item")][id.ToString()]);

            core.item.ingredients = new JObject();
            foreach (var item in _db.EmbeddedIngredientItems)
                core.item.ingredients[(string)item.id] = WrapperConverter.GetLocalizedData(GetIngredientDataCore(item), lang);

            // Done
            _update.IncludeDocument("data", "core", lang, 3, Json(core));
        }

        void WriteItems(string lang)
        {
            Parallel.ForEach(_db.Items, item =>
            {
                var json = Wrapper(GetItemData(item, lang));
                _update.IncludeDocument((string)item.id, "item", lang, 3, json);
            });
        }

        void WriteQuests(string lang)
        {
            Parallel.ForEach(_db.Quests, quest =>
            {
                var wrapper = new JsWrapper(lang, "quest", quest);
                AddPartials(wrapper, quest);
                _update.IncludeDocument((string)quest.id, "quest", lang, 2, Wrapper(wrapper));
            });
        }

        void WriteActions(string lang)
        {
            Parallel.ForEach(_db.Actions, action =>
            {
                var wrapper = new JsWrapper(lang, "action", action);
                AddPartials(wrapper, action);
                _update.IncludeDocument((string)action.id, "action", lang, 2, Wrapper(wrapper));
            });
        }

        void WriteNpcs(string lang)
        {
            Parallel.ForEach(_db.Npcs, npc =>
            {
                var wrapper = new JsWrapper(lang, "npc", npc);
                AddPartials(wrapper, npc);
                _update.IncludeDocument((string)npc.id, "npc", lang, 2, Wrapper(wrapper));
            });
        }

        void WriteEquipmentCalculators(string lang)
        {
            Parallel.ForEach(_db.LevelingEquipmentByJob, pair =>
            {
                var wrapper = new JsWrapper(lang, "equip", pair.Value);
                AddPartials(wrapper, pair.Value);
                _update.IncludeDocument("leveling-" + pair.Key, "equip", lang, 2, Wrapper(wrapper));
            });

            Parallel.ForEach(_db.EndGameEquipmentByJob, pair =>
            {
                var wrapper = new JsWrapper(lang, "equip", pair.Value);
                AddPartials(wrapper, pair.Value);
                _update.IncludeDocument("end-" + pair.Key, "equip", lang, 2, Wrapper(wrapper));
            });
        }

        void WriteAchievements(string lang)
        {
            Parallel.ForEach(_db.Achievements, achievement =>
            {
                var wrapper = new JsWrapper(lang, "achievement", achievement);
                AddPartials(wrapper, achievement);
                _update.IncludeDocument((string)achievement.id, "achievement", lang, 2, Wrapper(wrapper));
            });
        }

        void WriteInstances(string lang)
        {
            Parallel.ForEach(_db.Instances, instance =>
            {
                var wrapper = new JsWrapper(lang, "instance", instance);
                AddPartials(wrapper, instance);
                _update.IncludeDocument((string)instance.id, "instance", lang, 2, Wrapper(wrapper));
            });
        }

        void WriteFates(string lang)
        {
            Parallel.ForEach(_db.Fates, fate =>
            {
                var wrapper = new JsWrapper(lang, "fate", fate);
                AddPartials(wrapper, fate);
                _update.IncludeDocument((string)fate.id, "fate", lang, 2, Wrapper(wrapper));
            });
        }

        void WriteMobs(string lang)
        {
            Parallel.ForEach(_db.Mobs, mob =>
            {
                var wrapper = new JsWrapper(lang, "mob", mob);
                AddPartials(wrapper, mob);
                _update.IncludeDocument((string)mob.id, "mob", lang, 2, Wrapper(wrapper));
            });
        }

        void WriteLeves(string lang)
        {
            Parallel.ForEach(_db.Leves, leve =>
            {
                _update.IncludeDocument((string)leve.id, "leve", lang, 3, Wrapper(GetLeveData(leve, lang)));
            });
        }

        void WriteFish(string lang)
        {
            Parallel.ForEach(_db.FishingSpots, spot =>
            {
                var wrapper = new JsWrapper(lang, "fishing", spot);
                AddPartials(wrapper, spot);
                _update.IncludeDocument((string)spot.id, "fishing", lang, 2, Wrapper(wrapper));
            });

            // Garland Bell and FFXIVFisher data.

            var parts = new List<string>();

            // Bait
            var baitData = new JObject();
            foreach (var bait in _db.Baits)
                baitData.Add((string)bait.name, bait);
            parts.Add("gt.bell.bait = " + Json(baitData, Formatting.Indented));

            // Fish
            var fishData = new JArray(_db.Fish);
            parts.Add("gt.bell.fish = " + Json(fishData, Formatting.Indented));

            parts.Add("");
            FileDatabase.WriteFile("Garland.Web\\bell\\fish.js", string.Join(";\r\n\r\n", parts));
        }

        void WriteNodes(string lang)
        {
            Parallel.ForEach(_db.Nodes, node =>
            {
                var wrapper = new JsWrapper(lang, "node", node);
                AddPartials(wrapper, node);
                _update.IncludeDocument((string)node.id, "node", lang, 2, Wrapper(wrapper));
            });

            // Garland Bell node data.

            var contents = "gt.bell.nodes = " + Json(_db.NodeViews, Formatting.Indented) + ";\r\n";
            FileDatabase.WriteFile("Garland.Web\\bell\\nodes.js", contents);
        }

        void WriteBrowsers(string lang)
        {
            string wrap(IEnumerable<JObject> p) => "{\"browse\":" + Json(p) + "}";

            _update.IncludeDocument("action", "browse", lang, 2, wrap(_partialsByLangTypeById[Tuple.Create(lang, "action")].Values));
            _update.IncludeDocument("achievement", "browse", lang, 2, wrap(_partialsByLangTypeById[Tuple.Create(lang, "achievement")].Values));
            _update.IncludeDocument("instance", "browse", lang, 2, wrap(_partialsByLangTypeById[Tuple.Create(lang, "instance")].Values));
            _update.IncludeDocument("quest", "browse", lang, 2, wrap(_partialsByLangTypeById[Tuple.Create(lang, "quest")].Values));
            _update.IncludeDocument("fate", "browse", lang, 2, wrap(_partialsByLangTypeById[Tuple.Create(lang, "fate")].Values));
            _update.IncludeDocument("leve", "browse", lang, 2, wrap(_partialsByLangTypeById[Tuple.Create(lang, "leve")].Values));
            _update.IncludeDocument("npc", "browse", lang, 2, wrap(_partialsByLangTypeById[Tuple.Create(lang, "npc")].Values));
            _update.IncludeDocument("mob", "browse", lang, 2, wrap(_partialsByLangTypeById[Tuple.Create(lang, "mob")].Values));
            _update.IncludeDocument("fishing", "browse", lang, 2, wrap(_partialsByLangTypeById[Tuple.Create(lang, "fishing")].Values));
            _update.IncludeDocument("node", "browse", lang, 2, wrap(_partialsByLangTypeById[Tuple.Create(lang, "node")].Values));
        }

        #region Utility
        JsWrapper GetItemData(dynamic item, string lang)
        {
            var wrapper = new JsWrapper(lang, "item", item);

            // Fill recipe components.
            var componentIds = GetItemComponents(Utils.Unbox(item.id));
            var partials = new List<JsPartial>();
            var ingredients = new List<JObject>();
            foreach (var id in componentIds)
            {
                object ingredientItem = _db.ItemsById[id];
                var ingredient = GetIngredientData(ingredientItem);
                if (ingredient == null)
                    continue;

                ingredients.Add(ingredient);

                var ingredientPartials = GetPartials(ingredientItem, lang, true);
                CombinePartials(partials, ingredientPartials);
            }

            if (ingredients.Count > 0)
                wrapper.Ingredients = ingredients;

            if (partials.Count > 0)
                wrapper.Partials = partials;

            AddPartials(wrapper, item);

            return wrapper;
        }

        JObject GetIngredientData(dynamic item)
        {
            if (_ingredientsByItem.TryGetValue(item, out dynamic ingredient))
                return ingredient;

            // Crystals are embedded.
            if (item.category == 59)
            {
                _ingredientsByItem[item] = null;
                return null;
            }

            ingredient = GetIngredientDataCore(item);
            _ingredientsByItem[item] = ingredient;
            return ingredient;
        }

        JObject GetIngredientDataCore(dynamic item)
        {
            // Build the ingredient - a smaller subset of item data used for crafting.
            dynamic ingredient = new JObject();

            ingredient.id = item.id;
            ingredient.en = new JObject(new JProperty("name", item.en.name));
            ingredient.ja = new JObject(new JProperty("name", item.ja.name));
            ingredient.de = new JObject(new JProperty("name", item.de.name));
            ingredient.fr = new JObject(new JProperty("name", item.fr.name));
            ingredient.icon = item.icon;
            ingredient.category = item.category;
            ingredient.ilvl = item.ilvl;
            if (item.price != null)
                ingredient.price = item.price;
            if (item.reducedFrom != null)
                ingredient.reducedFrom = item.reducedFrom;
            if (item.craft != null)
                ingredient.craft = item.craft;
            if (item.voyages != null)
                ingredient.voyages = item.voyages;
            if (item.desynthedFrom != null)
                ingredient.desynthedFrom = item.desynthedFrom;
            if (item.treasure != null)
                ingredient.treasure = item.treasure;
            if (item.tradeShops != null)
                ingredient.tradeShops = item.tradeShops;
            if (item.fates != null)
                ingredient.fates = item.fates;
            if (item.instances != null)
                ingredient.instances = item.instances;
            if (item.leves != null)
                ingredient.leves = item.leves;
            if (item.ventures != null)
                ingredient.ventures = item.ventures;
            if (item.fishingSpots != null)
                ingredient.fishingSpots = item.fishingSpots;
            if (item.drops != null)
                ingredient.drops = item.drops;
            if (item.nodes != null)
                ingredient.nodes = item.nodes;
            if (item.vendors != null)
            {
                var vendors = new JArray();
                // Filter event NPCs from this list of vendors.
                foreach (int vendorId in item.vendors)
                {
                    if (_db.NpcsById[vendorId]["event"] == 1)
                        continue;
                    vendors.Add(vendorId);
                }

                if (vendors.Count > 0)
                    ingredient.vendors = vendors;
            }
            if (item.seeds != null)
                ingredient.seeds = item.seeds;

            return ingredient;
        }

        JsWrapper GetLeveData(dynamic leve, string lang)
        {
            var wrapper = new JsWrapper(lang, "leve", leve);

            if (leve.rewards != null)
                wrapper.Rewards = _db.LeveRewardsById[(int)leve.rewards];

            if (leve.requires != null)
            {
                wrapper.Ingredients = new List<JObject>();
                var partials = new List<JsPartial>();
                foreach (var req in leve.requires)
                {
                    object item = _db.ItemsById[(int)req.item];
                    wrapper.Ingredients.Add(GetIngredientData(item));

                    var itemData = GetItemData(item, lang);
                    if (itemData.Ingredients != null)
                        wrapper.Ingredients.AddRange(itemData.Ingredients);
                    if (itemData.Partials != null)
                        partials.AddRange(itemData.Partials);
                }

                if (partials.Count > 0)
                    wrapper.Partials = partials;
            }

            AddPartials(wrapper, leve);

            return wrapper;
        }

        HashSet<int> GetItemComponents(object itemId)
        {
            if (_componentsByItemId.TryGetValue(itemId, out var components))
                return components;

            var item = _db.ItemsById[itemId];

            if (item.craft == null)
            {
                _componentsByItemId[itemId] = components = new HashSet<int>();
                return components;
            }

            components = new HashSet<int>();
            foreach (var craft in item.craft)
            {
                foreach (var ingredientInfo in craft.ingredients)
                {
                    var ingredientId = (int)ingredientInfo.id;
                    components.Add(ingredientId);

                    foreach (var subIngredientId in GetItemComponents(ingredientId))
                        components.Add(subIngredientId);
                }
            }

            _componentsByItemId[itemId] = components;
            return components;
        }

        static string Wrapper(object value)
        {
            return JsonConvert.SerializeObject(value, _converters);
        }

        static string Json(object value, Formatting formatting = Formatting.None)
        {
            return JsonConvert.SerializeObject(value, formatting);
        }

        public JObject GetPartial(string type, string lang, string id)
        {
            return _partialsByLangTypeById[Tuple.Create(lang, type)][id];
        }

        public JObject GetPartialOrNull(string type, string lang, string id)
        {
            return _partialsByLangTypeById[Tuple.Create(lang, type)].TryGetValue(id, out var result) ? result : null;
        }

        void AddPartials(JsWrapper wrapper, object source)
        {
            var partials = GetPartials(source, wrapper.Lang, false);
            if (partials != null && partials.Count > 0)
            {
                if (wrapper.Partials == null)
                {
                    wrapper.Partials = partials;
                    return;
                }

                CombinePartials(wrapper.Partials, partials);
            }
        }

        List<JsPartial> GetPartials(object source, string lang, bool isNestedOnly)
        {
            if (!_db.DataReferencesBySource.TryGetValue(source, out var list))
                return null;

            var partials = new List<JsPartial>();
            foreach (var dataRef in list)
            {
                if (isNestedOnly && !dataRef.IsNested)
                    continue;

                dynamic obj = _partialsByLangTypeById[Tuple.Create(lang, dataRef.Type)][dataRef.Id];
                if (IsPartialObjectSkipped(dataRef, obj))
                    continue;

                var partial = new JsPartial(dataRef.Type, dataRef.Id, obj);
                partials.Add(partial);
            }
            return partials;
        }

        void CombinePartials(List<JsPartial> main, List<JsPartial> supplement)
        {
            // todo: make partials list a dictionary for faster lookups.

            if (supplement == null)
                return;

            foreach (var partial in supplement)
            {
                if (!main.Any(p => p.Type == partial.Type && p.Id == partial.Id))
                    main.Add(partial);
            }
        }

        static bool IsPartialObjectSkipped(DataReference dataRef, dynamic obj)
        {
            if (dataRef.Type == "item" && obj.t == 59)
                return true; // Crystals are embedded.

            return false;
        }
        #endregion
    }
}
