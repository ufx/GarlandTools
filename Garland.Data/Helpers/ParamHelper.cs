using Garland.Data.Models;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using SC = SaintCoinach.Xiv;

namespace Garland.Data.Helpers
{
    public static class ParamHelper
    {
        public static void SetMaxValue(SC.Items.Equipment equipment, SC.BaseParam baseParam, dynamic attr_max)
        {
            if (equipment.FreeMateriaSlots == 0)
                return;

            var meldCap = equipment.GetMateriaMeldCap(baseParam, true);
            if (meldCap > 0)
            {
                var paramMax = equipment.GetMaximumParamValue(baseParam);
                SetValue(baseParam, attr_max, paramMax, 0, false);
            }
        }

        public static void SetValue(SC.Parameter param, dynamic attr, dynamic attr_hq, bool isAction)
        {
            double amount = 0, amount_hq = 0;
            int max = 0, max_hq = 0;

            var values = param.Values.Select(v => ParameterInfo.From(v)).ToArray();

            // Regular values
            foreach (var value in values)
            {
                switch (value.Type)
                {
                    case SC.ParameterType.Primary:
                    case SC.ParameterType.Base:
                        amount = value.Amount;
                        max = value.Maximum;
                        break;

                    case SC.ParameterType.SetBonus:
                    case SC.ParameterType.SetBonusCapped:
                    case SC.ParameterType.Sanction:
                    case SC.ParameterType.EurekaEffect:
                        // Ignored, handled separately.
                        break;

                    case SC.ParameterType.Hq:
                        // Accumulated below.
                        break;

                    default:
                        throw new NotImplementedException();
                }
            }

            // HQ
            foreach (var value in values.Where(v => v.Type == SC.ParameterType.Hq))
            {
                if (isAction)
                {
                    amount_hq = value.Amount;
                    max_hq = value.Maximum;
                }
                else
                {
                    amount_hq = amount + value.Amount;
                    max_hq = max + value.Maximum;
                }
            }

            if (amount > 0 || max > 0)
                SetValue(param.BaseParam, attr, amount, max, isAction);

            if (amount_hq > 0 || max_hq > 0)
                SetValue(param.BaseParam, attr_hq, amount_hq, max_hq, isAction);
        }

        public static void SetValue(SC.BaseParam baseParam, JObject attr, double amount_base, int max, bool isAction)
        {
            var key = baseParam.Name.ToString();

            object amount = amount_base;
            if (Math.Floor(amount_base) == amount_base)
                amount = (int)amount_base;
            else
                amount = Math.Round((decimal)amount_base, 2);

            if (isAction && max > 0)
            {
                dynamic obj = new JObject();
                obj.rate = (int)(amount_base * 100);
                obj.limit = max;
                attr[key] = (JObject)obj;
            }
            else
                attr[key] = new JValue(amount);
        }
    }
}
