using Garland.Data.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data
{
    public class GarlandDatabase
    {
        // NOTE: This section must be updated with every patch!
        public const decimal NextPatch = 5.01m;
        public static Patch[] MajorPatches = new[] {
            new Patch(1m, "Legacy", "Legacy"),

            new Patch(2m, "A Realm Reborn", "A Realm Reborn"),
            new Patch(2.1m, "A Realm Awoken", "A Realm Reborn"),
            new Patch(2.2m, "Through the Maelstrom", "A Realm Reborn"),
            new Patch(2.3m, "Defenders of Eorzea", "A Realm Reborn"),
            new Patch(2.4m, "Dreams of Ice", "A Realm Reborn"),
            new Patch(2.5m, "Before the Fall", "A Realm Reborn"),

            new Patch(3m, "Heavensward", "Heavensward"),
            new Patch(3.1m, "As Goes Light, So Goes Darkness", "Heavensward"),
            new Patch(3.2m, "The Gears of Change", "Heavensward"),
            new Patch(3.3m, "Revenge of the Horde", "Heavensward"),
            new Patch(3.4m, "Soul Surrender", "Heavensward"),
            new Patch(3.5m, "The Far Edge of Fate", "Heavensward"),

            new Patch(4m, "Stormblood", "Stormblood"),
            new Patch(4.1m, "The Legend Returns", "Stormblood"),
            new Patch(4.2m, "Rise of a New Sun", "Stormblood"),
            new Patch(4.3m, "Under the Moonlight", "Stormblood"),
            new Patch(4.4m, "Prelude in Violet", "Stormblood"),
            new Patch(4.5m, "A Requiem for Heroes", "Stormblood"),

            new Patch(5m, "Shadowbringers", "Shadowbringers")
        };

        public static int LevelCap = -1; // Filled in from Miscellaneous.
        public static int BlueMageLevelCap = 50;

        public HashSet<int> LocationReferences = new HashSet<int>();
        public Dictionary<object, List<DataReference>> DataReferencesBySource = new Dictionary<object, List<DataReference>>();
        public List<int> EmbeddedPartialItemIds = new List<int>();
        public List<dynamic> EmbeddedIngredientItems = new List<dynamic>();
        public HashSet<int> IgnoredCurrencyItemIds = new HashSet<int>();

        public List<dynamic> Items = new List<dynamic>();
        public List<dynamic> Mobs = new List<dynamic>();
        public List<dynamic> Locations = new List<dynamic>();
        public List<dynamic> Nodes = new List<dynamic>();
        public List<dynamic> NodeBonuses = new List<dynamic>();
        public List<dynamic> Npcs = new List<dynamic>();
        public List<dynamic> Instances = new List<dynamic>();
        public List<dynamic> Quests = new List<dynamic>();
        public List<dynamic> QuestJournalGenres = new List<dynamic>();
        public List<dynamic> FishingSpots = new List<dynamic>();
        public List<dynamic> Leves = new List<dynamic>();
        public List<dynamic> WeatherRates = new List<dynamic>();
        public List<string> Weather = new List<string>();
        public List<dynamic> Achievements = new List<dynamic>();
        public List<dynamic> AchievementCategories = new List<dynamic>();
        public List<dynamic> Fates = new List<dynamic>();
        public List<dynamic> DutyRoulette = new List<dynamic>();
        public List<dynamic> ItemCategories = new List<dynamic>();
        public List<dynamic> ItemSeries = new List<dynamic>();
        public List<dynamic> ItemSpecialBonus = new List<dynamic>();
        public List<dynamic> JobCategories = new List<dynamic>();
        public List<dynamic> Ventures = new List<dynamic>();
        public List<dynamic> Actions = new List<dynamic>();
        public List<dynamic> ActionCategories = new List<dynamic>();
        public List<dynamic> Baits = new List<dynamic>();
        public List<dynamic> Jobs = new List<dynamic>();
        public List<dynamic> Dyes = new List<dynamic>();
        public List<dynamic> Statuses = new List<dynamic>();

        public dynamic MateriaJoinRates;

        public Dictionary<string, JArray> LevelingEquipmentByJob = new Dictionary<string, JArray>();
        public Dictionary<string, JObject> EndGameEquipmentByJob = new Dictionary<string, JObject>();
        public Dictionary<int, int> ExperienceToNextByLevel = new Dictionary<int, int>();

        public Dictionary<object, dynamic> ItemsById = new Dictionary<object, dynamic>();
        public Dictionary<int, dynamic> NpcsById = new Dictionary<int, dynamic>();
        public Dictionary<int, dynamic> LeveRewardsById = new Dictionary<int, dynamic>();
        public Dictionary<int, dynamic> InstancesById = new Dictionary<int, dynamic>();
        public Dictionary<int, dynamic> ActionsById = new Dictionary<int, dynamic>();
        public Dictionary<int, dynamic> FishingSpotsById = new Dictionary<int, dynamic>();
        public Dictionary<int, dynamic> QuestsById = new Dictionary<int, dynamic>();
        public Dictionary<int, dynamic> LocationsById = new Dictionary<int, dynamic>();
        public Dictionary<string, int> LocationIdsByName = new Dictionary<string, int>();
        public Dictionary<string, dynamic> ItemsByName = new Dictionary<string, dynamic>();
        public Dictionary<int, List<dynamic>> ItemsByInstanceId = new Dictionary<int, List<dynamic>>();
        public Dictionary<int, List<dynamic>> ItemsBySeriesId = new Dictionary<int, List<dynamic>>();
        public Dictionary<int, dynamic> NodesById = new Dictionary<int, dynamic>();
        public Dictionary<string, dynamic> SpearfishingNodesByName = new Dictionary<string, dynamic>();
        public Dictionary<int, dynamic> VenturesById = new Dictionary<int, dynamic>();
        public Dictionary<int, dynamic> StatusesById = new Dictionary<int, dynamic>();

        public static HashSet<string> LocalizedTypes = new HashSet<string>() { "achievement", "action", "fate", "fishing", "instance", "item", "leve", "quest", "npc", "mob", "status" };

        // Views
        public List<dynamic> NodeViews = new List<dynamic>();
        public List<dynamic> Fish = new List<dynamic>();

        #region Singleton
        private GarlandDatabase() { }

        public static GarlandDatabase Instance { get; } = new GarlandDatabase();
        #endregion

        public void AddLocationReference(int id)
        {
            if (id <= 10)
                throw new InvalidOperationException();

            LocationReferences.Add(id);
        }

        public void AddReference(object source, string type, string id, bool isNested)
        {
            if (!DataReferencesBySource.TryGetValue(source, out var list))
                DataReferencesBySource[source] = list = new List<DataReference>();

            AddReference(list, type, id, isNested);
        }

        public void AddReference(object source, string type, int id, bool isNested)
        {
            AddReference(source, type, id.ToString(), isNested);
        }

        public void AddReference(object source, string type, IEnumerable<int> ids, bool isNested)
        {
            if (!DataReferencesBySource.TryGetValue(source, out var list))
                DataReferencesBySource[source] = list = new List<DataReference>();

            foreach (var id in ids)
                AddReference(list, type, id.ToString(), isNested);
        }

        public void AddReference(object source, string type, IEnumerable<string> ids, bool isNested)
        {
            if (!DataReferencesBySource.TryGetValue(source, out var list))
                DataReferencesBySource[source] = list = new List<DataReference>();

            foreach (var id in ids)
                AddReference(list, type, id, isNested);
        }

        void AddReference(List<DataReference> list, string type, string id, bool isNested)
        {
            if (list.Any(dr => dr.Type == type && dr.Id == id))
                return; // Skip dupes.

            list.Add(new DataReference(type, id, isNested));
        }
    }
}
