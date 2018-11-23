using SaintCoinach.Imaging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data
{
    public static class IconDatabase
    {
        private static Dictionary<string, IconEntry> _entries = new Dictionary<string, IconEntry>();

        public static void Initialize()
        {
            var separator = new[] { ", " };
            var text = File.ReadAllText("Supplemental\\icon-db.txt")
                .Replace("\r\n", "\n")
                .Split(new string[] { "\n" }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var line in text)
            {
                var parts = line.Split(separator, StringSplitOptions.None);
                var entry = new IconEntry()
                {
                    Type = parts[0],
                    Id = int.Parse(parts[1])
                };

                _entries[entry.Key] = entry;
            }
        }

        public static int EnsureEntry(string type, ImageFile icon, int id)
        {
            if (icon.Path.EndsWith("000000.tex"))
                throw new ArgumentException("bad icon", "icon");

            var key = type + ", " + id;
            if (_entries.ContainsKey(key))
                return id;

            // New entries here!
            var entry = new IconEntry() { Type = type, Id = id, Icon = icon };
            _entries[entry.Key] = entry;
            HasNewEntries = true;

            return id;
        }

        public static int EnsureEntry(string type, ImageFile icon)
        {
            return EnsureEntry(type, icon, Utils.GetIconId(icon));
        }

        public static void WriteUpdates()
        {
            if (!HasNewEntries)
                return;

            var newEntries = _entries.Values.Where(e => e.Icon != null);
            foreach (var entry in newEntries) {
                var path = Config.IconPath + entry.Type;
                Directory.CreateDirectory(path);

                var image = entry.Icon.GetImage();
                image.Save(path + "\\" + entry.Id + ".png", System.Drawing.Imaging.ImageFormat.Png);
            }

            var text = _entries.Select(e => e.Value.Key).ToArray();
            File.WriteAllLines(Config.SupplementalPath + "icon-db.txt", text);
        }

        public static bool HasNewEntries { get; private set; }
    }

    public class IconEntry
    {
        public int Id { get; set; }
        public string Type { get; set; }
        public ImageFile Icon { get; set; }

        public string Key
        {
            get { return Type + ", " + Id; }
        }
    }
}
