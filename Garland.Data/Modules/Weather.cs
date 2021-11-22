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
    public class Weather : Module
    {
        public override string Name => "Weather";

        public override void Start()
        {
            var baseIconPath = Path.Combine(Config.IconPath, "weather");

            Directory.CreateDirectory(baseIconPath);

            Directory.CreateDirectory(baseIconPath);

            // Extract weather names, ensure their icons are written.
            foreach (var sWeather in _builder.Sheet<Saint.Weather>())
            {
                var name = sWeather.Name.ToString();

                // This one is corrupted
                if ("CutScene".Equals(name))
                    continue;

                var iconPath = Path.Combine(baseIconPath, name + ".png");
                if (!string.IsNullOrEmpty(name) && !File.Exists(iconPath))
                {
                    var image = sWeather.Icon.GetImage();
                    image.Save(iconPath, System.Drawing.Imaging.ImageFormat.Png);
                }

                _builder.Db.Weather.Add(name);
            }

            // Extract weather rates.
            foreach (var sWeatherRate in _builder.Sheet<Saint.WeatherRate>())
            {
                dynamic weatherRate = new JObject();
                weatherRate.id = sWeatherRate.Key;
                weatherRate.rates = new JArray();
                var min = 0;
                for (var i = 0; i < 8; i++)
                {
                    var suffix = "[" + i + "]";
                    var weather = (Saint.Weather)sWeatherRate["Weather" + suffix];
                    var rate = Convert.ToInt32(sWeatherRate["Rate" + suffix]);

                    if (weather.Key == 0)
                        break; // No more.

                    min += rate;
                    dynamic entry = new JObject();
                    entry.weather = weather.Key;
                    entry.rate = min;

                    weatherRate.rates.Add(entry);
                }

                _builder.Db.WeatherRates.Add(weatherRate);
            }
        }
    }
}
