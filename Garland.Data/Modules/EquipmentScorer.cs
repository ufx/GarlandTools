using Garland.Data.Helpers;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class EquipmentScorer : Module
    {
        public override string Name => "Equipment Scores";

        Dictionary<int, JobData> _jobsByKey = new Dictionary<int, JobData>();
        readonly double[,] OvermeldPenalties = new double[,]
        {
            // T1, T2,  T3,  T4,  T5,  T6,  T7,  T8
            { 0,   0.5, 1.0, 1.5, 3.0, 6.0, 3.0, 6.0 }, // Slot 2
            { 0.5, 1.0, 1.5, 2.0, 3.5, 7.0, 3.5, 7.0 }, // Slot 3
            { 1.0, 1.5, 2.0, 2.5, 4.0, 8.0, 4.0, 8.0 }, // Slot 4
            { 1.5, 2.0, 2.5, 3.0, 4.5, 9.0, 4.5, 9.0 }  // Slot 5
        };
        const double OvermeldPenalty = 2.0;

        void Initialize(Saint.BaseParam[] sBaseParams, Saint.Materia[] sMateria)
        {
            // Monk
            _jobsByKey[20] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15), new SW("Strength", 1),
                new SW("Determination", .001), new SW("Skill Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });
            _jobsByKey[2] = _jobsByKey[20]; // Pugilist

            // Dragoon
            _jobsByKey[22] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15), new SW("Strength", 1),
                new SW("Determination", .001), new SW("Skill Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });
            _jobsByKey[4] = _jobsByKey[22]; // Lancer

            // Bard
            _jobsByKey[23] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15), new SW("Dexterity", 1),
                new SW("Determination", .001), new SW("Skill Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });
            _jobsByKey[5] = _jobsByKey[23]; // Archer

            // Machinist
            _jobsByKey[31] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15), new SW("Dexterity", 1),
                new SW("Determination", .001), new SW("Skill Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });

            // Black Mage
            _jobsByKey[25] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Magic Damage", 15), new SW("Intelligence", 1),
                new SW("Determination", .001), new SW("Spell Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });
            _jobsByKey[7] = _jobsByKey[25]; // Thaumaturge

            // Summoner (Garuda)
            _jobsByKey[27] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Magic Damage", 15), new SW("Intelligence", 1),
                new SW("Determination", .001), new SW("Spell Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });
            _jobsByKey[26] = _jobsByKey[27]; // Arcanist

            // Ninja
            _jobsByKey[30] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15), new SW("Dexterity", 1),
                new SW("Determination", .001), new SW("Skill Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });
            _jobsByKey[29] = _jobsByKey[30]; // Rogue

            // Samurai
            _jobsByKey[34] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15), new SW("Strength", 1),
                new SW("Determination", .001), new SW("Skill Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });

            // Red Mage
            _jobsByKey[35] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Magic Damage", 15), new SW("Intelligence", 1),
                new SW("Determination", .001), new SW("Spell Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });

            // Blue Mage
            _jobsByKey[36] = new JobData(GarlandDatabase.BlueMageLevelCap, new SW[] {
                new SW("Magic Damage", 15), new SW("Intelligence", 1),
                new SW("Determination", .001), new SW("Spell Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });

            // Warrior (Defiance)
            _jobsByKey[21] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15),
                new SW("Vitality", 1.3), new SW("Strength", 1),
                new SW("Defense", 2), new SW("Magic Defense", 2)
            });
            _jobsByKey[3] = _jobsByKey[21]; // Marauder

            // Paladin (Shield Oath)
            _jobsByKey[19] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15),
                new SW("Vitality", 1.3), new SW("Strength", 1),
                new SW("Defense", 2), new SW("Magic Defense", 2),
                new SW("Block Strength", 2), new SW("Block Rate", 2)
            });
            _jobsByKey[1] = _jobsByKey[19]; // Gladiator

            // Dark Knight
            _jobsByKey[32] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15),
                new SW("Vitality", 1.3), new SW("Strength", 1),
                new SW("Defense", 2), new SW("Magic Defense", 2)
            });

            // White Mage
            _jobsByKey[24] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Magic Damage", 15),
                new SW("Mind", 1), new SW("Vitality", .1),
                new SW("Defense", .5, true), new SW("Magic Defense", .5, true),
                new SW("Determination", .001), new SW("Spell Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });
            _jobsByKey[6] = _jobsByKey[24]; // Conjurer

            // Astrologian
            _jobsByKey[33] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Magic Damage", 15),
                new SW("Mind", 1), new SW("Vitality", .1),
                new SW("Defense", .5, true), new SW("Magic Defense", .5, true),
                new SW("Determination", .001), new SW("Spell Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });

            // Scholar
            _jobsByKey[28] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Magic Damage", 15),
                new SW("Mind", 1), new SW("Vitality", .1),
                new SW("Defense", .5, true), new SW("Magic Defense", .5, true),
                new SW("Determination", .001), new SW("Spell Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });

            // Gunbreaker
            _jobsByKey[37] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15),
                new SW("Vitality", 1.3), new SW("Strength", 1),
                new SW("Defense", 2), new SW("Magic Defense", 2)
            });

            // Dancer
            _jobsByKey[38] = new JobData(GarlandDatabase.LevelCap, new SW[] {
                new SW("Physical Damage", 15), new SW("Dexterity", 1),
                new SW("Determination", .001), new SW("Skill Speed", .001),
                new SW("Critical Hit", .001), new SW("Direct Hit Rate", .001)
            });

            // Miner, Botanist, Fisher
            _jobsByKey[16] = new JobData(GarlandDatabase.LevelCap, new SW[] { new SW("Gathering", 1), new SW("Perception", 1), new SW("GP", 1) });
            _jobsByKey[17] = _jobsByKey[16];
            _jobsByKey[18] = _jobsByKey[16];

            // Disciples of the Hand
            _jobsByKey[8] = new JobData(GarlandDatabase.LevelCap, new SW[] { new SW("Craftsmanship", .85), new SW("Control", 1), new SW("CP", 1.1) });
            _jobsByKey[9] = _jobsByKey[8];
            _jobsByKey[10] = _jobsByKey[8];
            _jobsByKey[11] = _jobsByKey[8];
            _jobsByKey[12] = _jobsByKey[8];
            _jobsByKey[13] = _jobsByKey[8];
            _jobsByKey[14] = _jobsByKey[8];
            _jobsByKey[15] = _jobsByKey[8];

            // Fill materia info.
            foreach (var weight in _jobsByKey.Values.SelectMany(j => j.Weights))
            {
                weight.BaseParam = sBaseParams.First(bp => bp.Name == weight.Attribute);
                var applicableMateria = sMateria.FirstOrDefault(m => m.BaseParam == weight.BaseParam);
                if (applicableMateria != null)
                {
                    weight.Materia = applicableMateria.Items
                        .Where(i => !string.IsNullOrEmpty(i.Item.Name))
                        .OrderBy(i => i.Tier)
                        .ToArray();
                }
            }
        }

        public override void Start()
        {
            var sBaseParam = _builder.Sheet<Saint.BaseParam>().ToArray();
            var sMateria = _builder.Sheet<Saint.Materia>().ToArray();
            Initialize(sBaseParam, sMateria);

            var equipment = _builder.ItemsToImport
                .OfType<Saint.Items.Equipment>()
                // Select only two-handed weapons or equipment that doesn't block anything else.
                .Where(e => e.EquipSlotCategory.Key == 13 || e.EquipSlotCategory.BlockedSlots.Count() == 0)
                .Select(e => new { Equipment = e, e.ClassJobCategory.ClassJobs, Item = _builder.Db.ItemsById[e.Key] })
                .ToArray();

            foreach (var sJob in _builder.Sheet<Saint.ClassJob>())
            {
                if (sJob.Key == 0 || string.IsNullOrEmpty(sJob.Name))
                    continue; // Skip adventurer and unreleased jobs.

                var isCombatJob = sJob.ClassJobCategory.Key != 32 && sJob.ClassJobCategory.Key != 33; // DoH or DoL

                var relevantEquipment = equipment;

                // Skip one-handed weapons and shields for blm and whm.
                if (sJob.Key == 6 || sJob.Key == 7 || sJob.Key == 24 || sJob.Key == 25)
                {
                    relevantEquipment = relevantEquipment
                        .Where(e => e.Equipment.EquipSlotCategory.Key != 1 && e.Equipment.EquipSlotCategory.Key != 2)
                        .ToArray();
                }

                // Generate scores for this equipment for this job.
                var jobData = _jobsByKey[sJob.Key];
                var weights = jobData.Weights.OrderByDescending(w => w.Value).ToArray();
                var scoredJobEquipment = relevantEquipment
                    .Where(e => e.ClassJobs.Contains(sJob))
                    .Where(e => e.Equipment.EquipmentLevel <= jobData.MaxLevel)
                    .Select(e => new EquipmentJobRank()
                    {
                        Equipment = e.Equipment,
                        Item = e.Item,
                        EquipmentLevel = e.Equipment.EquipmentLevel,
                        Slot = e.Equipment.EquipSlotCategory,
                        Rank = Rank(e.Equipment, jobData, weights, isCombatJob),
                        HasCraftingRecipe = e.Item.craft != null && e.Item.craft[0].stars == null,
                        HasGilVendor = e.Item.vendors != null,
                        HasGcVendor = HasGcVendor(e.Item),
                        Vendors = (JArray)e.Item.vendors
                    })
                    .Where(e => e.Rank == null || e.Rank.BaseScore > 0) // Must at least have a non-zero pre-meld score.
                    .ToArray();

                // Generate!
                BuildLevelingEquipment(scoredJobEquipment, jobData, sJob);
                BuildEndGameEquipment(scoredJobEquipment, jobData, sJob, isCombatJob);
            }
        }

        static bool HasGcVendor(dynamic item)
        {
            if (item.tradeShops == null)
                return false;

            foreach (var shop in item.tradeShops)
            {
                foreach (int id in shop.npcs)
                {
                    switch (id)
                    {
                        case 1002390:
                        case 1002393:
                        case 1002387:
                            return true;
                    }
                }
            }

            return false;
        }

        EquipmentRank Rank(Saint.Items.Equipment equipment, JobData jobData, SW[] weights, bool isCombatJob)
        {
            if (isCombatJob && equipment.EquipmentLevel >= jobData.MaxLevel)
                return null; // Optimization: Stat ranks at cap are obsolete for combat jobs.

            var rank = new EquipmentRank() { Equipment = equipment };
            var melds = 0;
            var maxMeldsAllowed = equipment.IsAdvancedMeldingPermitted ? 5 : equipment.FreeMateriaSlots;
            var ranksByWeight = new Dictionary<SW, EquipmentStatRank>();

            // First calculate rankings with base weights.
            foreach (var weight in weights)
            {
                var value = equipment.GetParameterValue(weight.BaseParam, equipment.CanBeHq);

                var statRank = new EquipmentStatRank();
                statRank.Param = weight.BaseParam.Name;
                statRank.Score = value * weight.Value;
                statRank.BaseScore = (weight.ExcludeFromBaseValue ? 0 : value * weight.Value);
                statRank.MaxValue = equipment.GetMaximumParamValue(weight.BaseParam);
                statRank.Value = value;
                rank.StatRanks.Add(statRank);
                ranksByWeight[weight] = statRank;

                rank.Score += statRank.Score;
                rank.BaseScore += statRank.BaseScore;
            }

            // Kick out PVP equipment now.
            if (equipment.IsPvP)
                return rank;

            // Next calculate optimal melds, one at a time.
            while (melds < maxMeldsAllowed)
            {
                EquipmentStatRank currentBestStatRank = null;
                int currentBestNewValue = 0;
                double currentBestWeightedIncrease = 0;
                double currentOvermeldPenalty = 0;

                // Check each meldable stat.
                foreach (var weight in weights.Where(w => w.Materia != null))
                {
                    var statRank = ranksByWeight[weight];

                    // Check each meld tier.
                    foreach (var sMateria in weight.Materia)
                    {
                        var newValue = Math.Min(statRank.MaxValue, statRank.Value + sMateria.Value);
                        var weightedIncrease = (newValue - statRank.Value) * weight.Value;

                        // Don't count advanced melds that can't overcome their overmeld penalty.
                        double penalty = 0;
                        if (melds >= equipment.FreeMateriaSlots)
                        {
                            if (!sMateria.Item.IsAdvancedMeldingPermitted)
                                continue;

                            var slot = melds - equipment.FreeMateriaSlots;
                            if (sMateria.Tier == 5 && slot > 0)
                                continue; // Can't overmeld VI past the first slot.
                            if (slot >= 4)
                                continue; // Hotfix, somehow we might end up working on this slot that doesn't exist in weights.;
                            penalty = OvermeldPenalties[slot, sMateria.Tier];
                            if (weightedIncrease < penalty)
                                continue;
                        }

                        // Check for a new best meld choice.
                        if (currentBestWeightedIncrease < weightedIncrease)
                        {
                            currentBestWeightedIncrease = weightedIncrease;
                            currentBestNewValue = newValue;
                            currentBestStatRank = statRank;
                            currentOvermeldPenalty = penalty;
                        }
                    }
                }

                // Stop when no good melds are left.
                if (currentBestNewValue == 0)
                    break;

                // Apply a good meld.
                currentBestStatRank.Value = currentBestNewValue;
                currentBestStatRank.Score += currentBestWeightedIncrease;
                rank.Score += currentBestWeightedIncrease;
                rank.OvermeldPenalty -= currentOvermeldPenalty;
                melds++;
            }

            // Apply overmeld penalty if applicable.
            if (melds > equipment.FreeMateriaSlots && rank.OvermeldPenalty < 0)
            {
                var overmeldPenalty = new EquipmentStatRank();
                overmeldPenalty.Param = "Overmeld Penalty";
                overmeldPenalty.Score = rank.OvermeldPenalty;
                overmeldPenalty.BaseScore = 0;
                rank.StatRanks.Add(overmeldPenalty);

                rank.Score += overmeldPenalty.Score;
            }

            return rank;
        }

        void BuildLevelingEquipment(EquipmentJobRank[] scoredJobEquipment, JobData jobData, Saint.ClassJob sJob)
        {
            var levelingJobEquipmentArray = new JArray();
            _builder.Db.LevelingEquipmentByJob[sJob.Abbreviation] = levelingJobEquipmentArray;
            Dictionary<Saint.EquipSlotCategory, List<EquipmentJobRank>> previousLevelingItems = null;

            // Find the best crafted equipment from 1-max that isn't a star recipe.
            for (var elvl = 1; elvl < jobData.MaxLevel; elvl++)
            {
                var currentLevelingItems = new Dictionary<Saint.EquipSlotCategory, List<EquipmentJobRank>>();

                var relevantEquipment = scoredJobEquipment
                    .Where(e => e.HasCraftingRecipe || e.HasGcVendor || e.HasGilVendor)
                    .Where(e => e.EquipmentLevel <= elvl)
                    .Where(e => e.Item.achievements == null) // No achievement gear.
                    .Where(e => e.Vendors == null || !e.Vendors.Select(t => (int)t).Contains(1006004)) // No calamity salvager gear.
                    .GroupBy(e => e.Slot);

                var equipmentLevelSlots = new JObject();
                foreach (var scoresBySlot in relevantEquipment)
                {
                    // Use the base score without melds because max overmelding on leveling equ is unrealistic.
                    var orderedEquipment = scoresBySlot
                        .OrderByDescending(s => s.Rank.BaseScore)
                        .ThenBy(s => s.Equipment.Key)
                        .ToArray();

                    // Find the highest scores in 3 categories:
                    // 1. With a crafting recipe.
                    // 2. From the GC vendor.
                    // 3. From a regular vendor.
                    var currentList = new List<EquipmentJobRank>();

                    var highestCrafted = orderedEquipment.FirstOrDefault(s => s.HasCraftingRecipe);
                    if (highestCrafted != null)
                        currentList.Add(highestCrafted);

                    var highestGc = orderedEquipment.FirstOrDefault(s => s.HasGcVendor);
                    var highestGil = orderedEquipment.FirstOrDefault(s => s.HasGilVendor);

                    // Ignore GC gear if gil shop gear is better.
                    if (highestGc != null && highestGil != null && highestGil.Rank.BaseScore > highestGc.Rank.BaseScore)
                        highestGc = null;

                    if (highestGc != null)
                        currentList.Add(highestGc);

                    if (highestGil != null)
                        currentList.Add(highestGil);

                    // No equipment - probably nothing available for this slot at this level.
                    if (currentList.Count == 0)
                        continue;

                    currentLevelingItems[scoresBySlot.Key] = currentList;

                    var records = new JArray();
                    foreach (var item in currentList.Distinct().OrderByDescending(i => i.Rank.BaseScore))
                    {
                        dynamic record = new JObject();
                        record.id = item.Equipment.Key;
                        if (item.HasCraftingRecipe)
                            record.craft = 1;
                        if (item.HasGcVendor)
                            record.gc = 1;
                        if (item.HasGilVendor)
                            record.gil = 1;
                        records.Add(record);
                        _builder.Db.AddReference(levelingJobEquipmentArray, "item", item.Equipment.Key, false);
                    }
                    equipmentLevelSlots[scoresBySlot.Key.Key.ToString()] = records;
                }
                levelingJobEquipmentArray.Add(equipmentLevelSlots);

                // Link upgrades
                if (previousLevelingItems != null)
                {
                    foreach (var pair in currentLevelingItems)
                    {
                        if (!previousLevelingItems.TryGetValue(pair.Key, out var previousEquipment))
                            continue;

                        foreach (var previousItem in previousEquipment)
                        {
                            foreach (var currentItem in pair.Value)
                            {
                                // Skip identical equipment levels.  The tool covers horizontal upgrades.
                                if (currentItem.EquipmentLevel == previousItem.EquipmentLevel)
                                    continue;

                                // List all classes of upgrade, regardless of type.
                                if (currentItem.Rank.BaseScore > previousItem.Rank.BaseScore)
                                    _builder.UpgradeItem(previousItem.Item, currentItem.Item);
                            }
                        }
                    }
                }

                previousLevelingItems = currentLevelingItems;
            }
        }

        void BuildEndGameEquipment(EquipmentJobRank[] scoredJobEquipment, JobData jobData, Saint.ClassJob sJob, bool isCombatJob)
        {
            // We only want endgame equipment for jobs, not starting classes.
            // Filter out DoW/M classes that don't have a parent.
            // Everything before the Heavensward classless jobs.
            if (sJob.Key < 31 && isCombatJob && sJob.ParentClassJob == sJob)
                return;

            // EndGame equipment is simply grouped by slot and ordered.
            var endGameJobEquipmentList = new JObject();
            _builder.Db.EndGameEquipmentByJob[sJob.Abbreviation] = endGameJobEquipmentList;

            var endGameEquipmentBySlot = scoredJobEquipment
                // Go back 10 levels for non-combat jobs, so Lv. 60 shows prior Lv. 50 gear for comparison.
                .Where(e => e.EquipmentLevel >= jobData.MaxLevel - (isCombatJob ? 0 : 10))
                .GroupBy(e => e.Slot);

            foreach (var endGameSlot in endGameEquipmentBySlot)
            {
                // Sort results in this slot.
                EquipmentJobRank[] orderedResults;
                if (isCombatJob)
                    orderedResults = endGameSlot.OrderByDescending(e => e.Equipment.ItemLevel.Key).ThenByDescending(e => e.Equipment.Key).ToArray();
                else
                    orderedResults = endGameSlot.OrderByDescending(e => e.Rank.Score).ToArray();

                // Skip slots that don't have a single piece at cap. (WHM wands and shields)
                if (orderedResults.Max(e => e.EquipmentLevel) < jobData.MaxLevel)
                    continue;

                // Add references to top results.
                var topResults = orderedResults.Take(9).ToArray();
                foreach (var result in topResults)
                    _builder.Db.AddReference(endGameJobEquipmentList, "item", result.Equipment.Key, false);

                // Store them in the list.
                var results = topResults
                    .Select(e => new JObject(new JProperty("id", e.Equipment.Key)))
                    .ToArray();

                endGameJobEquipmentList[endGameSlot.Key.Key.ToString()] = new JArray(results);

                // Don't predict progression on combat jobs.
                if (isCombatJob)
                    continue;

                // Record end-game progression on DoH/DoL jobs.
                dynamic previousItem = null;
                double previousScore = 0;
                foreach (var e in orderedResults.Take(9).Reverse())
                {
                    if (e.Rank.Score == previousScore)
                        continue;

                    var item = _builder.Db.ItemsById[e.Equipment.Key];
                    _builder.UpgradeItem(previousItem, item);
                    previousItem = item;
                    previousScore = e.Rank.Score;
                }
            }
        }
    }

    public class EquipmentRank
    {
        public Saint.Items.Equipment Equipment;
        public double Score; // Score after melding
        public double BaseScore; // Score before melding, excluding defense.
        public double OvermeldPenalty; // Penalty for overmelds.
        public List<EquipmentStatRank> StatRanks = new List<EquipmentStatRank>();
    }

    public class EquipmentStatRank
    {
        public string Param;
        public double Score;
        public double BaseScore;
        public int MaxValue;
        public int Value;

        public override string ToString() => $"Param {Param} value {Value}/{MaxValue} score {BaseScore}/{Score}";
    }

    public class EquipmentJobRank
    {
        public Saint.Items.Equipment Equipment;
        public dynamic Item;
        public int EquipmentLevel;
        public Saint.EquipSlotCategory Slot;
        public bool HasCraftingRecipe;
        public bool HasGcVendor;
        public bool HasGilVendor;
        public EquipmentRank Rank;
        public JArray Vendors;

        public override string ToString()
        {
            return Equipment.Name + " (e" + EquipmentLevel + "): " + Rank.BaseScore;
        }
    }

    public class JobData
    {
        public SW[] Weights;
        public int MaxLevel;

        public JobData(int maxLevel, SW[] weights)
        {
            MaxLevel = maxLevel;
            Weights = weights;
        }
    }

    public class SW
    {
        public string Attribute { get; set; }
        public double Value { get; set; }
        public Saint.BaseParam BaseParam { get; set; }
        public Saint.Materia.ItemValue[] Materia { get; set; }
        public bool ExcludeFromBaseValue { get; set; }
        public bool IsAdvancedMeldingForbidden { get; private set; }

        public SW() { }
        public SW(string attribute, double value, bool excludeFromBaseValue = false)
        {
            Attribute = attribute;
            Value = value;
            ExcludeFromBaseValue = excludeFromBaseValue;
            IsAdvancedMeldingForbidden = Hacks.IsMainAttribute(attribute);
        }

        public override string ToString()
        {
            return Attribute + ": " + Value;
        }
    }
}
