using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Statuses : Module
    {
        public override string Name => "Statuses";

        public override void Start()
        {
            BuildStatuses();
        }

        void BuildStatuses()
        {
            foreach (var sStatus in _builder.Sheet<Saint.Status>())
                BuildStatus(sStatus);
        }

        dynamic BuildStatus(Saint.Status sStatus)
        {
            dynamic status = new JObject();
            status.id = sStatus.Key;
            _builder.Localize.Strings((JObject)status, sStatus, "Name");
            _builder.Localize.HtmlStrings((JObject)status, sStatus, "Description");
            status.patch = PatchDatabase.Get("status", sStatus.Key);
            status.category = sStatus.Category;

            status.canDispel = sStatus.CanDispel;

            // If the status doesn't have an icon, we probably don't want it in our data
            if (sStatus.Icon != null && !sStatus.Icon.Path.EndsWith("000000.tex"))
                status.icon = IconDatabase.EnsureEntry("status", sStatus.Icon);
            else
                return null;

            _builder.Db.Statuses.Add(status);
            _builder.Db.StatusesById[sStatus.Key] = status;

            return status;
        }
    }
}
