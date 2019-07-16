using SharpDX;
using System;
using System.Collections.Generic;
using System.Text;
using System.IO;
using System.Linq;
using xivModdingFramework.General.Enums;
using xivModdingFramework.Items.DataContainers;
using xivModdingFramework.Items.Interfaces;
using xivModdingFramework.Materials.DataContainers;
using xivModdingFramework.Materials.FileTypes;
using xivModdingFramework.Models.DataContainers;
using xivModdingFramework.Models.ModelTextures;
using Color = SharpDX.Color;
//using ColorConverter = System.Windows.Media.ColorConverter;
//using WinColor = System.Windows.Media.Color;
using System.Threading.Tasks;

namespace Garland.Graphics.Exporter.TexTools
{
    public static class MaterialsHelper
    {
        /// <summary>
        /// Gets the materials for the model
        /// </summary>
        /// <returns>A dictionary containing the mesh number(key) and the associated texture data (value)</returns>
        public static async Task<Dictionary<int, ModelTextureData>> GetMaterials(
            DirectoryInfo _gameDirectory, IItemModel _item, XivMdl _mdlData, XivRace race)
        {
            var textureDataDictionary = new Dictionary<int, ModelTextureData>();
            var mtrlDictionary = new Dictionary<int, XivMtrl>();
            var mtrl = new Mtrl(_gameDirectory, _item.DataFile, GetLanguage());
            var mtrlFilePaths = _mdlData.PathData.MaterialList;
            var hasColorChangeShader = false;
            Color? customColor = null;
            WinColor winColor;

            //var race = SelectedRace.XivRace;

            var materialNum = 0;
            foreach (var mtrlFilePath in mtrlFilePaths)
            {
                var mtrlItem = new XivGenericItemModel
                {
                    Category = _item.Category,
                    ItemCategory = _item.ItemCategory,
                    ItemSubCategory = _item.ItemSubCategory,
                    ModelInfo = new XivModelInfo
                    {
                        Body = _item.ModelInfo.Body,
                        ModelID = _item.ModelInfo.ModelID,
                        ModelType = _item.ModelInfo.ModelType,
                        Variant = _item.ModelInfo.Variant
                    },
                    Name = _item.Name
                };

                var modelID = mtrlItem.ModelInfo.ModelID;
                var bodyID = mtrlItem.ModelInfo.Body;
                var filePath = mtrlFilePath;

                if (!filePath.Contains("hou") && mtrlFilePath.Count(x => x == '/') > 1)
                {
                    filePath = mtrlFilePath.Substring(mtrlFilePath.LastIndexOf("/"));
                }

                var typeChar = $"{mtrlFilePath[4]}{mtrlFilePath[9]}";

                var raceString = "";
                switch (typeChar)
                {
                    // Character Body
                    case "cb":
                        var body = mtrlFilePath.Substring(mtrlFilePath.IndexOf("b") + 1, 4);
                        raceString = mtrlFilePath.Substring(mtrlFilePath.IndexOf("c") + 1, 4);
                        race = XivRaces.GetXivRace(raceString);

                        if (!raceString.Equals("0901") && !raceString.Equals("1001") && !raceString.Equals("1101"))
                        {
                            var gender = 0;
                            if (int.Parse(raceString.Substring(0, 2)) % 2 == 0)
                            {
                                gender = 1;
                            }

                            var settingsRace = GetSettingsRace(gender);

                            race = settingsRace.Race;

                            filePath = mtrlFilePath.Replace(raceString, race.GetRaceCode()).Replace(body, settingsRace.BodyID);

                            body = settingsRace.BodyID;
                        }


                        mtrlItem = new XivGenericItemModel
                        {
                            Category = XivStrings.Character,
                            ItemCategory = XivStrings.Body,
                            Name = XivStrings.Body,
                            ModelInfo = new XivModelInfo
                            {
                                Body = int.Parse(body)
                            }
                        };

                        winColor = (WinColor)ColorConverter.ConvertFromString(Settings.Default.Skin_Color);
                        customColor = new Color(winColor.R, winColor.G, winColor.B, winColor.A);

                        break;
                    // Face
                    case "cf":
                        bodyID = int.Parse(mtrlFilePath.Substring(mtrlFilePath.IndexOf("f") + 1, 4));
                        raceString = mtrlFilePath.Substring(mtrlFilePath.IndexOf("c") + 1, 4);
                        race = XivRaces.GetXivRace(raceString);

                        mtrlItem = new XivGenericItemModel
                        {
                            Category = XivStrings.Character,
                            ItemCategory = XivStrings.Face,
                            Name = XivStrings.Face,
                            ModelInfo = new XivModelInfo
                            {
                                Body = bodyID
                            }
                        };

                        break;
                    // Hair
                    case "ch":
                        bodyID = int.Parse(mtrlFilePath.Substring(mtrlFilePath.IndexOf("h") + 1, 4));
                        raceString = mtrlFilePath.Substring(mtrlFilePath.IndexOf("c") + 1, 4);
                        race = XivRaces.GetXivRace(raceString);

                        mtrlItem = new XivGenericItemModel
                        {
                            Category = XivStrings.Character,
                            ItemCategory = XivStrings.Hair,
                            Name = XivStrings.Hair,
                            ModelInfo = new XivModelInfo
                            {
                                Body = bodyID
                            }
                        };

                        winColor = (WinColor)ColorConverter.ConvertFromString(Settings.Default.Hair_Color);
                        customColor = new Color(winColor.R, winColor.G, winColor.B, winColor.A);

                        break;
                    // Tail
                    case "ct":
                        var tempPath = mtrlFilePath.Substring(4);
                        bodyID = int.Parse(tempPath.Substring(tempPath.IndexOf("t") + 1, 4));
                        raceString = mtrlFilePath.Substring(mtrlFilePath.IndexOf("c") + 1, 4);
                        race = XivRaces.GetXivRace(raceString);

                        mtrlItem = new XivGenericItemModel
                        {
                            Category = XivStrings.Character,
                            ItemCategory = XivStrings.Tail,
                            Name = XivStrings.Tail,
                            ModelInfo = new XivModelInfo
                            {
                                Body = bodyID
                            }
                        };

                        winColor = (WinColor)ColorConverter.ConvertFromString(Settings.Default.Hair_Color);
                        customColor = new Color(winColor.R, winColor.G, winColor.B, winColor.A);

                        break;
                    // Equipment
                    case "ce":
                        modelID = int.Parse(mtrlFilePath.Substring(mtrlFilePath.IndexOf("e") + 1, 4));
                        raceString = mtrlFilePath.Substring(mtrlFilePath.IndexOf("c") + 1, 4);
                        race = XivRaces.GetXivRace(raceString);

                        mtrlItem.ModelInfo.ModelID = modelID;
                        break;
                    // Accessory
                    case "ca":
                        modelID = int.Parse(mtrlFilePath.Substring(mtrlFilePath.IndexOf("a") + 1, 4));
                        raceString = mtrlFilePath.Substring(mtrlFilePath.IndexOf("c") + 1, 4);
                        race = XivRaces.GetXivRace(raceString);

                        mtrlItem.ModelInfo.ModelID = modelID;
                        break;
                    // Weapon
                    case "wb":
                        modelID = int.Parse(mtrlFilePath.Substring(mtrlFilePath.IndexOf("w") + 1, 4));
                        bodyID = int.Parse(mtrlFilePath.Substring(mtrlFilePath.IndexOf("b") + 1, 4));
                        mtrlItem.ModelInfo.ModelID = modelID;
                        mtrlItem.ModelInfo.Body = bodyID;
                        break;
                    // Monster
                    case "mb":
                        modelID = int.Parse(mtrlFilePath.Substring(mtrlFilePath.IndexOf("_m") + 2, 4));
                        bodyID = int.Parse(mtrlFilePath.Substring(mtrlFilePath.IndexOf("b") + 1, 4));
                        mtrlItem.ModelInfo.ModelID = modelID;
                        mtrlItem.ModelInfo.Body = bodyID;
                        break;
                    // DemiHuman
                    case "de":
                        modelID = int.Parse(mtrlFilePath.Substring(mtrlFilePath.IndexOf("d") + 1, 4));
                        bodyID = int.Parse(mtrlFilePath.Substring(mtrlFilePath.IndexOf("e") + 1, 4));
                        mtrlItem.ModelInfo.ModelID = modelID;
                        mtrlItem.ModelInfo.Body = bodyID;
                        break;
                    default:
                        break;
                }

                var dxVersion = int.Parse(Settings.Default.DX_Version);

                var mtrlData = await mtrl.GetMtrlData(mtrlItem, race, filePath.Remove(0, 1), dxVersion);

                if (mtrlData.Shader.Contains("colorchange"))
                {
                    hasColorChangeShader = true;
                }

                mtrlDictionary.Add(materialNum, mtrlData);

                materialNum++;
            }

            foreach (var xivMtrl in mtrlDictionary)
            {
                var modelTexture = new ModelTexture(_gameDirectory, xivMtrl.Value);

                if (hasColorChangeShader)
                {
                    var modelMaps = await modelTexture.GetModelMaps(null, true);

                    textureDataDictionary.Add(xivMtrl.Key, modelMaps);
                }
                else
                {
                    if (_item.ItemCategory.Equals(XivStrings.Face))
                    {
                        var path = xivMtrl.Value.MTRLPath;

                        if (path.Contains("_iri_"))
                        {
                            winColor = (WinColor)ColorConverter.ConvertFromString(Settings.Default.Iris_Color);
                        }
                        else if (path.Contains("_etc_"))
                        {
                            winColor = (WinColor)ColorConverter.ConvertFromString(Settings.Default.Etc_Color);
                        }
                        else
                        {
                            winColor = (WinColor)ColorConverter.ConvertFromString(Settings.Default.Skin_Color);
                        }

                        customColor = new Color(winColor.R, winColor.G, winColor.B, winColor.A);
                    }

                    var modelMaps = await modelTexture.GetModelMaps(customColor);

                    textureDataDictionary.Add(xivMtrl.Key, modelMaps);
                }
            }

            return textureDataDictionary;
        }

