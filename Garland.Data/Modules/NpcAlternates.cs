using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Modules
{
    public class NpcAlternates : Module
    {
        public override string Name => "NPC Alternates";

        public override void Start()
        {
            foreach (var npc in _builder.Db.Npcs)
            {
                string name = npc.en.name ?? "";
                var alts = _builder.Db.NpcAlternatesByName[name];

                var otherAlts = alts.Where(a => a != npc).OrderBy(a => (int)a.id).ToArray();
                if (otherAlts.Length > 0)
                {
                    npc.alts = new JArray();

                    foreach (var alt in otherAlts)
                    {
                        int altId = alt.id;
                        npc.alts.Add(altId);
                        _builder.Db.AddReference(npc, "npc", altId, false);
                    }
                }
            }
        }
    }
}
