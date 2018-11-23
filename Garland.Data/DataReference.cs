using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data
{
    public class DataReference
    {
        public string Type;
        public string Id;
        public bool IsNested;

        public DataReference(string type, string id, bool isNested)
        {
            Type = type;
            Id = id;
            IsNested = isNested;
        }
    }
}
