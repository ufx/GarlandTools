using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Emotes : Module
    {
        public override string Name => "Emotes";

        public override void Start()
        {
            foreach (var sEmote in _builder.Sheet<Saint.Emote>())
            {
                var name = sEmote.Name.ToString();
                if (string.IsNullOrEmpty(name))
                    continue;

                _builder.EmoteNamesById[sEmote.Key] = name;

                for (var i = 0; i < 7; i++)
                {
                    var timeline = (Saint.XivRow)sEmote[$"ActionTimeline[{i}]"];
                    if (timeline.Key > 0)
                        _builder.EmoteNamesById[timeline.Key] = name;
                }
            }
        }
    }
}
