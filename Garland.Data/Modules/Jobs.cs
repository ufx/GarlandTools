using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Jobs : Module
    {
        string _jobIconPath;

        public override string Name => "Jobs";

        public override void Start()
        {
            _jobIconPath = Path.Combine(Config.IconPath, "job");

            foreach (var sJob in _builder.Sheet<Saint.ClassJob>())
            {
                var name = sJob.Name.ToString();
                if (string.IsNullOrEmpty(name))
                {
                    DatabaseBuilder.PrintLine($"Skipping unreleased job {sJob.Key}!");
                    continue;
                }

                dynamic job = new JObject();
                job.id = sJob.Key;
                job.abbreviation = sJob.Abbreviation.ToString();
                job.name = Utils.CapitalizeWords(name);
                job.category = sJob.ClassJobCategory.Name.ToString();
                job.startingLevel = sJob.StartingLevel;

                if (sJob.SoulCrystal != null && sJob.SoulCrystal.Key != 0)
                    job.isJob = 1;

                var iconPath = Path.Combine(_jobIconPath, sJob.Abbreviation.ToString() + ".png");
                if (!File.Exists(iconPath))
                {
                    var icon = sJob.Icon.GetImage();
                    icon.Save(iconPath, System.Drawing.Imaging.ImageFormat.Png);
                }

                _builder.Db.Jobs.Add(job);
            }
        }
    }
}
