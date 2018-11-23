using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using SaintCoinach.Xiv;

namespace Garland.Data.Models
{
    public class IngredientModel
    {
        public Item Item;
        public int Quantity;
        public string Part;
        public int Phase;
        public string StepId;
        public int QualityPerItem;

        public IngredientModel(Item item, int quantity)
            : this(item, quantity, null, 0) { }

        public IngredientModel(Item item, int quantity, string part, int phase)
        {
            Item = item;
            Quantity = quantity;
            Part = part;
            Phase = phase;

            if (part != null || phase > 0)
            {
                var sid = new List<string>();
                if (part != null)
                    sid.Add(part);
                if (phase > 0)
                    sid.Add(phase.ToString());
                sid.Add(item.Key.ToString());

                StepId = string.Join("-", sid);
            }
        }

        public IngredientModel(RecipeIngredient ingredient)
        {
            Item = ingredient.Item;
            Quantity = ingredient.Count;
            QualityPerItem = ingredient.QualityPerItem;
        }
    }
}
