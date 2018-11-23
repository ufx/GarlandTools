using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Models
{
    public class Patch
    {
        public decimal id;
        public string name;
        public string series;

        public Patch(decimal idArg, string nameArg, string seriesArg)
        {
            id = idArg;
            name = nameArg;
            series = seriesArg;
        }

        public JObject ToJObject()
        {
            return new JObject(
                new JProperty("id", id.ToString("0.0")),
                new JProperty("name", name),
                new JProperty("series", series));
        }
    }
}
