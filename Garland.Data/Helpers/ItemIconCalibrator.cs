using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;
using Newtonsoft.Json;
using System.Globalization;

namespace Garland.Data.Helpers
{
    public class ItemIconCalibrator
    {
        static string _iconPath = Config.FilesPath + "icons\\item\\";
        static string _definitionPath = _iconPath + "icon.definition.json";
        static string _withdrawPath = _iconPath + "icon.withdraw.json";
        static string _notFoundPath = _iconPath + "icon.notfound.json";

        static string _dir128 = _iconPath + "128x\\";
        static string _dir40 = _iconPath + "40x\\";
        static string _dirT = _iconPath + "t\\";

        SaintCoinach.ARealmReversed _realm;
        CalibrationConfig _config;

        Dictionary<string, string> _oldIconByItemId = new Dictionary<string, string>();
        Dictionary<string, string> _newIconByItemId = new Dictionary<string, string>();
        HashSet<string> _iconMoved = new HashSet<string>();
        List<string> _itemRequiresIcon = new List<string>();

        public ItemIconCalibrator(CalibrationConfig config, SaintCoinach.ARealmReversed realm)
        {
            _config = config;
            _realm = realm;
        }

        public void Calibrate()
        {
            List<Saint.Item> ItemsToImport = _realm.GameData.GetSheet<Saint.Item>()
                .Where(i => !Hacks.IsItemSkipped(i.Name, i.Key)).ToList();

            DatabaseBuilder.PrintLine("Reading icon definition... (1/5)");
            ReadIconDefinition(ItemsToImport);

            DatabaseBuilder.PrintLine("Preparing working directory... (2/5)");
            PrepareDirectory();

            if (_config.Reextract)
            {
                DatabaseBuilder.PrintLine("Extracting in game icons... (3/5)");
                ExtractIcons(ItemsToImport);
            }
            
            DatabaseBuilder.PrintLine("Adjusting 128x icon... (4/5)");
            Move128Icons();

            DatabaseBuilder.PrintLine("Writing icon definition... (5/5)");
            WriteIconDefinition();

            //Cleanup();

            DatabaseBuilder.PrintLine("Icon calibration done. \n" +
                "Please re-export the database to bind icon to json.");
        }

        private void ReadIconDefinition(List<Saint.Item> items)
        {
            
            foreach (var item in items)
            {
                string iconId = Utils.GetIconId(item.Icon).ToString();
                if (iconId != "0")
                    _newIconByItemId[item.Key.ToString()] = iconId;
            }

            switch (_config.CalibrationSource)
            {
                case CalibrationConfig.Source.Definition:
                    try
                    {
                        string json = File.ReadAllText(_definitionPath, Encoding.UTF8);
                        _oldIconByItemId = JsonConvert.DeserializeObject<Dictionary<string, string>>(json);
                    }
                    catch
                    {
                        DatabaseBuilder.PrintLine("There is an error loding the withdraw.json.");
                        throw;
                    }
                    break;
                case CalibrationConfig.Source.ItemCsv:
                    Dictionary<string, int> keyIndexes = new Dictionary<string, int>();
                    //  Csv is shit.
                    var oldItems = Utils.Csv(_config.CsvPath);
                    var keys = oldItems.ElementAt(1);
                    for (int i = 0; i < keys.Length; i++)
                    {
                        keyIndexes[keys[i]] = i;
                    }

                    foreach (var row in oldItems.Skip(4))
                    {
                        try
                        {
                            string iconId = row[keyIndexes["Icon"]];
                            if (iconId != "0")
                                _oldIconByItemId[row[0].Trim()] = iconId;
                        }
                        catch (Exception)
                        {
                            DatabaseBuilder.PrintLine("Bad Item.icon.csv.");
                            throw;
                        }
                    }
                    break;
                case CalibrationConfig.Source.Withdraw:
                    _oldIconByItemId = _newIconByItemId;
                    try
                    {
                        string json = File.ReadAllText(_withdrawPath, Encoding.UTF8);
                        _newIconByItemId = JsonConvert.DeserializeObject<Dictionary<string, string>>(json);
                    } catch
                    {
                        DatabaseBuilder.PrintLine("There is an error loding the withdraw.json.");
                        throw;
                    }
                    break;
                case CalibrationConfig.Source.None:
                    break;
            }
        }

        private void PrepareDirectory()
        {
            Directory.CreateDirectory(_dir128);
            // Empty the main directory, avoid naming problem.
            foreach (var iconFilePath in Directory.GetFiles(_iconPath))
            {
                FileInfo iconFile = new FileInfo(iconFilePath);
                string dest = Path.Combine(_dir128, iconFile.Name);
                if (File.Exists(dest))
                {
                    File.Delete(dest);
                }
                iconFile.MoveTo(dest);
            }
            if (_config.Reextract)
            {
                try
                {
                    Directory.Delete(_dirT, true);
                }
                catch (DirectoryNotFoundException) { }
                try
                {
                    Directory.Delete(_dir40, true);
                }
                catch (DirectoryNotFoundException) { }
            }
        }

        private void ExtractIcons(List<Saint.Item> items)
        {
            foreach (var item in items)
            {
                if (_config.Extract40x)
                {
                    IconDatabase.EnsureEntry("item\\40x", item.Icon);
                }
                if (_config.Extract80x)
                {
                    IconDatabase.EnsureEntryHQ("item\\t", item.Icon, _realm);
                }
            }
        }

        private void Move128Icons()
        {
            foreach (var itemId in _newIconByItemId.Keys)
            {
                if (_oldIconByItemId.TryGetValue(itemId, out string oldIcon))
                {
                    if (_iconMoved.Contains(oldIcon))
                        continue;

                    string newIcon = _newIconByItemId[itemId];
                    FileInfo oldIconFile = new FileInfo(Path.Combine(_dir128, oldIcon + ".png"));

                    if (!oldIconFile.Exists)
                    {
                        _itemRequiresIcon.Add(itemId);
                        continue;
                    }

                    try
                    {
                        oldIconFile.MoveTo(Path.Combine(_iconPath, newIcon + ".png"));
                        _iconMoved.Add(oldIcon);
                    } catch (Exception ex)
                    {
                        System.Diagnostics.Debugger.Break();
                    }
                } else
                {
                    _itemRequiresIcon.Add(itemId);
                }
            }
        }

        private void WriteIconDefinition()
        {
            WriteFile(_definitionPath, _newIconByItemId);
            WriteFile(_withdrawPath, _oldIconByItemId);
            WriteFile(_notFoundPath, _itemRequiresIcon);
        }

        private void WriteFile(string path, object toWrite)
        {
            DatabaseBuilder.PrintLine($"Writing {path}...");
            File.WriteAllText(path, JsonConvert.SerializeObject(toWrite));
        }

        private void Cleanup()
        {
            try
            {
                Directory.Delete(_dir128, true);
            } catch (DirectoryNotFoundException) { }
        }
    }
}