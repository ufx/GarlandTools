using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Territories : Module
    {
        public override string Name => "Territories";

        public override void Start()
        {
            foreach (var sTerritoryType in _builder.Sheet<Saint.TerritoryType>())
            {
                var bg = sTerritoryType.Bg.ToString();
                if (string.IsNullOrEmpty(bg))
                    continue;

                var lgbFileName = "bg/" + bg.Substring(0, bg.IndexOf("/level/") + 1) + "level/planevent.lgb";
                if (!_builder.Realm.Packs.TryGetFile(lgbFileName, out var sFile))
                    continue;

                var sLgbFile = new SaintCoinach.Graphics.Lgb.LgbFile(sFile);
                foreach (var sLgbGroup in sLgbFile.Groups)
                {
                    var sMap = sTerritoryType.GetRelatedMap(sLgbGroup.Header.MapIndex);
                    foreach (var sLgbENpcEntry in sLgbGroup.Entries.OfType<SaintCoinach.Graphics.Lgb.LgbENpcEntry>())
                    {
                        var npcId = (int)sLgbENpcEntry.Header.ENpcId;
                        if (!_builder.Db.NpcsById.TryGetValue(npcId, out var npc))
                            continue;

                        if (npc.coords != null)
                            continue;

                        if (npc.zoneid == null && sMap.PlaceName.Key != 0)
                        {
                            npc.zoneid = sMap.PlaceName.Key;
                            _builder.Db.AddLocationReference(sMap.PlaceName.Key);
                        }

                        var x = sMap.ToMapCoordinate3d(sLgbENpcEntry.Header.Translation.X, sMap.OffsetX);
                        var y = sMap.ToMapCoordinate3d(sLgbENpcEntry.Header.Translation.Z, sMap.OffsetY);
                        npc.coords = new JArray(Math.Round(x, 2), Math.Round(y, 2));

                        NPCs.UpdateArea(_builder, npc, sMap, x, y);
                    }
                }
            }
        }
    }
}
