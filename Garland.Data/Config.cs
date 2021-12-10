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
        public const string BasePath = "..\\..\\..\\";
        public const string ConfigPath = BasePath + "Config.json";
        public const string SupplementalPath = BasePath + "Supplemental\\";
        public const string UpdatesPath = BasePath + "Updates\\";
        public const string PatchesPath = SupplementalPath + "patches.json";

        public static string IconPath => Path.Combine(FilesPath, "icons");

        // These values are configured in Config.json.
        public static string ConnectionString { get; private set; }
        public static string SapphireConnectionString { get; private set; }
        public static string GamePath { get; private set; }
        public static string FilesPath { get; private set; }
        public static string ImageMagickPath { get; private set; }
        public static string PngCrushPath { get; private set; }
        public static string DiffPath { get; private set; }
        public static string FfmpegPath { get; private set; }

        public static void Load()
        {
            if (!File.Exists(ConfigPath))
                throw new FileNotFoundException($"{ConfigPath} not found.  Please see CONTRIBUTING.md for setup instructions.");

            var text = File.ReadAllText(ConfigPath);
            dynamic values = JsonConvert.DeserializeObject(text);

            Config.ConnectionString = values.database;
            Config.SapphireConnectionString = values.sapphireDatabase;
            Config.GamePath = values.gamePath;
            Config.FilesPath = values.files;
            Config.ImageMagickPath = values.imageMagickConvert;
            Config.PngCrushPath = values.pngCrush;
            Config.DiffPath = values.diff;
            Config.FfmpegPath = values.ffmpeg;
        }
    }
    public class CalibrationConfig
    {
        public bool Reextract { get; private set; }
        public bool Extract40x { get; private set; }
        public bool Extract80x { get; private set; }

        public string CsvPath { get; private set; }
        public Source CalibrationSource { get; private set; }

        public CalibrationConfig(bool reextract, bool e40, bool e80, string csvPath, Source source)
        {
            Reextract = reextract;
            Extract40x = e40;
            Extract80x = e80;
            CsvPath = csvPath;
            CalibrationSource = source;
        }

        public enum Source
        {
            Definition,
            ItemCsv,
            Withdraw,
            None
        }
    }
}
