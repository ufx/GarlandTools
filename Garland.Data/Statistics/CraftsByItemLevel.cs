using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Statistics
{
    public class CraftsByItemLevel
    {
        public const int MinimumItemLevel = 20;
        public const int MaximumItemLevel = 90;

        private Dictionary<int, ItemCost> _itemCostByItemLevel = new Dictionary<int, ItemCost>();

        public void Calculate()
        {
            foreach (var item in GarlandDatabase.Instance.Items)
            {
                if (item.craft == null)
                    continue;

                var ilvl = (int)item.ilvl;
                if (ilvl < MinimumItemLevel || ilvl > MaximumItemLevel)
                    continue;

                var cost = GetCost(item);
                if (cost <= 0)
                    continue;

                if (_itemCostByItemLevel.TryGetValue(ilvl, out var existingCost))
                {
                    if (existingCost.Cost <= cost)
                        continue;
                }

                _itemCostByItemLevel[ilvl] = new ItemCost() { Cost = cost, Item = item };
            }
        }

        private int GetCost(dynamic item)
        {
            var minCost = 0;
            foreach (var craft in item.craft)
            {
                var cost = 0;
                foreach (var ingredient in craft.ingredients)
                {
                    var ingredientItem = GarlandDatabase.Instance.ItemsById[(int)ingredient.id];
                    if (ingredientItem.category == 59)
                        continue; // Skip crystals.

                    if (ingredientItem.vendors == null)
                    {
                        if (ingredientItem.craft == null)
                            return 0;

                        var subcost = GetCost(ingredientItem);
                        if (subcost == 0)
                            return 0;

                        cost += subcost * (int)ingredient.amount;
                    }
                    else
                        cost += (int)ingredientItem.price * (int)ingredient.amount;
                }

                if (minCost == 0 || cost < minCost)
                    minCost = cost;
            }

            return minCost;
        }

        public void Print()
        {
            foreach (var pair in _itemCostByItemLevel.OrderBy(i => i.Key))
                DatabaseBuilder.PrintLine($"ilvl: {pair.Key}, cost: {pair.Value.Cost}, item: {pair.Value.Item.en.name}");
        }

        private class ItemCost
        {
            public int Cost;
            public dynamic Item;
        }
    }
}
