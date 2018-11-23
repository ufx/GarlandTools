using Garland.Data.Models;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Locations : Module
    {
        public override string Name => "Locations";

        public override void Start()
        {
            BuildLocations();
            IndexNpcZones();
        }

        void BuildLocations()
        {
            var locationIndex = new Dictionary<Game.PlaceName, LocationInfo>();
            var maps = _builder.Sheet<Game.Map>()
                .Where(m => m.Key != 0)
                .Where(m => m.PlaceName.Key != 0)
                .Where(m => m.RegionPlaceName.Key != 2405)
                .ToArray();

            // First index locations with no sub-location
            foreach (var sMap in maps.Where(m => m.LocationPlaceName.Key == 0))
            {
                if (!locationIndex.TryGetValue(sMap.RegionPlaceName, out var regionInfo))
                {
                    regionInfo = new LocationInfo(sMap.RegionPlaceName, sMap.RegionPlaceName.Name);
                    locationIndex[sMap.RegionPlaceName] = regionInfo;
                }

                if (!locationIndex.TryGetValue(sMap.PlaceName, out var placeInfo))
                {
                    placeInfo = new LocationInfo(sMap.PlaceName, sMap.PlaceName.Name);
                    placeInfo.Map = sMap;
                    locationIndex[sMap.PlaceName] = placeInfo;
                }
                else if (placeInfo.Map == null)
                    placeInfo.Map = sMap;
            }

            // Next index the sub-locations
            foreach (var sMap in maps.Where(m => m.LocationPlaceName.Key != 0))
            {
                if (!locationIndex.TryGetValue(sMap.LocationPlaceName, out var subInfo))
                {
                    var fullName = sMap.PlaceName.ToString() == sMap.LocationPlaceName.ToString() ? sMap.PlaceName.ToString() : sMap.PlaceName.Name + " - " + sMap.LocationPlaceName.Name;
                    subInfo = new LocationInfo(sMap.LocationPlaceName, fullName);
                    subInfo.Map = sMap;
                    locationIndex[sMap.LocationPlaceName] = subInfo;
                }

                // For places that only have sub-areas, make sure the location
                // defaults to the first one we encounter.
                if (!locationIndex.ContainsKey(sMap.PlaceName))
                    locationIndex[sMap.PlaceName] = subInfo;
            }

            // Finally index all the location data by map too.
            foreach (var info in locationIndex.Values)
                _builder.LocationInfoByMapId[info.Map.Key] = info;

            // Flesh out location/name/map data.
            var placeNameIndex = _builder.Sheet<Game.PlaceName>().ToDictionary(p => p.Key);
            foreach (var sPlaceName in placeNameIndex.Values)
            {
                if (sPlaceName.Key == 0)
                    continue;

                var name = Utils.SanitizeTags(ConvertPlaceNameName(sPlaceName));
                var loc = CreateLocation(sPlaceName.Key, name);

                // Combine map data.
                if (locationIndex.TryGetValue(sPlaceName, out var info))
                {
                    if (locationIndex.TryGetValue(info.Map.RegionPlaceName, out var parentRegionInfo))
                        loc.parentId = parentRegionInfo.PlaceName.Key;
                    else
                        throw new InvalidOperationException();

                    loc.size = info.Map.SizeFactor / 100.0;

                    loc.name = Utils.SanitizeTags(info.FullName);
                    info.Location = loc;

                    // Specify weather rates for applicable places.
                    if (info.Map.TerritoryType != null)
                    {
                        var rate = info.Map.TerritoryType.WeatherRate.Key;
                        if (rate != 0)
                            loc.weatherRate = rate;
                    }
                }
            }

            HackApplyTownWeatherRates();

            // Add references to each parent, and create name index.
            var index = _builder.Db.LocationIdsByName;
            foreach (var location in _builder.Db.Locations)
            {
                var name = (string)location.name;
                if (!index.ContainsKey(name))
                    index[name] = (int)location.id;

                if (location.parentId == null)
                    continue;

                _builder.Db.AddLocationReference((int)location.parentId);
            }
        }

        void HackApplyTownWeatherRates()
        {
            // I can't figure out where the skywatcher associates two-zone
            // towns with WeatherRates, so configure them manually here.

            var locationsById = _builder.Db.Locations.ToDictionary(l => (int)l.id);

            // Limsa Lominsa
            _builder.Db.AddLocationReference(27);
            locationsById[27].parentId = 22;
            locationsById[27].weatherRate = locationsById[28].weatherRate;

            // Ul'dah
            _builder.Db.AddLocationReference(39);
            locationsById[39].parentId = 23;
            locationsById[39].weatherRate = locationsById[52].weatherRate;

            // Gridania
            _builder.Db.AddLocationReference(51);
            locationsById[51].parentId = 24;
            locationsById[51].weatherRate = locationsById[40].weatherRate;

            // Ishgard
            _builder.Db.AddLocationReference(62);
            locationsById[62].parentId = 25;
            locationsById[62].weatherRate = locationsById[2300].weatherRate;

            // Diadem
            // Avoid old retired zones.
            locationsById[1647].weatherRate = 71;

            // Kugane
            _builder.Db.AddLocationReference(513);
            locationsById[513].weatherRate = 82;

            // Eureka
            _builder.Db.AddLocationReference(2405);
            _builder.Db.AddLocationReference(2414);
            _builder.Db.AddLocationReference(2462);
            _builder.Db.AddLocationReference(2530);
            locationsById[2414].weatherRate = 91; // fixme: should be auto-filled
            locationsById[2462].weatherRate = 94; // fixme: should be auto-filled
            locationsById[2530].weatherRate = 96; // fixme: should be auto-filled
        }

        static string ConvertPlaceNameName(Game.PlaceName sPlaceName)
        {
            // Shorten this name, it's way too long.
            if (sPlaceName.Key == 385)
                return "Observatorium";

            return sPlaceName.Name.ToString();
        }

        dynamic CreateLocation(int id, string name)
        {
            dynamic loc = new JObject();
            loc.id = id;
            loc.name = name;
            _builder.Db.Locations.Add(loc);
            _builder.Db.LocationsById[id] = loc;
            return loc;
        }

        void IndexNpcZones()
        {
            // Level table.
            foreach (var sLevel in _builder.Sheet<Game.Level>())
            {
                // NPC
                if (sLevel.Type == 8 && sLevel.Object != null && !_builder.LevelByNpcObjectKey.ContainsKey(sLevel.Object.Key))
                    _builder.LevelByNpcObjectKey[sLevel.Object.Key] = sLevel;
            }

            // Supplemental Libra places.
            foreach (var lPlaceName in _builder.Libra.Table<Libra.ENpcResident_PlaceName>())
                _builder.Db.NpcZoneByNpcId[lPlaceName.ENpcResident_Key] = lPlaceName.PlaceName_Key;

            Hacks.ApplyNpcZoneOverrides(_builder.Db);
        }
    }
}
