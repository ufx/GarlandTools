using Garland.Data;
using Garland.UI.ViewModels;
using System;
using System.Collections.Generic;
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

namespace Garland.UI.Views
{
    /// <summary>
    /// Interaction logic for UpdateView.xaml
    /// </summary>
    public partial class UpdateView : UserControl
    {
        UpdateViewModel _model;
        public UpdateViewModel Model => _model;

        public UpdateView()
        {
            InitializeComponent();

            _model = new UpdateViewModel();

            Task.Run(() =>
            {
                _model.Load();
                Dispatcher.Invoke(() => DataContext = _model);
            });
        }

        private void Diff_MouseDown(object sender, MouseButtonEventArgs e)
        {
            if (string.IsNullOrEmpty(_model.PrettyHtmlDiff))
                return;

            var tmpChanged = System.IO.Path.GetTempFileName();
            File.WriteAllText(tmpChanged, _model.PrettyJsonUpdated);
            var tmpOriginal = System.IO.Path.GetTempFileName();
            File.WriteAllText(tmpOriginal, _model.PrettyJsonOriginal);

            var args = $"/e /x /s /u /wl /wr /dl Changed /dr Original {tmpChanged} {tmpOriginal}";
            var process = Process.Start(Config.DiffPath, args);

            Task.Run(() =>
            {
                if (process != null)
                    process.WaitForExit();

                File.Delete(tmpChanged);
                File.Delete(tmpOriginal);
            });
        }

        private void ChangedJson_ScrollChanged(object sender, ScrollChangedEventArgs e)
        {
            OriginalJson.ScrollToVerticalOffset(e.VerticalOffset);
            OriginalJson.ScrollToHorizontalOffset(e.HorizontalOffset);

        }

        private void OriginalJson_ScrollChanged(object sender, ScrollChangedEventArgs e)
        {
            ChangedJson.ScrollToVerticalOffset(e.VerticalOffset);
            ChangedJson.ScrollToHorizontalOffset(e.HorizontalOffset);
        }

        private void DeployPackage_Click(object sender, RoutedEventArgs e)
        {
            Task.Run(() =>
            {
                Database.WithConnection(c => _model.SelectedUpdatePackage.Run(DatabaseBuilder.Printer, c));
            });
        }

        private void DeletePackage_Click(object sender, RoutedEventArgs e)
        {
            if (_model.SelectedUpdatePackage == null)
                return;

            File.Delete(_model.SelectedUpdatePackage.Path);

            _model.UpdatePackages.Remove(_model.SelectedUpdatePackage);
            _model.SelectedUpdatePackage = _model.UpdatePackages.FirstOrDefault();
        }
    }
}
