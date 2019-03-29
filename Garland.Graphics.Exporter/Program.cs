using ImageMagick;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using xivModdingFramework.General;
using xivModdingFramework.General.Enums;
using xivModdingFramework.Items.Categories;
using xivModdingFramework.Items.DataContainers;
using xivModdingFramework.Items.Interfaces;
using xivModdingFramework.Materials.FileTypes;
using xivModdingFramework.Models.DataContainers;
using xivModdingFramework.Models.FileTypes;
using xivModdingFramework.Models.ModelTextures;

namespace Garland.Graphics.Exporter
{
    class Program
    {
        const string GamePath = @"D:\Games\SteamApps\common\FINAL FANTASY XIV - A Realm Reborn\game\sqpack\ffxiv";
        const string RepoPath = @"E:\gtfiles\models";

        static DirectoryInfo _gameDir;
        static Obj _ttObj;
        static Gear _gear;
        static Companions _companions;
        static ExportRepository _repo;

        static void Main(string[] args)
        {
            var lang = XivLanguage.English;

            _gameDir = new DirectoryInfo(GamePath);
            _ttObj = new Obj(_gameDir);
            _gear = new Gear(_gameDir, lang);
            _companions = new Companions(_gameDir, lang);

            BatchExport();

            Console.WriteLine("Done");
            Console.ReadKey();
        }

        static void BatchExport()
        {
            _repo = new ExportRepository(Path.Combine(RepoPath, "repo"));

            // Gear
            var badGear = new HashSet<string>(new[]
            {
                "Doman Iron Hatchet", "Doman Iron Pickaxe",
                "Mammon Lucis", "Kurdalegon Lucis", "Rauni Lucis",
                "Kurdalegon Supra", "Rauni Supra",
                "SmallClothes Body", "SmallClothes Feet", "SmallClothes Legs"
            });

            var gearList = _gear.GetGearList()
                .Where(g => !badGear.Contains(g.Name));
            foreach (var item in gearList)
            {
                var primaryPath = EnsurePath(item.EquipSlotCategory.ToString(), item.ModelInfo);
                BatchExportItem(primaryPath, item, null, () => _gear.GetRacesForModels(item, item.DataFile));

                if (item.SecondaryModelInfo.ModelID != 0)
                {
                    var secondaryPath = EnsurePath(item.EquipSlotCategory.ToString(), item.SecondaryModelInfo);
                    BatchExportItem(secondaryPath, item, item.SecondaryModelInfo, () => _gear.GetRacesForModels(item, item.DataFile));
                }
            }

            // Minions
            var monsters = new XivRace[] { XivRace.Monster };
            var minionList = _companions.GetMinionList();
            foreach (var minion in minionList)
            {
                var modelKey = $"{minion.ModelInfo.ModelID}-{minion.ModelInfo.Body}-{minion.ModelInfo.Variant}";
                var path = EnsurePath("minion", modelKey);
                BatchExportItem(path, minion, null, () => monsters);
            }

            // Mounts
            var mountList = _companions.GetMountList();
            foreach (var mount in mountList)
            {
                var modelKey = $"{mount.ModelInfo.ModelID}-{mount.ModelInfo.Body}-{mount.ModelInfo.Variant}";
                var path = EnsurePath("mount", modelKey);
                BatchExportItem(path, mount, null, () => monsters);
            }
        }

        static void BatchExportItem(string path, IItemModel item, XivModelInfo secondaryModelInfo, Func<IEnumerable<XivRace>> getRaces)
        {
            if (File.Exists(path))
                return;

            WriteLine($"Exporting {item.GetType().Name} {item.Name}: {Path.GetFileNameWithoutExtension(path)}");

            var metadata = new ExportMetadata();
            metadata.Name = item.Name;

            var mdl = new Mdl(_gameDir, item.DataFile);
            var races = getRaces();
            foreach (var race in races)
            {
                var mdlData = mdl.GetMdlData(item, race, secondaryModelInfo);
                var textures = TexTools.MaterialsHelper.GetMaterials(_gameDir, item, mdlData, race);

                var set = BatchExportSet(mdlData, textures);
                set.Name = TexTools.XivStringRaces.ToRaceGenderName(race);
                metadata.Sets.Add(set);
            }

            var metadataJson = JsonConvert.SerializeObject(metadata);
            File.WriteAllText(path, metadataJson);
        }

        static ExportSetMetadata BatchExportSet(XivMdl mdlData, Dictionary<int, ModelTextureData> textures)
        {
            var set = new ExportSetMetadata();

            foreach (var meshData in mdlData.LoDList[0].MeshDataList)
            {
                var modelMetadata = new ExportModelMetadata();

                // Obj
                var objString = _ttObj.ExportObj(meshData);
                var objBytes = System.Text.Encoding.ASCII.GetBytes(objString);
                modelMetadata.Obj = _repo.Write(".obj", objBytes);

                // Textures
                var textureData = textures[meshData.MeshInfo.MaterialIndex];
                var pixelSettings = new PixelReadSettings(textureData.Width, textureData.Height, StorageType.Char, PixelMapping.RGBA);
                modelMetadata.Alpha = _repo.Write(textureData.Alpha, pixelSettings, false);
                modelMetadata.Diffuse = _repo.Write(textureData.Diffuse, pixelSettings, true);
                modelMetadata.Emissive = _repo.Write(textureData.Emissive, pixelSettings, false);
                modelMetadata.Normal = _repo.Write(textureData.Normal, pixelSettings, true);
                modelMetadata.Specular = _repo.Write(textureData.Specular, pixelSettings, false);

                set.Models.Add(modelMetadata);
            }

            return set;
        }

        static string EnsurePath(string category, XivModelInfo modelInfo)
        {
            var modelKey = modelInfo.ModelKey.ToString().Replace(", ", "-");
            return EnsurePath(category, modelKey);
        }

        static string EnsurePath(string category, string modelKey)
        {
            var categoryPath = Path.Combine(RepoPath, category);
            Directory.CreateDirectory(categoryPath);
            return Path.Combine(categoryPath, modelKey) + ".json";

        }

        static void WriteLine(string str)
        {
            Console.WriteLine(str);
            Debug.WriteLine(str);
        }
    }
}
