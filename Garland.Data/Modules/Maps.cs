using Newtonsoft.Json.Linq;
using SaintCoinach;
using SaintCoinach.Xiv;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Modules
{
    public class Maps : Module
    {
        const string _baseMapPath = "output\\maps\\";
        string _resultMapPath;

        public override string Name => "Maps";

        public override void Start()
        {
            _resultMapPath = Path.Combine(Config.FilesPath, "maps");

            Directory.CreateDirectory(_resultMapPath);

            foreach (var sMap in _builder.Sheet<Map>())
            {
                if (sMap.PlaceName.Key == 0 || sMap.PlaceName.ToString() == "???" || sMap.Id.ToString() == "")
                    continue;

                BuildMap(sMap);
            }
        }

        void BuildMap(Map sMap)
        {
            var file = sMap.Id.ToString().Replace("/", "-");

            dynamic map = new JObject();
            map.id = sMap.Key;
            map.file = file;
            map.size = sMap.SizeFactor / 100.0;

            if (sMap.LocationPlaceName.Key == 0)
            {
                map.name = sMap.PlaceName.ToString();
                map.placename = sMap.PlaceName.Key;
                _builder.Db.MapsByPlaceNameKey[sMap.PlaceName.Key] = map;
            }
            else
            {
                map.name = sMap.PlaceName.ToString() + " - " + sMap.LocationPlaceName.ToString();
                map.placename = sMap.LocationPlaceName.Key;
                _builder.Db.MapsByPlaceNameKey[sMap.LocationPlaceName.Key] = map;

                // Also index the maps by regular placename value, for imprecise
                // Libra data.
                if (!_builder.Db.MapsByPlaceNameKey.ContainsKey(sMap.PlaceName.Key))
                    _builder.Db.MapsByPlaceNameKey[sMap.PlaceName.Key] = map;
            }

            _builder.Db.MapsById[sMap.Key] = map;
            _builder.Db.MapsByName[(string)map.name] = map;

            var path = Path.Combine(_resultMapPath, file) + ".png";
            if (File.Exists(path))
                return;

            var image = sMap.MediumImage;
            if (image == null)
            {
                DatabaseBuilder.PrintLine($"Skipping map with no image {file}");
                return;
            }

            DatabaseBuilder.PrintLine($"New map: {file}");
            OptimizePng(image, path);
            image.Dispose();
        }

        static string Sanitize(string fileName)
        {
            return Utils
                .SanitizeTags(fileName)
                .Replace(":", "");
        }

        static string ConvertRegion(string region)
        {
            if (region == "???")
                return "Unknown";
            return region;
        }

        static void OptimizePng(System.Drawing.Image image, string path)
        {
            if (File.Exists(path))
                return;

            image.Save("output\\out.png", ImageFormat.Png);

            var convert = new Process();
            convert.StartInfo = new ProcessStartInfo(Config.ImageMagickPath, "-colors 256 +dither output\\out.png png8:output\\reduced.png");
            convert.StartInfo.CreateNoWindow = true;
            convert.Start();
            convert.WaitForExit();

            var crush = new Process();
            crush.StartInfo = new ProcessStartInfo(Config.PngCrushPath, "output\\reduced.png output\\crushed.png");
            crush.StartInfo.CreateNoWindow = true;
            crush.Start();
            crush.WaitForExit();

            File.Move("output\\crushed.png", path);
        }
    }
}
