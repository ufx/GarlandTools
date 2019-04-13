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
            _resultMapPath = Config.FilesPath + "maps\\";

            foreach (var m in _builder.Sheet<Map>())
            {
                if (m.PlaceName.Key == 0 || m.PlaceName.ToString() == "???" || m.Id.ToString() == "")
                    continue;

                ExportSingleMap(m);
            }
        }

        void ExportSingleMap(Map map)
        {
            var regionPlaceName = ConvertRegion(map.RegionPlaceName.ToString());
            var path = _resultMapPath + regionPlaceName;

            var fileName = map.PlaceName.ToString();
            if (map.LocationPlaceName.Key != 0 && map.LocationPlaceName.ToString() != map.PlaceName.ToString() && map.LocationPlaceName.ToString() != "")
                fileName += " - " + map.LocationPlaceName.ToString();

            if (fileName.Trim() == "")
                return;

            fileName = "\\" + Sanitize(fileName) + ".png";

            var finalPath = path + fileName;
            if (File.Exists(finalPath))
                return;

            var image = map.MediumImage;
            if (image == null)
            {
                DatabaseBuilder.PrintLine($"Skipping map with no image {fileName}");
                return;
            }

            if (!Directory.Exists(path))
                Directory.CreateDirectory(path);

            DatabaseBuilder.PrintLine($"New map: {fileName}");
            OptimizePng(image, finalPath);
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
            crush.StartInfo = new ProcessStartInfo("pngcrush", "output\\reduced.png output\\crushed.png");
            crush.StartInfo.CreateNoWindow = true;
            crush.Start();
            crush.WaitForExit();

            File.Move("output\\crushed.png", path);
        }
    }
}
