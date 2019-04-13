using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data
{
    public static class Config
    {
        public const string BasePath = "..\\..\\..\\..\\";
        public const string ConfigPath = BasePath + "Config.json";
        public const string SupplementalPath = "..\\..\\..\\Supplemental\\";
        public const string UpdatesPath = "..\\..\\..\\..\\Updates\\";

        public static string IconPath => FilesPath + "icons\\";

        // These values are configured in Config.json.
        public static string ConnectionString { get; private set; }
        public static string SapphireConnectionString { get; private set; }
        public static string FilesPath { get; private set; }
        public static string ImageMagickPath { get; private set; }
        public static string DiffPath { get; private set; }
        public static string FfmpegPath { get; private set; }

        public static void Load()
        {
            var text = File.ReadAllText(ConfigPath);
            dynamic values = JsonConvert.DeserializeObject(text);

            Config.ConnectionString = values.database;
            Config.SapphireConnectionString = values.sapphireDatabase;
            Config.FilesPath = values.files;
            Config.ImageMagickPath = values.imageMagickConvert;
            Config.DiffPath = values.diff;
            Config.FfmpegPath = values.ffmpeg;
        }
    }
}
