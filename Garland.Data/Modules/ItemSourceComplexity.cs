using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Modules
{
    public class ItemSourceComplexity : Module
    {
        Dictionary<int, SourceComplexity> _complexityByItemId = new Dictionary<int, SourceComplexity>();

        public override string Name => "Item Source Complexity";

        public override void Start()
        {
            BuildCraftComplexity();
            BuildLeveComplexity();
        }

        void BuildCraftComplexity() {
            foreach (var item in _builder.Db.Items)
            {
                if (item.craft == null || item.category == -2) // Skip FC crafts.
                    continue;

                var complexity = CalculateComplexity((int)item.id);
                for (int i = 0; i < complexity.Crafts.Count; i++)
                {
                    var craftComplexity = complexity.Crafts[i];
                    var craft = item.craft[i];
                    craft.complexity = craftComplexity.ToJObject();
                }
            }
        }

        void BuildLeveComplexity()
        {
            foreach (var leve in _builder.Db.Leves)
            {
                if (leve.requires == null)
                    continue;

                var complexity = new SourceComplexity();

                foreach (var required in leve.requires)
                {
                    var amount = (int)(required.amount ?? 1);

                    // Add this item to the leve complexity score.
                    var child = CalculateComplexity((int)required.item);
                    for (var i = 0; i < amount; i++)
                        complexity.Add(child);
                }

                leve.complexity = complexity.ToJObject();
            }
        }

        public int GetNqComplexity(int itemId)
        {
            return CalculateComplexity(itemId).NqScore;
        }

        public int GetHqComplexity(int itemId)
        {
            return CalculateComplexity(itemId).HqScore;
        }

        SourceComplexity CalculateComplexity(int itemId)
        {
            if (_complexityByItemId.TryGetValue(itemId, out var complexity))
                return complexity;

            // Insert a sentinel for cycle guarding.
            complexity = new SourceComplexity() { HqScore = 99999, NqScore = 99999 };
            _complexityByItemId[itemId] = complexity;

            // Calculate the complexity of the item.
            var item = _builder.Db.ItemsById[itemId];

            if (item.vendors != null)
            {
                var priceFactor = 1 + ((int)item.price) / 10000;
                complexity.RecordNqScore(priceFactor * 5);
            }

            if (item.ventures != null)
            {
                foreach (int ventureId in item.ventures)
                {
                    var venture = _builder.Db.VenturesById[ventureId];
                    if (venture.amounts == null)
                    {
                        // A random result, same as treasure.
                        complexity.RecordNqScore(100);
                        continue;
                    }

                    var maxAmount = ((JArray)venture.amounts).Select(a => (int)a).Max();
                    var amountFactor = 1 + (30 / maxAmount);
                    complexity.RecordScores(amountFactor * 6);
                }
            }

            if (item.nodes != null)
            {
                foreach (int nodeId in item.nodes)
                {
                    var node = _builder.Db.NodesById[nodeId];
                    if (node.limitType == "Ephemeral")
                        complexity.RecordScores(30);
                    else if (node.limited == 1)
                        complexity.RecordScores(40);
                    else
                        complexity.RecordScores(20);
                }
            }

            if (item.fishingSpots != null)
                complexity.RecordScores(30);

            if (item.drops != null)
                complexity.RecordScores(75);

            if (item.instances != null)
                complexity.RecordNqScore(105);

            // This is high because generally leves are not for farming.
            if (item.leves != null)
                complexity.RecordNqScore(110);

            // Again high because generally trade shops are not for farming.
            if (item.tradeShops != null)
                complexity.RecordNqScore(115);

            if (item.fates != null)
                complexity.RecordNqScore(120);

            if (item.voyages != null)
                complexity.RecordScores(125);

            if (item.reducedFrom != null)
                complexity.RecordScores(135);

            if (item.treasure != null)
                complexity.RecordScores(150);

            if (item.seeds != null || item.grow != null)
                complexity.RecordScores(200);

            if (item.desynthedFrom != null)
            {
                if (item.desynthedFrom.Count == 0)
                {
                    // Easy desynthesis usually
                    complexity.RecordScores(20);
                }
                else
                {
                    foreach (int desynthItemId in item.desynthedFrom)
                    {
                        var child = CalculateComplexity(desynthItemId);
                        complexity.RecordScores(child.NqScore + 5);
                    }
                }
            }

            if (item.craft != null)
            {
                complexity.Crafts = new List<SourceComplexity>();

                foreach (var craft in item.craft)
                {
                    var craftComplexity = new SourceComplexity();
                    foreach (var ingredient in craft.ingredients)
                    {
                        var ingredientAmount = (int)ingredient.amount;
                        var child = CalculateComplexity((int)ingredient.id);
                        craftComplexity.NqScore += (child.NqScore * ingredientAmount);
                        // Intentionally tracks NqScore of child for HQ of parent.
                        craftComplexity.HqScore += (child.NqScore * ingredientAmount);
                    }

                    // Crafted items take a complexity penalty for setting up the craft too.
                    craftComplexity.NqScore += 10;
                    craftComplexity.HqScore += 30;

                    complexity.Crafts.Add(craftComplexity);
                    complexity.RecordScores(craftComplexity);
                }
            }

            if (item.tutorialReward == 1)
                complexity.RecordNqScore(50);

            if (item.bingoReward == 1)
                complexity.RecordNqScore(500);

            // todo: give repeatable quests a different score here.
            if (item.quests != null)
                complexity.RecordNqScore(1000);

            if (item.relic == 1)
                complexity.RecordNqScore(5000);

            if (complexity.HqScore == 99999)
                complexity.HqScore = 0;

            if (complexity.NqScore == 99999 && complexity.Crafts == null)
            {
                // These are usually very easy materials supplied by quest givers.
                var itemName = (string)item.en.name;
                if (itemName.EndsWith("Materials") && item.usedInQuest != null)
                    complexity.RecordNqScore(5);
                //else if (!SkipComplexityAlert(itemName, item))
                //    DatabaseBuilder.PrintLine($"Item {itemId} {item.en.name} has no sources for complexity");
            }

            return complexity;
        }

        static bool SkipComplexityAlert(string itemName, dynamic item)
        {
            if (itemName.StartsWith("Weathered"))
                return true;

            return false;
        }

        class SourceComplexity
        {
            public int HqScore;
            public int NqScore;
            public List<SourceComplexity> Crafts;

            public void Add(SourceComplexity child)
            {
                HqScore += child.HqScore;
                NqScore += child.NqScore;
            }

            public void Add(int value)
            {
                HqScore += value;
                NqScore += value;
            }

            public void RecordScores(SourceComplexity source)
            {
                if (source.HqScore < HqScore)
                    HqScore = source.HqScore;

                if (source.NqScore < NqScore)
                    NqScore = source.NqScore;
            }

            public void RecordScores(int value)
            {
                if (value + 5 < HqScore)
                    HqScore = value + 5;

                if (value < NqScore)
                    NqScore = value;
            }

            public void RecordNqScore(int value)
            {
                if (value < NqScore)
                    NqScore = value;
            }

            public JObject ToJObject()
            {
                return new JObject
                {
                    ["nq"] = NqScore,
                    ["hq"] = HqScore
                };
            }

            public override string ToString() => $"SourceComplexity nq:{NqScore} hq:{HqScore}";
        }
    }
}
