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
        Dictionary<int, List<Libra.BNpcName>> _lBNpcNamesByBaseKey = new Dictionary<int, List<Libra.BNpcName>>();

        public override string Name => "Mobs";

        void IndexLibraMobs()
        {
            foreach (var lBNpcName in _builder.Libra.Table<Libra.BNpcName>())
            {
                //var key = (int)(libraMob.Key % 10000000000);
                var baseKey = (int)(lBNpcName.Key / 10000000000);

                // Can't be more than one name per BNpcBase right?
                if (!_lBNpcNamesByBaseKey.TryGetValue(baseKey, out var lBNpcNames))
                {
                    lBNpcNames = new List<Libra.BNpcName>();
                    _lBNpcNamesByBaseKey[baseKey] = lBNpcNames;
                }

                lBNpcNames.Add(lBNpcName);
            }
        }

        public override void Start()
        {
            IndexLibraMobs();

            var sBNpcNames = _builder.Sheet<Saint.BNpcName>();

            foreach (var sBNpcBase in _builder.Sheet<Saint.BNpcBase>())
            {
                if (!_lBNpcNamesByBaseKey.TryGetValue(sBNpcBase.Key, out var lBNpcNames))
                    continue;

                // No unnamed mobs right now.  Need to figure out how to fit
                // them in the base key - name key id structure.

                foreach (var lBNpcName in lBNpcNames)
                {
                    var sBNpcName = sBNpcNames[(int)(lBNpcName.Key % 10000000000)];
                    var fullKey = (sBNpcBase.Key * 10000000000) + sBNpcName.Key;

                    dynamic mob = new JObject();
                    mob.id = fullKey;

                    _builder.Localize.Column((JObject)mob, sBNpcName, "Singular", "name", Utils.CapitalizeWords);

                    // defunct, renamed to mob-old
                    //mob.patch = PatchDatabase.Get("mob-old", (int)libraNpc.Key);

                    dynamic data = JsonConvert.DeserializeObject((string)lBNpcName.data);
                    if (data.nonpop != null)
                        mob.quest = 1;

                    if (data.region != null)
                    {
                        var area = Utils.GetPair(data.region);
                        var zone = Utils.GetPair(area.Value);
                        mob.zoneid = int.Parse(zone.Key);
                        _builder.Db.AddLocationReference((int)mob.zoneid);

                        var levelRange = (JArray)zone.Value;
                        mob.lvl = string.Join(" - ", levelRange.Select(v => (string)v));
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
    }
}
