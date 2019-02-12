using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Models
{
    public class Patch
    {
        public decimal Id;
        public string Name;
        public string Series;

        public string FormattedId => Id.ToString("0.0", new CultureInfo("en-US", false));

        public Patch(decimal idArg, string nameArg, string seriesArg)
        {
            Id = idArg;
            Name = nameArg;
            Series = seriesArg;
        }

        public JObject ToJObject()
        {
            return new JObject(
                new JProperty("id", FormattedId),
                new JProperty("name", Name),
                new JProperty("series", Series));
        }
    }
}
