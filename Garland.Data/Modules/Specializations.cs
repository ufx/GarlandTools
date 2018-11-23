using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Modules
{
    public class Specializations : Module
    {
        public override string Name => "Specializations";

        public override void Start()
        {
            var specialItems = _builder.Db.Items.Where(i => i.craft != null && i.craft[0].special != null);
            foreach (var item in specialItems)
            {
                foreach (var recipe in item.craft)
                {
                    var crystal = _builder.Db.ItemsById[(int)recipe.special];
                    if (crystal.unlocks == null)
                        crystal.unlocks = new JArray();
                    crystal.unlocks.Add(item.id);

                    _builder.Db.AddReference(crystal, "item", (string)item.id, false);
                    _builder.Db.AddReference(item, "item", (string)crystal.id, false);
                }
            }
        }
    }
}
