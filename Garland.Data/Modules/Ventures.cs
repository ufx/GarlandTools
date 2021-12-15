using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Ventures : Module
    {
        public override string Name => "Ventures";

        public override void Start()
        {
            foreach (var sVenture in _builder.Sheet<Saint.RetainerTask>())
            {
                if (sVenture.Key == 0 || sVenture.ClassJobCategory.Key == 0 || sVenture.Task.Key == 0)
                    continue;

                dynamic venture = new JObject();
                venture.id = sVenture.Key;
                venture.jobs = (byte)sVenture.ClassJobCategory.Key;
                venture.lvl = sVenture.RetainerLevel;
                venture.cost = sVenture.VentureCost;
                venture.minutes = sVenture.SourceRow.GetRaw("MaxTime{min}");

                if (sVenture.IsRandom)
                {
                    venture.random = 1;
                    if (sVenture.ClassJobCategory.Key == 34)
                        venture.ilvl = new JArray(sVenture.RequiredItemLevel);
                    if (sVenture.RequiredGathering > 0)
                        venture.gathering = new JArray(sVenture.RequiredGathering);
                }
                else
                {
                    var sRetainerTaskParameter = (Saint.XivRow)sVenture["RetainerTaskParameter"];

                    var classJobCategoryKey = sVenture.ClassJobCategory.Key;
                    if (classJobCategoryKey == 34) // Disciples of War or Magic
                    {
                        var ilvl2 = sRetainerTaskParameter.AsInt32("ItemLevel{DoW}[0]");
                        var ilvl3 = sRetainerTaskParameter.AsInt32("ItemLevel{DoW}[1]");
                        var ilvl4 = sRetainerTaskParameter.AsInt32("ItemLevel{DoW}[2]");
                        var ilvl5 = sRetainerTaskParameter.AsInt32("ItemLevel{DoW}[3]");
                        venture.ilvl = new JArray(sVenture.RequiredItemLevel, ilvl2, ilvl3, ilvl4, ilvl5);
                    }
                    else if (classJobCategoryKey == 17 || classJobCategoryKey == 18)
                    {
                        // MIN and BTN
                        var gathering2 = sRetainerTaskParameter.AsInt32("Perception{DoL}[0]");
                        var gathering3 = sRetainerTaskParameter.AsInt32("Perception{DoL}[1]");
                        var gathering4 = sRetainerTaskParameter.AsInt32("Perception{DoL}[2]");
                        var gathering5 = sRetainerTaskParameter.AsInt32("Perception{DoL}[3]");
                        venture.gathering = new JArray(sVenture.RequiredGathering, gathering2, gathering3, gathering4, gathering5);
                    }
                    else if (classJobCategoryKey == 19)
                    {
                        // FSH
                        var gathering2 = sRetainerTaskParameter.AsInt32("Perception{FSH}[0]");
                        var gathering3 = sRetainerTaskParameter.AsInt32("Perception{FSH}[1]");
                        var gathering4 = sRetainerTaskParameter.AsInt32("Perception{FSH}[2]");
                        var gathering5 = sRetainerTaskParameter.AsInt32("Perception{FSH}[3]");
                        venture.gathering = new JArray(sVenture.RequiredGathering, gathering2, gathering3, gathering4, gathering5);
                    }
                    else
                        throw new NotImplementedException($"Invalid ClassJobCategory ${classJobCategoryKey} on venture.");
                }

                if (sVenture.Task is Saint.RetainerTaskRandom sRandomTask)
                    venture.name = (string)sRandomTask.Name;

                if (sVenture.Task is Saint.RetainerTaskNormal sNormalTask)
                {
                    venture.amounts = new JArray(sNormalTask.Quantities);

                    var item = _builder.Db.ItemsById[sNormalTask.Item.Key];
                    if (item.ventures == null)
                        item.ventures = new JArray();
                    JArray ventures = item.ventures;
                    ventures.Add(sVenture.Key);
                }

                _builder.Db.Ventures.Add(venture);
                _builder.Db.VenturesById[sVenture.Key] = venture;
            }
        }
    }
}
