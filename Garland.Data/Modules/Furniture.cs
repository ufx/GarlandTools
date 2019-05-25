using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Furniture : Module
    {
        public override string Name => "Furniture";

        public override void Start()
        {
            var sHousingFurniture = _builder.Sheet<Saint.HousingFurniture>();
            foreach (var sFurniture in sHousingFurniture)
            {
                if (sFurniture.Item.Key == 0)
                    continue;

                var item = _builder.Db.ItemsById[sFurniture.Item.Key];
                item.furniture = 1;

                if (item.models == null)
                    item.models = new JArray();
                item.models.Add(sFurniture.ModelKey.ToString());
            }
        }
    }
}
