using Newtonsoft.Json;
using SaintCoinach;
using Saint = SaintCoinach.Xiv;
using System;
using System.Collections.Generic;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Text;
using SaintCoinach.Graphics.Exports;

namespace Garland.Data
{
    public class OneTimeExports
    {
        public static void Run(ARealmReversed realm)
        {
            //new RenderCapture(realm).Run();
            //ModelCapture(realm);
            //MonsterImageCapture(realm);

            //Stop();
        }

        private static void MonsterImageCapture(ARealmReversed realm)
        {
            var sMonsters = realm.GameData.GetSheet<Saint.ModelChara>()
                .Where(m => m.Type == 3)
                .ToArray();

            var sRat = sMonsters[0];
            var result = sRat.GetModelDefinition();
            var modelDef = result.Item1;
            var variant = result.Item2;
            var model = modelDef.GetModel(SaintCoinach.Graphics.ModelQuality.High);

            var export = SaintCoinach.Graphics.Exports.ModelExport.AsObj(model, variant);
            var errors = export.GetErrors();
            DatabaseBuilder.PrintLine("Export errors: " + errors);

            WriteExport(export);

            //var source = new SaintCoinach.Graphics.Viewer.RendererSources.MonsterImageRendererSource(sMonsters);
            //var renderer = new SaintCoinach.Graphics.Viewer.ImageRenderer(source, 800, 600);
            //renderer.Run();
        }

        static void WriteExport(ModelExport sExport)
        {
            var repo = new Models.ExportHashRepository("ModelExports");

            var metadata = new Models.ExportMetadata();
            metadata.Name = "test model";

            var set = new Models.ExportSetMetadata();
            metadata.Sets.Add(set);

            set.Name = "test set";
            
            foreach (var mesh in sExport.Meshes)
            {
                var model = new Models.ExportModelMetadata();
                model.Alpha = repo.Write(mesh.Alpha);
                model.Diffuse = repo.Write(mesh.Diffuse);
                model.Emissive = repo.Write(mesh.Emissive);
                model.Normal = repo.Write(mesh.Normal);
                model.Obj = repo.Write(".obj", mesh.Bytes);
                model.Specular = repo.Write(mesh.Specular);
                set.Models.Add(model);
            }

            var json = JsonConvert.SerializeObject(metadata, Formatting.Indented);
            File.WriteAllText("ModelExports\\metadata.json", json);
        }

        private static void ModelCapture(ARealmReversed realm)
        {
            //var model = modelDef.GetModel(SaintCoinach.Graphics.ModelQuality.High);

            //var export = SaintCoinach.Graphics.Exports.ModelExport.AsObj(model, variant);

        }

        public static void Stop()
        {
            DatabaseBuilder.PrintLine("One time exports done");
            Console.ReadLine();
            Environment.Exit(0);
        }
    }
}
