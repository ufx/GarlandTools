using Newtonsoft.Json.Linq;
using SaintCoinach.Imaging;
using SaintCoinach.Text;
using SaintCoinach.Xiv;
using SaintCoinach.Xiv.ItemActions;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Modules
{
    public class Mounts : Module
    {
        public override string Name => "Mounts";

        public override void Start()
        {
            foreach (var sItem in _builder.Sheet<Item>())
            {
                var unlock = sItem.ItemAction as MountUnlock;
                if (unlock == null)
                    continue;

                var sMount = unlock.Mount;
                if (string.IsNullOrEmpty(sMount.Singular.ToString()))
                    continue;

                var sMountTransient = _builder.Sheet("MountTransient")[sMount.Key];

                var item = _builder.Db.ItemsById[sItem.Key];
                item.mount = new JObject();
                item.mount.name = Utils.CapitalizeWords(sMount.Singular.ToString());
                item.mount.action = sMountTransient[0].ToString();
                item.mount.description = sMountTransient[1].ToString();
                item.mount.tooltip = HtmlStringFormatter.Convert((XivString)sMountTransient[2]);

                // Icons
                var iconIndex = (UInt16)sMount.SourceRow.GetRaw("Icon");
                var icon = IconHelper.GetIcon(_builder.Realm.Packs, iconIndex);
                item.mount.icon = IconDatabase.EnsureEntry("mount", icon);

                int guideIconIndex = 0;
                if (iconIndex < 8000)
                    guideIconIndex = iconIndex - 4000 + 68000;
                else if (iconIndex >= 8000) // For 4.1 SB mounts.
                    guideIconIndex = iconIndex - 8000 + 77000;

                var guideIcon = IconHelper.GetIcon(_builder.Realm.Packs, guideIconIndex);
                if (guideIcon == null)
                    DatabaseBuilder.PrintLine($"Mount {item.mount.name} #{sItem.Key} has invalid guide icon, skipping.");
                else
                    item.mount.guideIcon = IconDatabase.EnsureEntry("mount", guideIcon);

                item.models = new JArray(Utils.ModelCharaKey(sMount.ModelChara));
            }
        }
    }
}
