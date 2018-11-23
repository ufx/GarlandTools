using Garland.Data.Modules;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Statistics
{
    public static class RareItemsFromCheapDesynth
    {
        public static void Calculate(DatabaseBuilder builder, ItemSourceComplexity complexity)
        {
            var rareItemsById = builder.Db.Items
                .Where(i => i.craft == null)
                .Where(i => ((JToken)i.id).Type == JTokenType.Integer)
                .Where(i => complexity.GetNqComplexity((int)i.id) >= 80)
                .ToDictionary(i => (int)i.id);

            var candidateItems = builder.Db.Items
                .Where(i => i.craft != null)
                .Where(i => i.desynthSkill != null)
                .Where(i => ((JToken)i.id).Type == JTokenType.Integer)
                .Where(i => complexity.GetNqComplexity((int)i.id) <= 75);

            var lines = new List<string>();

            foreach (var item in candidateItems)
            {
                foreach (var recipe in item.craft)
                {
                    foreach (var ingredient in recipe.ingredients)
                    {
                        if (rareItemsById.TryGetValue((int)ingredient.id, out var rareIngredientItem))
                        {
                            lines.Add($"{rareIngredientItem.en.name} appears in recipe list of {item.en.name}.");
                        }
                    }
                }
            }

            File.WriteAllLines("rare-desynth.txt", lines);
        }
    }
}
