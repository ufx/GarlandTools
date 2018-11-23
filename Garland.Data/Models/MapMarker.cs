using SaintCoinach.Ex.Variant2;
using SaintCoinach.Xiv;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Models
{
    public class MapMarker
    {
        public int MapKey;
        public int SubKey;
        public double MapX;
        public double MapY;
        public PlaceName PlaceName;
        public bool IsRegion;
        public byte DataType;

        public MapMarker(IXivSubRow sRow, Map map)
        {
            SubKey = sRow.Key;
            MapKey = sRow.ParentKey;
            MapX = map.ToMapCoordinate2d((Int16)sRow["X"], map.OffsetX);
            MapY = map.ToMapCoordinate2d((Int16)sRow["Y"], map.OffsetY);
            IsRegion = ((byte)sRow["Type"]) == 1;
            DataType = (byte)sRow["Data{Type}"];
            PlaceName = (PlaceName)sRow["PlaceName{Subtext}"];
        }

        public static MapMarker FindClosest(DatabaseBuilder builder, Map map, double x, double y)
        {
            const double areaDistanceThreshold = 3;

            if (!builder.MapMarkersByMapKey.TryGetValue(map.Key, out var markers))
                return null;

            // Calculate the shortest distance to both region and area map markers.
            Tuple<MapMarker, double> closestRegionMarker = null;
            Tuple<MapMarker, double> closestAreaMarker = null;
            foreach (var marker in markers)
            {
                var distance = Math.Sqrt(Math.Pow(x - marker.MapX, 2) + Math.Pow(y - marker.MapY, 2));

                if (marker.IsRegion)
                {
                    if (closestRegionMarker == null || closestRegionMarker.Item2 > distance)
                        closestRegionMarker = Tuple.Create(marker, distance);
                }
                else if (distance <= areaDistanceThreshold)
                {
                    if (closestAreaMarker == null || closestAreaMarker.Item2 > distance)
                        closestAreaMarker = Tuple.Create(marker, distance);
                }
            }

            if (closestAreaMarker != null)
                return closestAreaMarker.Item1;

            if (closestRegionMarker != null)
                return closestRegionMarker.Item1;

            return null;
        }

        public override string ToString() => PlaceName?.ToString();
    }
}
