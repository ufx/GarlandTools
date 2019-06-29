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
        const string ConfigPath = @"..\\..\\..\\..\\Config.json";

        static string _repoPath;
        static string _gamePath;

        static DirectoryInfo _gameDir;
        static Obj _ttObj;
        static Gear _gear;
        static Companions _companions;
        static Housing _housing;
        static ExportRepository _repo;

        static void Main(string[] args)
        {
            ReadConfig();

            var lang = XivLanguage.English;

            _gameDir = new DirectoryInfo(_gamePath);
            _ttObj = new Obj(_gameDir);
            _gear = new Gear(_gameDir, lang);
            _companions = new Companions(_gameDir, lang);
            _housing = new Housing(_gameDir, lang);

            BatchExport().Wait();

            Console.WriteLine("Done");
            Console.ReadKey();
        }

        static void ReadConfig()
        {
            var text = File.ReadAllText(ConfigPath);
            dynamic values = JsonConvert.DeserializeObject(text);
            _repoPath = Path.Combine((string)values.files, "models");
            _gamePath = Path.Combine((string)values.gamePath, @"game\sqpack\ffxiv");
        }

        static async Task BatchExport()
        {
            _repo = new ExportRepository(Path.Combine(_repoPath, "repo"));

            // Gear
            var badGear = new HashSet<string>(new[]
            {
                // ARR
                "SmallClothes Body", "SmallClothes Feet", "SmallClothes Legs",
                "Mammon Lucis", "Kurdalegon Lucis", "Rauni Lucis",
                "Kurdalegon Supra", "Rauni Supra",

                // Stormblood
                "Doman Iron Hatchet", "Doman Iron Pickaxe",

                // Shadowbringers
                "Bluespirit Hatchet", "Weathered Godhands"
            });

            var gearList = (await _gear.GetGearList())
                .Where(g => !badGear.Contains(g.Name));
            foreach (var item in gearList)
            {
                var primaryPath = EnsurePath(item.EquipSlotCategory.ToString(), item.ModelInfo);
                await BatchExportItem(primaryPath, item, null, () => _gear.GetRacesForModels(item, item.DataFile));

                if (item.SecondaryModelInfo.ModelID != 0)
                {
                    var secondaryPath = EnsurePath(item.EquipSlotCategory.ToString(), item.SecondaryModelInfo);
                    await BatchExportItem(secondaryPath, item, item.SecondaryModelInfo, () => _gear.GetRacesForModels(item, item.DataFile));
                }
            }

            var monsters = new XivRace[] { XivRace.Monster }.ToList();

            // Minions
            var minionList = await _companions.GetMinionList();
            foreach (var minion in minionList)
            {
                var modelKey = $"{minion.ModelInfo.ModelID}-{minion.ModelInfo.Body}-{minion.ModelInfo.Variant}";
                var path = EnsurePath("minion", modelKey);
                await BatchExportItem(path, minion, null, () => Task.FromResult(monsters));
            }

            // Mounts
            var mountList = await _companions.GetMountList();
            foreach (var mount in mountList)
            {
                var modelKey = $"{mount.ModelInfo.ModelID}-{mount.ModelInfo.Body}-{mount.ModelInfo.Variant}";
                var path = EnsurePath("mount", modelKey);
                await BatchExportItem(path, mount, null, () => Task.FromResult(monsters));
            }

            // Housing
            var furnitureList = await _housing.GetFurnitureList();
            foreach (var furniture in furnitureList)
            {
                var modelKey = $"{furniture.ModelInfo.ModelID}";
                var path = EnsurePath("furniture", modelKey);

                try
                {
                    await BatchExportItem(path, furniture, null, () => Task.FromResult(monsters));
                }
                catch (Exception ex)
                {
                    WriteLine($"Unable to export {furniture.Name}: {ex.Message}");
                }
            }
        }

        static async Task BatchExportItem(string path, IItemModel item, XivModelInfo secondaryModelInfo, Func<Task<List<XivRace>>> getRaces)
        {
            if (File.Exists(path))
                return;

            WriteLine($"Exporting {item.GetType().Name} {item.Name}: {Path.GetFileNameWithoutExtension(path)}");

            var metadata = new ExportMetadata();
            metadata.Name = item.Name;

            var mdl = new Mdl(_gameDir, item.DataFile);
            var races = await getRaces();
            foreach (var race in races)
            {
                var mdlData = await mdl.GetMdlData(item, race, secondaryModelInfo);
                var textures = await TexTools.MaterialsHelper.GetMaterials(_gameDir, item, mdlData, race);

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
            var categoryPath = Path.Combine(_repoPath, category);
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
