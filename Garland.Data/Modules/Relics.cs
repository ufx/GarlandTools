using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Relics : Module
    {
        public override string Name => "Relics";

        public override void Start()
        {
            BuildRelic(); // 2.x ARR
            BuildAnima(); // 3.x HW
        }

        void BuildRelic()
        {
            var sRelicItems = _builder.Sheet("RelicItem");

            // Each column after 1 represents a progressing class of items.
            for (var column = 1; column <= 11; column++)
            {
                dynamic previousItem = null;
                for (var row = 0; row < sRelicItems.Count; row++)
                {
                    var sItem = (Saint.Item)sRelicItems[row][column];
                    if (sItem.Key == 0)
                        continue;

                    var item = _builder.Db.ItemsById[sItem.Key];
                    item.relic = 1;

                    _builder.UpgradeItem(previousItem, item);
                    previousItem = item;
                }
            }
        }

        void BuildAnima()
        {
            var sAnimaWeaponItems = _builder.Sheet("AnimaWeaponItem");

            // Each column represents a progressing class of items.
            for (var column = 0; column <= 13; column++)
            {
                dynamic previousItem = null;
                // Skip the first row.
                for (var row = 1; row < sAnimaWeaponItems.Count; row++)
                {
                    var sItem = (Saint.Item)sAnimaWeaponItems[row][column];
                    var item = _builder.Db.ItemsById[sItem.Key];
                    item.relic = 1;

                    _builder.UpgradeItem(previousItem, item);
                    previousItem = item;
                }
            }
        }
    }
}
