using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Dyes : Module
    {
        public override string Name => "Dyes";

        public override void Start()
        {
            foreach (var sStain in _builder.Sheet<Saint.Stain>())
            {
                if (sStain.Key == 0 || sStain.Name.ToString() == "")
                    continue;

                dynamic dye = new JObject();
                dye.id = sStain.Key;
                dye.name = sStain.Name.ToString();

                _builder.Db.Dyes.Add(dye);
            }
        }
    }
}
