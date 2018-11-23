using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Output
{
    public class SearchOutput
    {
        GarlandDatabase _db;
        JsOutput _jsout;
        UpdatePackage _update;

        public SearchOutput(JsOutput jsout, UpdatePackage update)
        {
            _db = GarlandDatabase.Instance;
            _jsout = jsout;
            _update = update;
        }

        public void Write()
        {
            WriteIndex();
            WriteItems();
        }

        void WriteIndex()
        {
            // Items
            foreach (var item in _db.Items)
                WriteIndex(item, "item", (string)item.en.name, (string)item.fr.name, (string)item.de.name, (string)item.ja.name);

            // Nodes
            foreach (var node in _db.Nodes)
                WriteIndex(node, "node", (string)node.name, null, null, null);

            // Fishing Spots
            foreach (var spot in _db.FishingSpots)
                WriteIndex(spot, "fishing", (string)spot.en.name, (string)spot.fr.name, (string)spot.de.name, (string)spot.ja.name);

            // Mobs
            foreach (var mob in _db.Mobs)
                WriteIndex(mob, "mob", (string)mob.en.name, (string)mob.fr.name, (string)mob.de.name, (string)mob.ja.name);

            // NPCs
            var npcNamesUsed = new HashSet<string>();
            foreach (var npc in _db.Npcs)
            {
                var key = (string)npc.en.name;

                // NPCs only need to appear once per name.  Skip duplicates.
                // Alternate instances can be looked up via the alts UI.
                if (npcNamesUsed.Contains(key))
                    continue;

                npcNamesUsed.Add(key);

                // todo: localize title too
                if (npc.title != null)
                    key += " " + (string)npc.title;
                WriteIndex(npc, "npc", key, (string)npc.fr.name, (string)npc.de.name, (string)npc.ja.name);
            }

            // Actions
            foreach (var action in _db.Actions)
                WriteIndex(action, "action", (string)action.en.name, (string)action.fr.name, (string)action.de.name, (string)action.ja.name);

            // Leves
            foreach (var leve in _db.Leves)
                WriteIndex(leve, "leve", (string)leve.en.name, (string)leve.fr.name, (string)leve.de.name, (string)leve.ja.name);

            // Quests
            foreach (var quest in _db.Quests)
                WriteIndex(quest, "quest", (string)quest.en.name, (string)quest.fr.name, (string)quest.de.name, (string)quest.ja.name);

            // Achievements
            foreach (var achievement in _db.Achievements)
                WriteIndex(achievement, "achievement", (string)achievement.en.name, (string)achievement.fr.name, (string)achievement.de.name, (string)achievement.ja.name);

            // Instances
            foreach (var instance in _db.Instances)
                WriteIndex(instance, "instance", (string)instance.en.name, (string)instance.fr.name, (string)instance.de.name, (string)instance.ja.name);

            // Fates
            foreach (var fate in _db.Fates)
                WriteIndex(fate, "fate", (string)fate.en.name, (string)fate.fr.name, (string)fate.de.name, (string)fate.ja.name);
        }

        void WriteItems()
        {
            var itemRows = new List<SearchItemRow>();
            var recipeRows = new List<SearchRecipeRow>();

            foreach (var item in _db.Items)
            {
                var itemRow = new SearchItemRow()
                {
                    Id = (string)item.id,
                    ItemLevel = (short)item.ilvl,
                    Rarity = (item.rarity == null || item.rarity == 0) ? (byte)0 : (byte)item.rarity,
                    Category = (short)item.category,
                    Jobs = item.jobs == null ? (byte)0 : (byte)item.jobs,
                    EquipLevel = item.elvl == null ? (byte)0 : (byte)item.elvl,
                    IsPvP = item.pvp != null,
                    IsCraftable = item.craft != null,
                    IsDesynthable = item.desynthSkill != null,
                    IsCollectable = item.collectable != null
                };
                itemRow.Json = JsonConvert.SerializeObject(itemRow);
                itemRows.Add(itemRow);

                if (item.craft != null)
                {
                    foreach (var recipe in item.craft)
                    {
                        var recipeRow = new SearchRecipeRow()
                        {
                            Id = (string)recipe.id,
                            ItemId = itemRow.Id,
                            Job = (byte)recipe.job,
                            JobLevel = (short)recipe.lvl,
                            Stars = recipe.stars == null ? (byte)0 : (byte)recipe.stars,
                            RecipeLevel = recipe.rlvl
                        };

                        recipeRow.Json = JsonConvert.SerializeObject(recipeRow);
                        recipeRows.Add(recipeRow);
                    }
                }
            }

            foreach (var itemRow in itemRows)
                _update.Include(itemRow);

            foreach (var recipeRow in recipeRows)
                _update.Include(recipeRow);
        }

        void WriteIndex(dynamic obj, string type, string key_en, string key_fr, string key_de, string key_ja)
        {
            var id = (string)obj.id;

            if (!string.IsNullOrEmpty(key_en))
                _update.Include(new SearchRow() { Id = id, Type = type, Lang = "en", Name = key_en, Json = JsonConvert.SerializeObject(GetSearchPartial(obj, type, "en", id)) });

            if (!string.IsNullOrEmpty(key_fr))
                _update.Include(new SearchRow() { Id = id, Type = type, Lang = "fr", Name = key_fr, Json = JsonConvert.SerializeObject(GetSearchPartial(obj, type, "fr", id)) });

            if (!string.IsNullOrEmpty(key_de))
                _update.Include(new SearchRow() { Id = id, Type = type, Lang = "de", Name = key_de, Json = JsonConvert.SerializeObject(GetSearchPartial(obj, type, "de", id)) });

            if (!string.IsNullOrEmpty(key_ja))
                _update.Include(new SearchRow() { Id = id, Type = type, Lang = "ja", Name = key_ja, Json = JsonConvert.SerializeObject(GetSearchPartial(obj, type, "ja", id)) });
        }

        dynamic GetSearchPartial(dynamic obj, string type, string lang, string id)
        {
            dynamic partial = _jsout.GetPartial(type, lang, id);

            // Non-items pass their base partials over.
            if (type != "item")
                return partial;

            // Item partials need additional filter data added.
            partial.g = obj.patchCategory;

            if (obj.pvp != null)
                partial.v = 1;
            if (obj.craft != null)
                partial.f = new JArray(((JArray)obj.craft).Select(GetCraftData));
            if (obj.desynthSkill != null)
                partial.d = obj.desynthSkill;
            if (obj.jobs != null)
                partial.j = obj.jobs;
            if (obj.rarity != null && obj.rarity != 0)
                partial.r = obj.rarity;
            if (obj.elvl != null)
                partial.e = obj.elvl;
            if (obj.collectable != null)
                partial.o = 1;

            return partial;
        }

        dynamic GetCraftData(dynamic craft)
        {
            dynamic obj = new JObject();
            obj.id = craft.id;
            obj.job = craft.job;
            obj.lvl = craft.lvl;
            if (craft.stars != null)
                obj.stars = craft.stars;
            return obj;
        }
    }
}
