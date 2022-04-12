using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Miscellaneous : Module
    {
        public override string Name => "Miscellaneous";

        public override void Start()
        {
            CharacterLevels();
            BeastTribe();
        }

        void BeastTribe()
        {
            foreach (var sBeastTribe in _builder.Sheet<Saint.BeastTribe>().Skip(1))
            {
                if (sBeastTribe.Icon != null)
                    IconDatabase.EnsureEntry("beast", sBeastTribe.Icon, sBeastTribe.Key);
            }

        }

        void CharacterLevels()
        {
            foreach (var sLevel in _builder.Sheet<Saint.ParamGrow>())
            {
                if (sLevel.ExpToNext == 0)
                {
                    GarlandDatabase.LevelCap = sLevel.Key - 1;
                    break;
                }

                _builder.Db.ExperienceToNextByLevel[sLevel.Key] = sLevel.ExpToNext;
            }
        }
    }
}
