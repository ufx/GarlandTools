using Garland.Data;
using Garland.Data.Output;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;

namespace Garland.UI
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        readonly static string[] _paths = new[] {
            @"D:\Games\SteamApps\common\FINAL FANTASY XIV - A Realm Reborn",
            @"C:\Program Files (x86)\Steam\steamapps\common\FINAL FANTASY XIV - A Realm Reborn",
            //@"D:\Games\FFXIV Alt"
        };

        IPrinter _printer;

        public MainWindow()
        {
            InitializeComponent();

            var settings = Settings.Default;
            if (settings.MainWindowWidth > 0)
                Width = Settings.Default.MainWindowWidth;
            if (settings.MainWindowHeight > 0)
                Height = Settings.Default.MainWindowHeight;
            if (settings.MainWindowLeft > 0)
                Left = Settings.Default.MainWindowLeft;
            if (settings.MainWindowTop > 0)
                Top = Settings.Default.MainWindowTop;

            _printer = new TextBoxPrinter(OutputText);
            DatabaseBuilder.Printer = _printer;

            _printer.PrintLine("---[Garland is ready to knock you down]---");
        }

        protected override void OnClosing(CancelEventArgs e)
        {
            base.OnClosing(e);

            Settings.Default.MainWindowHeight = Height;
            Settings.Default.MainWindowWidth = Width;
            Settings.Default.MainWindowLeft = Left;
            Settings.Default.MainWindowTop = Top;
        }

        #region Menu Commands

        void ConvertFiles_Click(object sender, RoutedEventArgs e)
        {
            RunAction(() => 
            {
                BuildDatabase(false);
                WriteFiles();

                DatabaseBuilder.PrintLine("Done.");

                Dispatcher.Invoke(_updateView.Model.LoadUpdatePackages);
            });
        }

        private void FetchIcons_Click(object sender, RoutedEventArgs e)
        {
            RunAction(() => BuildDatabase(true));
        }

        void ExportData_Click(object sender, RoutedEventArgs e)
        {
            RunAction(() =>
            {
                BuildDatabase(false);
                ExportFileZip();

                DatabaseBuilder.PrintLine("Done.");
            });
        }

        void DeployTestToProduction_Click(object sender, RoutedEventArgs e)
        {
            //DeployTestToProduction.IsEnabled = false;
            //DeployTestToProduction.Content = $"{DeployTestToProduction.Content} (Running)";

            Task.Run(() =>
            {
                Database.WithConnection(c =>
                {
                    _printer.PrintLine("Deploying test data to production.");

                    var sql = "REPLACE INTO DataJson (Id, Type, Lang, Version, Json) SELECT Id, Type, Lang, Version, Json FROM DataJsonTest";
                    var rowsAffected = Database.ExecuteNonQuery(c, sql);
                    _printer.PrintLine($"Deployed {rowsAffected} records.");

                    Database.ExecuteNonQuery(c, "DELETE FROM DataJsonTest");
                });
            });
        }

        #endregion

        void BuildDatabase(bool fetchIconsOnly)
        {
            var path = _paths.FirstOrDefault(p => Directory.Exists(p));
            var realm = new SaintCoinach.ARealmReversed(path, "SaintCoinach.History.zip", SaintCoinach.Ex.Language.English, "app_data.sqlite");
            var libra = new SQLite.SQLiteConnection("app_data.sqlite", SQLite.SQLiteOpenFlags.ReadOnly);
            var builder = new DatabaseBuilder(libra, realm);

            DatabaseBuilder.PrintLine($"Game version: {realm.GameVersion}");
            DatabaseBuilder.PrintLine($"Definition version: {realm.DefinitionVersion}");

            OneTimeExports.Run(realm);

            var processing = Stopwatch.StartNew();
            builder.Build(fetchIconsOnly);

            if (!fetchIconsOnly)
                SpecialOutput.Run();

            processing.Stop();
            DatabaseBuilder.PrintLine($"Processing elapsed: {processing.Elapsed}");
        }

        void RunAction(Action action)
        {
            Task.Run(() =>
            {
                try
                {
                    action();
                }
                catch (Exception ex)
                {
                    DatabaseBuilder.PrintLine($"Unhandled exception: {ex}");
                }
            });
        }

        void WriteFiles()
        {
            var writing = Stopwatch.StartNew();

            var dataUpdate = new UpdatePackage("data");
            var jsout = new JsOutput(dataUpdate);
            jsout.Write();

            // Has to be after everything else because partials are modified here.
            var searchUpdate = new UpdatePackage("search");
            var sqlout = new SearchOutput(jsout, searchUpdate);
            sqlout.Write();

            if (dataUpdate.Rows.Count > 0)
            {
                DatabaseBuilder.PrintLine($"Updating {dataUpdate.Rows.Count} data rows.");
                dataUpdate.Write();
            }

            if (searchUpdate.Rows.Count > 0)
            {
                DatabaseBuilder.PrintLine($"Updating {searchUpdate.Rows.Count} data rows.");
                searchUpdate.Write();
            }

            FileDatabase.WriteHashUpdates();

            writing.Stop();
            DatabaseBuilder.PrintLine($"Writing elapsed: {writing.Elapsed}");
        }

        void ExportFileZip()
        {
            var update = new UpdatePackage("archive") { IncludeAll = true };
            var jsout = new JsOutput(update);
            jsout.Write();

            var zip = new Ionic.Zip.ZipFile("export.zip");
            zip.UseZip64WhenSaving = Ionic.Zip.Zip64Option.Always;
            foreach (var row in update.Rows.OfType<DataJsonRow>())
            {
                var path = $"{row.Lang}\\{row.Type}\\{row.Id}.json";
                zip.AddEntry(path, row.Json, Encoding.UTF8);
            }

            zip.Save();
        }
    }
}
