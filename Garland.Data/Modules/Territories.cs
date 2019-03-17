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
            return; // not yet ready.

            foreach (var sTerritoryType in _builder.Sheet<Saint.TerritoryType>())
            {
                var sTerritory = new SaintCoinach.Graphics.Territory(sTerritoryType);
                var sLgbENpcEntries = sTerritory.LgbFiles
                    .SelectMany(f => f.Groups)
                    .SelectMany(g => g.Entries)
                    .OfType<SaintCoinach.Graphics.Lgb.LgbENpcEntry>();
                var sMap = sTerritoryType.Map;

                foreach (var sLgbENpcEntry in sLgbENpcEntries)
                {
                    var npcId = (int)sLgbENpcEntry.Header.ENpcId;
                    if (!_builder.Db.NpcsById.TryGetValue(npcId, out var npc))
                        continue;

                    if (npc.coords != null)
                        continue;

                    if (_builder.LocationInfoByMapId.TryGetValue(sMap.Key, out var locationInfo))
                    {
                        npc.zone = locationInfo.PlaceName.Key;
                        _builder.Db.AddLocationReference(locationInfo.PlaceName.Key);
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
