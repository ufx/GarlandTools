using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class JobCategories : Module
    {
        public override string Name => "Job Categories";

        public override void Start()
        {
            foreach (var sClassJobCategory in _builder.Sheet<Game.ClassJobCategory>())
            {
                if (sClassJobCategory.Key == 0 || sClassJobCategory.ClassJobs.Count() == 0)
                    continue;

                dynamic category = new JObject();
                category.id = sClassJobCategory.Key;
                category.name = sClassJobCategory.Name.ToString();
                category.jobs = new JArray(sClassJobCategory.ClassJobs.Select(c => c.Key));
                _builder.Db.JobCategories.Add(category);
            }
        }
    }
}
