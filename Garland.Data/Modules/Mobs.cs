using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Modules
{
    public class Mobs : Module
    {
        Dictionary<int, List<Libra.BNpcName>> _libraMobsByGameKey = new Dictionary<int, List<Libra.BNpcName>>();

        public override string Name => "Mobs";

        void IndexLibraMobs()
        {
            foreach (var libraMob in _builder.Libra.Table<Libra.BNpcName>())
            {
                var key = (int)(libraMob.Key % 1000000);
                if (!_libraMobsByGameKey.TryGetValue(key, out var mobs))
                {
                    mobs = new List<Libra.BNpcName>();
                    _libraMobsByGameKey[key] = mobs;
                }
                mobs.Add(libraMob);
            }
        }

        public override void Start()
        {
            IndexLibraMobs();

            foreach (var sBNpcName in _builder.Sheet<SaintCoinach.Xiv.BNpcName>())
            {
                if (!_libraMobsByGameKey.TryGetValue(sBNpcName.Key, out var lBNpcNames))
                    continue;

                foreach (var lBNpcName in lBNpcNames)
                {
                    var hasDrops = _builder.ItemDropsByLibraMobId.TryGetValue(lBNpcName.Key, out var itemDropIds);
                    var hasInstance = _builder.InstanceIdsByLibraMobId.TryGetValue(lBNpcName.Key, out var instanceId);
                    if (!hasDrops && !hasInstance)
                        continue;

                    // fixme: Restructure mobs so they have a single game key, plus
                    // a list of locations and instances where item drops occur.

                    dynamic mob = new JObject();
                    mob.id = lBNpcName.Key;
                    mob.en = new JObject();
                    mob.en.name = lBNpcName.Index_en;
                    mob.fr = new JObject();
                    mob.fr.name = lBNpcName.Index_fr;
                    mob.de = new JObject();
                    mob.de.name = lBNpcName.Index_de;
                    mob.ja = new JObject();
                    mob.ja.name = lBNpcName.Index_ja;
                    //mob.patch = PatchDatabase.Get("mob", (int)libraNpc.Key);

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

                    if (hasDrops)
                    {
                        mob.drops = new JArray(itemDropIds);
                        _builder.Db.AddReference(mob, "item", itemDropIds, false);
                        foreach (var itemId in itemDropIds)
                            _builder.Db.AddReference(_builder.Db.ItemsById[itemId], "mob", lBNpcName.Key.ToString(), true);
                    }

                    if (hasInstance)
                    {
                        mob.instance = instanceId;
                        _builder.Db.AddReference(mob, "instance", instanceId, false);
                        _builder.Db.AddReference(_builder.Db.InstancesById[instanceId], "mob", lBNpcName.Key.ToString(), false);
                    }

                    var currency = _builder.GetBossCurrency(sBNpcName.Key);
                    if (currency != null)
                        mob.currency = currency;

                    _builder.Db.Mobs.Add(mob);
                    _builder.Db.MobsById[sBNpcName.Key] = mob;
                }
            }
        }
    }
}
