using Garland.Data.Models;
using Newtonsoft.Json.Linq;
using SaintCoinach.Imaging;
using SaintCoinach.Xiv;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Indexes : Module
    {
        public override string Name => "Indexes";

        public override void Start()
        {
            GarlandDatabase.Instance.EmbeddedPartialItemIds.Add(1); // Gil

            IndexTomestones();
            IndexRetiredTomestones();
            IndexMapMarkers();
            IndexMateriaJoinRates();
        }

        void IndexTomestones()
        {
            // Tomestone currencies rotate across patches.
            // These keys correspond to currencies A, B, and C.
            var sTomestonesItems = _builder.Sheet<Game.TomestonesItem>()
                .Where(t => t.Tomestone.Key > 0)
                .OrderBy(t => t.Tomestone.Key)
                .ToArray();

            _builder.TomestoneIds[0] = sTomestonesItems[0].Item.Key;
            _builder.TomestoneIds[1] = sTomestonesItems[1].Item.Key;
            _builder.TomestoneIds[2] = sTomestonesItems[2].Item.Key;

            _builder.Db.EmbeddedPartialItemIds.Add(_builder.TomestoneIds[0]);
            _builder.Db.EmbeddedPartialItemIds.Add(_builder.TomestoneIds[1]);
            _builder.Db.EmbeddedPartialItemIds.Add(_builder.TomestoneIds[2]);
        }

        void IndexRetiredTomestones()
        {
            foreach (var sTomestonesItem in _builder.Sheet<Game.TomestonesItem>())
            {
                if (sTomestonesItem.Tomestone.Key == 0)
                    _builder.Db.IgnoredCurrencyItemIds.Add(sTomestonesItem.Item.Key);
            }
        }

        void IndexMapMarkers()
        {
            // Index the map marker range => map keys.
            var mapsByMapMarkerRange = new Dictionary<int, Map>();
            foreach (var sMap in _builder.Sheet<Map>())
            {
                if (!mapsByMapMarkerRange.ContainsKey(sMap.MapMarkerRange))
                    mapsByMapMarkerRange[sMap.MapMarkerRange] = sMap;
            }

            // Index the map markers by map key.
            foreach (var sMapMarker in _builder.Sheet2("MapMarker"))
            {
                if (sMapMarker.ParentRow.Key < 3)
                    continue;

                var sPlaceName = (PlaceName)sMapMarker["PlaceName{Subtext}"];
                var name = sPlaceName.Name.ToString();
                if (string.IsNullOrEmpty(name))
                    continue;

                if ((byte)sMapMarker["Data{Type}"] == 1)
                    continue; // Skip stairs.

                if (name == "Chocobokeep")
                    continue; // Skip chocobokeep clutter.

                var icon = (ImageFile)sMapMarker["Icon"];
                if (icon != null)
                {
                    var iconid = Utils.GetIconId(icon);
                    if (iconid == 60414)
                        continue; // Skip dungeon entrances.
                }

                if (!mapsByMapMarkerRange.TryGetValue(sMapMarker.ParentKey, out var map))
                    continue; // Skip markers with no map.

                if (!_builder.MapMarkersByMapKey.TryGetValue(map.Key, out var markers))
                    _builder.MapMarkersByMapKey[map.Key] = markers = new List<Models.MapMarker>();

                markers.Add(new MapMarker(sMapMarker, map));
            }
        }

        void IndexMateriaJoinRates()
        {
            dynamic rates = new JObject();
            rates.nq = new JArray();
            rates.hq = new JArray();

            var sMateriaJoinRates = _builder.Sheet("MateriaJoinRate");
            foreach (var sMateriaJoinRate in sMateriaJoinRates)
            {
                rates.hq.Add(new[]
                {
                    (int)(Single)sMateriaJoinRate.GetRaw(0),
                    (int)(Single)sMateriaJoinRate.GetRaw(1),
                    (int)(Single)sMateriaJoinRate.GetRaw(2),
                    (int)(Single)sMateriaJoinRate.GetRaw(3)
                });
                rates.nq.Add(new[]
                {
                    (int)(Single)sMateriaJoinRate.GetRaw(4),
                    (int)(Single)sMateriaJoinRate.GetRaw(5),
                    (int)(Single)sMateriaJoinRate.GetRaw(6),
                    (int)(Single)sMateriaJoinRate.GetRaw(7)
                });
            }

            _builder.Db.MateriaJoinRates = rates;
        }
    }
}
