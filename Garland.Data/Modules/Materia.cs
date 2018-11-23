using Garland.Data.Helpers;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Materia : Module
    {
        public override string Name => "Materia";

        public override void Start()
        {
            foreach (var sMateria in _builder.Sheet<Game.Materia>())
            {
                if (sMateria.BaseParam.Key == 0)
                    continue;

                var isMainAttribute = Hacks.IsMainAttribute(sMateria.BaseParam.Name.ToString());

                foreach (var itemValue in sMateria.Items)
                {
                    if (!_builder.Db.ItemsById.TryGetValue(itemValue.Item.Key, out var item))
                        continue;

                    dynamic obj = new JObject();
                    obj.tier = itemValue.Tier;
                    obj.value = itemValue.Value;
                    obj.attr = sMateria.BaseParam.Name.ToString();
                    obj.category = PatchDatabase.GetAttributePatchCategory(sMateria.BaseParam).Value;
                    if (isMainAttribute)
                        obj.advancedMeldingForbidden = 1;
                    item.materia = obj;

                    // Embed materia for meld tool.
                    _builder.Db.EmbeddedPartialItemIds.Add(itemValue.Item.Key);
                }
            }
        }
    }
}