        private static XivLanguage GetLanguage()
        {
            return XivLanguage.English;
        }

        private static (XivRace Race, string BodyID) GetSettingsRace(int gender)
        {
            var settingsRace = Settings.Default.Default_Race;
            var defaultBody = "0001";

            if (settingsRace.Equals(XivStringRaces.Hyur_M))
            {
                if (gender == 0)
                {
                    return (XivRaces.GetXivRace("0101"), defaultBody);
                }
            }

            if (settingsRace.Equals(XivStringRaces.Hyur_H))
            {
                if (gender == 0)
                {
                    return (XivRaces.GetXivRace("0301"), defaultBody);
                }

                return (XivRaces.GetXivRace("0401"), defaultBody);
            }

            if (settingsRace.Equals(XivStringRaces.Aura_R))
            {
                if (gender == 0)
                {
                    return (XivRaces.GetXivRace("1301"), defaultBody);
                }

                return (XivRaces.GetXivRace("1401"), defaultBody);
            }

            if (settingsRace.Equals(XivStringRaces.Aura_X))
            {
                if (gender == 0)
                {
                    return (XivRaces.GetXivRace("1301"), "0101");
                }

                return (XivRaces.GetXivRace("1401"), "0101");
            }

            return (XivRaces.GetXivRace("0201"), defaultBody);
        }
    }
}
