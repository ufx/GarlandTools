using SaintCoinach.Xiv;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Models
{
    public class ParameterInfo
    {
        public double Amount;
        public int Maximum;
        public ParameterType Type;
        public int Index;

        public static ParameterInfo From (SaintCoinach.Xiv.ParameterValue value) {
            var info = new ParameterInfo();
            info.Type = value.Type;
            info.Index = value.Index;

            if (value is ParameterValueRelativeLimited)
                info.Maximum = ((ParameterValueRelativeLimited)value).Maximum;

            if (value is ParameterValueRelative)
                info.Amount = ((ParameterValueRelative)value).Amount;
            else if (value is ParameterValueFixed)
                info.Amount = ((ParameterValueFixed)value).Amount;
            else
                throw new NotImplementedException();

            return info;
        }
    }
}
