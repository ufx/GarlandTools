using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    // This needs a much more complicated approach.
    
    public class ItemSets : Module
    {
        static char[] _space = new char[] { ' ' };
        static HashSet<string> _ignoredWords = new HashSet<string>(new string[] {
            "Pair", "the", "The",
            "Augmented", "Dated", "Aetherial",
            "Ornate",
            "Boots", "Belt", "Ring", "Gloves", "Earrings", "Choker", "Gauntlets", "Breeches",
            "Bracelet", "Coat", "Trousers", "Sabatons", "Hat", "Helm", "Thighboots", "Necklace",
            "Armguards", "Robe", "Circlet", "Cuirass", "Sollerets", "Mask", "Bottoms", "Slops",
            "Earring", "Jacket", "Mail", "Sash", "Bracelets", "Tunic", "Hose", "Corsage", "Greaves",
            "Doublet", "Fingerless", "Armillae", "Shoes", "Plate", "Armor", "Cap", "Obi", "Kawa-obi",
            "Tassets", "Brais", "Coif", "Gaskins", "Tabard", "Vest", "Bracers", "Tekko", "Shirt",
            "Dress", "Halfgloves", "Duckbills", "Skirt", "Gown", "Sarouel", "Tights", "Cowl",
            "Hammer", "Knife", "Needle", "Alembic", "Saw", "Wheel", "Hatchet", "Sandals", "Hood",
            "Kote", "Sune-ate", "Coatee", "Vambraces", "Neckband", "Ringbelt", "Corset",
            "Ringbands", "Leggings", "Leg", "Wristbands", "Pattens", "Beret",
            "Shield", "Sword", "Daggers", "Greatsword", "Claws", "Bow", "Grimoire", "Cane", "Rod",
            "Gladius", "Dagger", "Spatha", "Falchion", "Longsword", "Macuahuitl", "Cesti", "Hora",
            "Bardiche", "Bhuj", "Labrys", "Lance", "Shortbow", "Composite", "Baghnakhs", "Halbard",
            "Harpoon", "Guisarme", "Spectacles", "Bandana", "Acton", "Moccasins", "Jackboots", "Satchel",
            "Shortsword", "Scimitar", "Cutlass", "Battleaxe", "Jerkin", "Halfrobe", "Culottes",
            "Hooks", "Patas", "Halberd", "Fork", "Bill", "Trident", "Cudgel", "Brand", "Buckler",
            "Scutum", "Targe", "Picatrix", "Bastard", "Hoplon", "Knives", "Lantern",
            "Awl", "Cross-pein", "File", "Pliers", "Lapidary", "Pelta", "Kite", "Round", "Kabuto",
            "Barbut",
            "Chaser", "Grinding", "Head", "Mortar", "Skillet", "Frypan", "Luminary",
            "Raising", "Dorning", "Fishing", "Dolabra", "Sledgehammer",
            "Axe", "Wand", "Staff", "Knuckles", "Katana", "Spear", "Codex", "Musketoon", "Rapier",
            "Longbow", "Globe", "Claw", "Scepter", "Planisphere", "Pickaxe", "Book", "Crook",
            "Maiming", "Fending", "Casting", "Healing", "Aiming", "Striking", "Scouting", "Slaying",
            "Protector's", "Skinner's", "Tracker's", "Soother's", "Whisperer's", "Wildling's", "Priest's",
            "Gathering", "Crafting", "Spinning",
            "(Green)", "(Red)", "(Brown)", "(Blue)", "(Black)", "(Yellow)", "(Grey)", "(Pink)",
            "(Auburn)", "(Beige)", "(Ochre)",
        });

        Dictionary<Saint.ClassJobCategory, Saint.ClassJobCategory> _classJobCategorySubsets = new Dictionary<Saint.ClassJobCategory, Saint.ClassJobCategory>();

        public override string Name => "Item Sets";

        public override void Start()
        {
            IndexClassJobCategories();

            var sets = FilterItemsIntoSetLists();
            var orderedSets = sets.OrderByDescending(s => s.Items.Count).ToArray();
            var oppSets = sets.OrderBy(s => s.Items.Count).ToArray();
            foreach (var set in orderedSets)
            {
                DatabaseBuilder.PrintLine($"ItemSet {set}");
                // fixme: ban a lot of words, find uniqueness.
            }

            throw new NotImplementedException();
        }

        void IndexClassJobCategories()
        {
            var sClassJobCategories = _builder.Sheet<Saint.ClassJobCategory>();

            // Disciples of War or Magic
            IndexClassJobCategorySubsets(sClassJobCategories[34]);
            // Disciple of the Land
            IndexClassJobCategorySubsets(sClassJobCategories[32]);
            // Disciple of the Hand
            IndexClassJobCategorySubsets(sClassJobCategories[33]);
        }

        void IndexClassJobCategorySubsets(Saint.ClassJobCategory primary)
        {
            foreach (var sClassJobCategory in _builder.Sheet<Saint.ClassJobCategory>())
            {
                if (sClassJobCategory.Key <= 1)
                    continue;

                // No duplicates.
                if (_classJobCategorySubsets.ContainsKey(sClassJobCategory))
                    continue;

                var isSubset = true;
                foreach (var sClassJob in sClassJobCategory.ClassJobs)
                {
                    if (!primary.ClassJobs.Contains(sClassJob))
                    {
                        isSubset = false;
                        break;
                    }
                }

                if (isSubset)
                    _classJobCategorySubsets[sClassJobCategory] = primary;
            }
        }

        List<ItemSetList> FilterItemsIntoSetLists()
        {
            var itemSetsByIdentifierAndCategory = new Dictionary<Tuple<string, Saint.ClassJobCategory>, ItemSetList>();

            var sItems = _builder.ItemsToImport
                .OfType<Saint.Items.Equipment>();
            foreach (var sItem in sItems)
            {
                var name = sItem.Name.ToString();
                var words = name.Split(_space)
                    .Where(w => w.Length > 2)
                    .Where(w => !_ignoredWords.Contains(w))
                    .ToArray();
                var identifier = string.Join(" ", words);

                // Determine the target ClassJobCategory.
                Saint.ClassJobCategory sClassJobCategoryTarget;
                if (sItem.ClassJobCategory.Key == 1) // All Classes
                    sClassJobCategoryTarget = sItem.ClassJobCategory;
                else
                    sClassJobCategoryTarget = _classJobCategorySubsets[sItem.ClassJobCategory];

                // Collect this item into a set based on word identifiers.
                var key = Tuple.Create(identifier, sClassJobCategoryTarget);
                if (!itemSetsByIdentifierAndCategory.TryGetValue(key, out var itemSet))
                {
                    // Create a new set for this word/category combo.
                    itemSet = new ItemSetList()
                    {
                        Identifier = identifier,
                        ClassJobCategory = sClassJobCategoryTarget
                    };
                    itemSetsByIdentifierAndCategory[key] = itemSet;
                }

                itemSet.Items.Add(sItem);
            }

            return itemSetsByIdentifierAndCategory.Values.ToList();
        }

        class ItemSetList
        {
            public List<Saint.Item> Items = new List<Saint.Item>();
            public Saint.ClassJobCategory ClassJobCategory;
            public string Identifier;

            public override string ToString() => $"{Identifier}: {Items.Count}";
        }
    }
}
