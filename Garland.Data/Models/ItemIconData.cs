using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Models
{
    public class ItemIconData
    {
        public int ItemId;
        public int IconId;
        public int RawIconKey;
        public string Name;

        public static ItemIconData Parse(string[] line)
        {
            var obj = new ItemIconData();
            obj.ItemId = int.Parse(line[0]);
            obj.IconId = int.Parse(line[1]);
            obj.RawIconKey = int.Parse(line[2]);
            obj.Name = line[3];
            return obj;
        }

        public string ToLine()
        {
            return $"{ItemId}\t{IconId}\t{RawIconKey}\t{Name}";
        }
    }
}
