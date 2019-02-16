using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Mobs : Module
    {
        Dictionary<int, List<BNpcData>> _bnpcDataByBaseKey = new Dictionary<int, List<BNpcData>>();

        public override string Name => "Mobs";

        void IndexLibraData()
        {
            foreach (var lBNpcName in _builder.Libra.Table<Libra.BNpcName>())
            {
                var nameKey = (int)(lBNpcName.Key % 10000000000);
                var baseKey = (int)(lBNpcName.Key / 10000000000);

                if (!_bnpcDataByBaseKey.TryGetValue(baseKey, out var bnpcDataList))
                {
                    bnpcDataList = new List<BNpcData>();
                    _bnpcDataByBaseKey[baseKey] = bnpcDataList;
                }

                var bnpcData = new BNpcData();
                bnpcData.BNpcBaseKey = baseKey;
                bnpcData.BNpcNameKey = nameKey;

                dynamic data = JsonConvert.DeserializeObject((string)lBNpcName.data);
                if (data.nonpop != null)
                    bnpcData.HasSpecialSpawnRules = true;

                if (data.region != null)
                {
                    var area = Utils.GetPair(data.region);
                    var zone = Utils.GetPair(area.Value);
                    var levelRange = (JArray)zone.Value;

                    var location = new BNpcLocation();
                    location.TerritoryTypeKey = int.Parse(zone.Key);
                    location.LevelRange = string.Join(" - ", levelRange.Select(v => (string)v));
                    bnpcData.Locations.Add(location);
                }

                bnpcDataList.Add(bnpcData);
            }
        }

        public override void Start()
        {
            IndexLibraData();

            var sBNpcNames = _builder.Sheet<Saint.BNpcName>();

            foreach (var sBNpcBase in _builder.Sheet<Saint.BNpcBase>())
            {
                if (!_bnpcDataByBaseKey.TryGetValue(sBNpcBase.Key, out var bnpcDataList))
                    continue;

                // No unnamed mobs right now.  Need to figure out how to fit
                // them in the base key - name key id structure.

                foreach (var bnpcData in bnpcDataList)
                {
                    var sBNpcName = sBNpcNames[bnpcData.BNpcNameKey];
                    var fullKey = (sBNpcBase.Key * 10000000000) + sBNpcName.Key;

                    dynamic mob = new JObject();
                    mob.id = fullKey;

                    _builder.Localize.Column((JObject)mob, sBNpcName, "Singular", "name", Utils.CapitalizeWords);

                    if (bnpcData.HasSpecialSpawnRules)
                        mob.quest = 1;

                    foreach (var location in bnpcData.Locations)
                    {
                        // fixme: Store in a location range.

                        if (location.Radius != 0)
                        {
                            // todo: coordinates
                        }

                        mob.zoneid = location.TerritoryTypeKey;
                        _builder.Db.AddLocationReference(location.TerritoryTypeKey);

                        // Technically level ranges are per-location, but for now the last range wins.
                        mob.lvl = location.LevelRange;
                    }

                    if (_builder.ItemDropsByMobId.TryGetValue(fullKey, out var itemDropIds))
                    {
                        mob.drops = new JArray(itemDropIds);
                        _builder.Db.AddReference(mob, "item", itemDropIds, false);
                        foreach (var itemId in itemDropIds)
                            _builder.Db.AddReference(_builder.Db.ItemsById[itemId], "mob", fullKey.ToString(), true);
                    }

                    if (_builder.InstanceIdsByMobId.TryGetValue(fullKey, out var instanceId))
                    {
                        mob.instance = instanceId;
                        _builder.Db.AddReference(mob, "instance", instanceId, false);
                        _builder.Db.AddReference(_builder.Db.InstancesById[instanceId], "mob", fullKey.ToString(), false);
                    }

                    var currency = _builder.GetBossCurrency(fullKey);
                    if (currency != null)
                        mob.currency = currency;

                    // todo: modelchara info
                    // todo: NpcEquip for equipment
                    // todo: BNpcCustomize for appearance
                    // todo: link all other mobs with this appearance
                    // todo: link all other mobs with this name

                    _builder.Db.Mobs.Add(mob);
                }
            }
        }

        class BNpcData
        {
            public int BNpcBaseKey;
            public int BNpcNameKey;
            public bool HasSpecialSpawnRules;
            public List<BNpcLocation> Locations = new List<BNpcLocation>();
        }

        class BNpcLocation
        {
            public int TerritoryTypeKey;
            public float X;
            public float Y;
            public float Z;
            public float Radius;
            public string LevelRange;
        }
    }
}
