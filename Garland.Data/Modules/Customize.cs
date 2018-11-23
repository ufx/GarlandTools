using Newtonsoft.Json.Linq;
using SaintCoinach.Imaging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Modules
{
    public class Customize : Module
    {
        public override string Name => "Character Customization";

        public override void Start()
        {
            foreach (var sItem in _builder.ItemsToImport)
            {
                var sCustomizeUnlock = sItem.ItemAction as SaintCoinach.Xiv.ItemActions.CustomizeUnlock;
                if (sCustomizeUnlock == null)
                    continue;

                var sCharaMakeCustomizes = sCustomizeUnlock.CustomizeRows.Where(r => (byte)r[0] != 0).ToArray();
                if (sCharaMakeCustomizes.Length == 0)
                    continue;

                var item = _builder.Db.ItemsById[sItem.Key];
                item.customize = new JArray();

                foreach (var sCharaMakeCustomize in sCharaMakeCustomizes)
                {
                    var icon = (ImageFile)sCharaMakeCustomize["Icon"];
                    var id = IconDatabase.EnsureEntry("customize", icon);
                    item.customize.Add(id);
                }
            }
        }
    }
}
