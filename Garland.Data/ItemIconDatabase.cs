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
    public class ItemIconDatabase
    {
        string _itemIconPath;
        
        bool _overwriteIcon = false;
        Dictionary<UInt16, object> _iconPathsByIconId = new Dictionary<UInt16, object>();
        public List<Saint.Item> ItemsNeedingIcons = new List<Saint.Item>();

        public ItemIconDatabase() { }
        
        public void Initialize(IEnumerable<Saint.Item> sItems)
        {
            _itemIconPath = Path.Combine(Config.IconPath, "item");
            Directory.CreateDirectory(Path.Combine(_itemIconPath, "t"));

            // Load set of existing icon ids.
            foreach (var iconFileName in Directory.EnumerateFiles(_itemIconPath))
            {
                if (iconFileName.Contains("json"))
                    continue;
                var iconId = UInt16.Parse(Path.GetFileNameWithoutExtension(iconFileName));
                _iconPathsByIconId[iconId] = iconId;
            }

            // Mark items that do not have an icon.
            foreach (var sItem in sItems)
            {
                var iconId = (UInt16)sItem.GetRaw("Icon");
                if (!_iconPathsByIconId.ContainsKey(iconId))
                    ItemsNeedingIcons.Add(sItem);
            }
        }

        public object EnsureIcon(Saint.Item sItem)
        {
            var iconId = (UInt16)sItem.GetRaw("Icon");
            if (_iconPathsByIconId.TryGetValue(iconId, out var iconPath))
                return iconPath;

            // This item has no high-res icon, generate a low-res temporary instead.
            var temporaryId = "t/" + iconId;
            _iconPathsByIconId[iconId] = temporaryId;

            // Write the temporary.
            var path = Path.Combine(_itemIconPath, temporaryId) + ".png";
            if (File.Exists(path) && !_overwriteIcon)
                return temporaryId;

            var image = sItem.Icon.GetImage();
            image.Save(path, System.Drawing.Imaging.ImageFormat.Png);

            return temporaryId;
        }

        public bool HasIcon(UInt16 iconId)
        {
            lock (_iconPathsByIconId)
                return _iconPathsByIconId.ContainsKey(iconId);
        }

        public void WriteIcon(UInt16 iconId, byte[] bytes)
        {
            lock (_iconPathsByIconId)
            {
                _iconPathsByIconId[iconId] = iconId.ToString();

                var path = Path.Combine(_itemIconPath, iconId.ToString() + ".png");
                File.WriteAllBytes(path, bytes);
            }
        }
    }
}
