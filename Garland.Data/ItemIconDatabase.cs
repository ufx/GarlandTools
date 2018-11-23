using SaintCoinach.Imaging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Garland.Data.Models;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data
{
    public static class ItemIconDatabase
    {
        private static Dictionary<ImageFile, object> _iconIdByImageFile = new Dictionary<ImageFile, object>();
        private static int _currentIconId = 0;
        private static List<ImageFile> _temporaryIcons = new List<ImageFile>();
        private static HashSet<ImageFile> _imagesNeedingIcons = new HashSet<ImageFile>();
        public static List<Saint.Item> ItemsNeedingIcons = new List<Saint.Item>();
        public static Dictionary<ImageFile, Queue<Saint.Item>> AlternatesNeedingIcons = new Dictionary<ImageFile, Queue<Saint.Item>>();
        public static Dictionary<int, ItemIconData> IconDataByItemId = new Dictionary<int, ItemIconData>();


        public static void Initialize(IEnumerable<Saint.Item> items)
        {
            // Load map file.
            var iconDataLines = Utils.Tsv("Supplemental\\item-icon-db.tsv");
            foreach (var line in iconDataLines.Skip(1))
            {
                var iconData = ItemIconData.Parse(line);
                if (iconData.IconId == 0)
                    continue;

                IconDataByItemId[iconData.ItemId] = iconData;
            }

            if (IconDataByItemId.Count > 0)
                _currentIconId = IconDataByItemId.Max(p => p.Value.IconId);

            // Check icon data is valid.
            foreach (var item in items)
                CheckIconData(item);

            // Generate temporaries for icons that have no stored iconId.
            foreach (var item in items.Where(i => !_iconIdByImageFile.ContainsKey(i.Icon)))
                GenerateTemporaryIcon(item);
        }

        private static void CheckIconData(Saint.Item item)
        {
            if (!IconDataByItemId.TryGetValue(item.Key, out var storedIconData))
                return;

            var rawIconKey = (UInt16)item.GetRaw("Icon");

            // Ensure the stored data is still what we expect.
            if (rawIconKey != storedIconData.RawIconKey)
            {
                // Icon changed!  Remove data.
                DatabaseBuilder.PrintLine($"{item.Key} {item.Name} icon changed.  {rawIconKey} != {storedIconData.RawIconKey}.  Removing.");
                IconDataByItemId.Remove(item.Key);
            }
            else
            {
                // Have valid stored data.  Cross-reference the image file.
                _iconIdByImageFile[item.Icon] = storedIconData.IconId;
            }
        }

        private static void GenerateTemporaryIcon(Saint.Item item)
        {
            // Store alternates found for any item that needs an icon.
            if (_temporaryIcons.Contains(item.Icon))
            {
                if (!AlternatesNeedingIcons.TryGetValue(item.Icon, out var alternates))
                    AlternatesNeedingIcons[item.Icon] = alternates = new Queue<Saint.Item>();
                alternates.Enqueue(item);
            }

            // Generate the temp.
            ItemsNeedingIcons.Add(item);
            _temporaryIcons.Add(item.Icon);
            var temporaryId = "t/" + int.Parse(Path.GetFileNameWithoutExtension(item.Icon.Path));
            _iconIdByImageFile[item.Icon] = temporaryId;
        }

        public static object GetIconId(Saint.Item item)
        {
            if (IconDataByItemId.TryGetValue(item.Key, out var storedIconData))
            {
                storedIconData.RawIconKey = (UInt16)item.GetRaw("Icon");
                _iconIdByImageFile[item.Icon] = storedIconData.IconId;
                return storedIconData.IconId;
            }

            if (_iconIdByImageFile.TryGetValue(item.Icon, out var otherIconId))
                return otherIconId;

            throw new InvalidOperationException("Item has no icon id.");
        }

        public static void WriteUpdates()
        {
            WriteTemporaryIcons();
        }

        public static void WriteTemporaryIcons()
        {
            const string basePath = Config.IconPath + "item\\t";

            if (_temporaryIcons.Count == 0)
                return;

            if (!Directory.Exists(basePath))
                Directory.CreateDirectory(basePath);

            foreach (var icon in _temporaryIcons)
            {
                var imageFileName = basePath + "\\" + Utils.GetIconId(icon) + ".png";
                if (File.Exists(imageFileName))
                    continue;

                var image = icon.GetImage();
                image.Save(imageFileName, System.Drawing.Imaging.ImageFormat.Png);
            }
        }

        public static void WriteNewIcon(ItemIconData data, byte[] bytes)
        {
            data.IconId = ++_currentIconId;
            File.WriteAllBytes(Config.IconPath + "item\\" + data.IconId + ".png", bytes);
        }

        public static Saint.Item DequeueAlternate(ImageFile icon)
        {
            if (AlternatesNeedingIcons.TryGetValue(icon, out var alternates))
            {
                if (alternates.Count > 0)
                    return alternates.Dequeue();
            }

            return null;
        }
    }
}
