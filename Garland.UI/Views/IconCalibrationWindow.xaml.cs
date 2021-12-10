using Microsoft.Win32;
using System;
using System.Threading.Tasks;
using System.Windows;

using Garland.Data;
using Garland.Data.Helpers;
using System.Diagnostics;

namespace Garland.UI.Views
{
    /// <summary>
    /// Logic for IconCalibrationWindow
    /// </summary>
    public partial class IconCalibrationWindow : Window
    {
        string _itemCsvPath = Config.SupplementalPath + "Item.icon.csv";
        
        public IconCalibrationWindow()
        {
            InitializeComponent();
            ItemCsvFilePath.Text = _itemCsvPath;
        }

        private void StartCalibration(CalibrationConfig config)
        {
            var libraPath = System.IO.Path.Combine(Config.SupplementalPath, "app_data.sqlite");
            var realm = new SaintCoinach.ARealmReversed(Config.GamePath, "SaintCoinach.History.zip", SaintCoinach.Ex.Language.English, libraPath);
            DatabaseBuilder.PrintLine($"Game version: {realm.GameVersion}");
            DatabaseBuilder.PrintLine($"Definition version: {realm.DefinitionVersion}");
            var processing = Stopwatch.StartNew();

            ItemIconCalibrator itemIconCalibrator = new ItemIconCalibrator(config, realm);
            itemIconCalibrator.Calibrate();

            processing.Stop();
            DatabaseBuilder.PrintLine($"Processing elapsed: {processing.Elapsed}");
        }

        
        
        private void StartCalibration_Click(object sender, RoutedEventArgs e)
        {
            CalibrationConfig config = GatherConfig();
            Task.Run(() =>
            {
                try
                {
                    StartCalibration(config);
                }
                catch (Exception ex)
                {
                    DatabaseBuilder.PrintLine($"Unhandled exception {ex}");
                }
            });
            this.Close();
        }

        private CalibrationConfig GatherConfig()
        {
            CalibrationConfig.Source source = CalibrationConfig.Source.None;
            if (CalibrationSourceIconDefinition.IsChecked == true)
            {
                source = CalibrationConfig.Source.Definition;
            } else if (CalibrationSourceItemCsv.IsChecked == true)
            {
                source = CalibrationConfig.Source.ItemCsv;
            }
            /*
            else if (CalibrationSourceWithdraw.IsChecked == true)
            {
                source = CalibrationConfig.Source.Withdraw;
            }
            */

            return new CalibrationConfig(Reextract.IsChecked == true, 
                Icon40.IsChecked == true,
                Icon80.IsChecked == true, _itemCsvPath, source);
        }

        private void ItemCsvSelect_Click(object sender, RoutedEventArgs e)
        {
            OpenFileDialog dialog = new OpenFileDialog
            {
                Multiselect = false,
                Title = "Please select Item.icon.csv file",
                Filter = "Item.icon.csv|*.csv"
            };
            if (true.Equals(dialog.ShowDialog()))
            {
                _itemCsvPath = dialog.FileName;
                ItemCsvFilePath.Text = _itemCsvPath;
            }
        }

        private void ReextractChecked(object sender, RoutedEventArgs e)
        {
            if (Icon40 != null && Icon80 != null)
            {
                Icon40.IsEnabled = true;
                Icon40.IsChecked = true;
                Icon80.IsChecked = true;
            }
        }

        private void ReextractUnchecked(object sender, RoutedEventArgs e)
        {
            Icon40.IsEnabled = false;
            Icon80.IsEnabled = false;
            Icon40.IsChecked = false;
            Icon80.IsChecked = false;
        }
    }
}
