using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Modules
{
    public class StatisticsModule : Module
    {
        ItemSourceComplexity _complexity;

        public override string Name => "Statistics";

        public StatisticsModule(ItemSourceComplexity complexity)
        {
            _complexity = complexity;
        }

        public override void Start()
        {
            //RareItemsFromCheapDesynth.Calculate(_builder, _complexity);
        }
    }
}
