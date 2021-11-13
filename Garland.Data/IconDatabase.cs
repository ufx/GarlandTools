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
        static HashSet<string> _iconsByKey = new HashSet<string>();
        static HashSet<string> _iconsHQByKey = new HashSet<string>();

        public static int EnsureEntry(string type, ImageFile icon, int id)
        {
            if (icon == null || icon.Path.EndsWith("000000.tex"))
            {
                // If you've triggered this it's usually because a reference
                // to bad data crept in somewhere.  Check up the stack!
                // Protip: The first row of many sheets is filled with 0s and 
                // can be safely skipped.
                throw new ArgumentException("bad icon", "icon");
            }

            // Check the type-id combo is already stored.
            var key = type + "-" + id;
            if (_iconsByKey.Contains(key))
                return id;

            // Always add it to the list.
            _iconsByKey.Add(key);

            // Check the file exists already.
            var iconDirectory = Path.Combine(Config.IconPath, type);
            var fullPath = Path.Combine(iconDirectory, id.ToString() + ".png");
            if (File.Exists(fullPath))
                return id;

            // Write icons that don't yet exist.
            Directory.CreateDirectory(iconDirectory);
            var image = icon.GetImage();
            image.Save(fullPath, System.Drawing.Imaging.ImageFormat.Png);

            return id;
        }

        public static int EnsureEntry(string type, ImageFile icon)
        {
            return EnsureEntry(type, icon, Utils.GetIconId(icon));
        }

        // Let us do some hacks here for hq icon...
        public static int EnsureEntryHQ(string type, ImageFile icon, int id)
        {
            if (icon == null || icon.Path.EndsWith("000000.tex"))
            {
                // If you've triggered this it's usually because a reference
                // to bad data crept in somewhere.  Check up the stack!
                // Protip: The first row of many sheets is filled with 0s and 
                // can be safely skipped.
                throw new ArgumentException("bad icon", "icon");
            }

            // Check the type-id combo is already stored.
            var key = type + "-" + id;
            if (_iconsHQByKey.Contains(key))
                return id;

            // Always add it to the list.
            _iconsHQByKey.Add(key);

            // Check the file exists already.
            var iconDirectory = Path.Combine(Config.IconPath, type);
            var fullPath = Path.Combine(iconDirectory, id.ToString() + "_hr1.png");
            if (File.Exists(fullPath))
                return id;

            // Write hq icons that don't yet exist.
            Directory.CreateDirectory(iconDirectory);

            System.Drawing.Image image = null;

            string iconPath = icon.Path;
            iconPath = iconPath.Replace(".tex", "_hr1.tex");
            DatabaseBuilder.Instance.Realm.Packs.TryGetFile(iconPath, out var fileHQ);
            if (fileHQ != null)
            {
                var iconHQ = (ImageFile)fileHQ;
                image = iconHQ.GetImage();
            }
            else
            {
                image = icon.GetImage();
            }

            image.Save(fullPath, System.Drawing.Imaging.ImageFormat.Png);

            return id;
        }

        public static int EnsureEntryHQ(string type, ImageFile icon)
        {
            return EnsureEntryHQ(type, icon, Utils.GetIconId(icon));
        }
    }
}
