using Garland.Data;
using Garland.Data.Output;
using Garland.UI.Commands;
using MySql.Data.MySqlClient;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Input;

namespace Garland.UI.ViewModels
{
    public class UpdateViewModel : ObservableBase
    {
        ObservableCollection<UpdatePackage> _updates;
        UpdatePackage _selectedUpdatePackage;
        Row _selectedRow;
        string _prettyJsonUpdated;
        string _prettyJsonOriginal;
        string _prettyJsonDiff;
        string _prettyHtmlDiff;
        string _packageSearchText;

        public void Load()
        {
            LoadUpdatePackages();

            if (_updates.Count > 0)
                SelectedUpdatePackage = _updates[0];
        }

        public void LoadUpdatePackages()
        {
            if (_updates == null)
            {
                _updates = new ObservableCollection<UpdatePackage>();
                OnPropertyChanged("UpdatePackages");
            }

            try
            {
                foreach (var path in Directory.EnumerateFiles(Config.UpdatesPath))
                {
                    if (!_updates.Any(u => u.Path == path))
                        _updates.Add(UpdatePackage.Load(path));
                }
            }
            catch (DirectoryNotFoundException)
            {
                Directory.CreateDirectory(Config.UpdatesPath);
            }
        }

        void OnSelectedRowChanged(Row row)
        {
            if (row == null)
            {
                PrettyJsonUpdated = null;
                PrettyJsonOriginal = null;
                return;
            }

            // Store pretty JSON of the updated object.
            var updatedObject = JsonConvert.DeserializeObject(row.Json);
            PrettyJsonUpdated = JsonConvert.SerializeObject(updatedObject, Formatting.Indented);

            // Retrieve the original JSON for this object.
            Task.Run(() => SqlDatabase.WithConnection(Config.ConnectionString, c => SetOriginalJsonDiff(c)));
        }

        void SetOriginalJsonDiff(MySqlConnection conn)
        {
            string json = null;
            string errorMessage = null;
            if (SelectedRow is DataJsonRow)
            {
                var sql = $"SELECT Json FROM DataJson WHERE Id = '{SelectedRow.Id}' AND Type = '{SelectedRow.Type}' AND Lang = '{SelectedRow.Lang}' ORDER BY Version DESC LIMIT 1";
                json = (string)SqlDatabase.ExecuteScalar(conn, sql);
                if (json == null)
                    errorMessage = "File does not exist.";
            }
            else if (SelectedRow is SearchRow)
            {
                var sql = $"SELECT Json FROM Search WHERE Id = '{SelectedRow.Id}' AND Type = '{SelectedRow.Type}' AND Lang = '{SelectedRow.Lang}' LIMIT 1";
                json = (string)SqlDatabase.ExecuteScalar(conn, sql);
                if (json == null)
                    errorMessage = "Search does not exist.";
            }
            else
                errorMessage = "Unsupported JSON type.";

            if (errorMessage != null)
            {
                PrettyJsonOriginal = errorMessage;
                PrettyJsonDiff = "";
                return;
            }

            // Reserialize the JSON with indentation.
            var originalObject = JsonConvert.DeserializeObject(json);
            PrettyJsonOriginal = JsonConvert.SerializeObject(originalObject, Formatting.Indented);

            // Generate a diff.
            //var diff = Utils.FormatDiff(PrettyJsonOriginal, PrettyJsonUpdated);
            PrettyHtmlDiff = Utils.FormatHtmlDiff(PrettyJsonOriginal, PrettyJsonUpdated);
        }

        public ObservableCollection<UpdatePackage> UpdatePackages
        {
            get { return _updates; }
        }

        public UpdatePackage SelectedUpdatePackage
        {
            get { return _selectedUpdatePackage; }
            set
            {
                _selectedUpdatePackage = value;
                OnPropertyChanged("SelectedUpdatePackage");
                OnPropertyChanged("SelectedUpdatePackageRows");

                if (value == null || value.Rows.Count == 0)
                    SelectedRow = null;
                else
                    SelectedRow = value.Rows.First();
            }
        }

        public IEnumerable<Garland.Data.Output.Row> SelectedUpdatePackageRows
        {
            get
            {
                if (_selectedUpdatePackage == null)
                    return null;

                if (string.IsNullOrEmpty(_packageSearchText))
                    return _selectedUpdatePackage.Rows;

                return _selectedUpdatePackage.Rows.Where(r => r.Json.Contains(_packageSearchText));
            }
        }

        public string PackageSearchText
        {
            get { return _packageSearchText; }
            set
            {
                _packageSearchText = value;
                OnPropertyChanged("SelectedUpdatePackageRows");
                // fixme: filter and change grid.
            }
        }

        public Row SelectedRow
        {
            get { return _selectedRow; }
            set
            {
                _selectedRow = value;
                OnPropertyChanged("SelectedRow");
                OnSelectedRowChanged(value);
            }
        }

        public string PrettyJsonUpdated
        {
            get { return _prettyJsonUpdated; }
            set
            {
                _prettyJsonUpdated = value;
                OnPropertyChanged("PrettyJsonUpdated");
            }
        }

        public string PrettyJsonOriginal
        {
            get { return _prettyJsonOriginal; }
            set
            {
                _prettyJsonOriginal = value;
                OnPropertyChanged("PrettyJsonOriginal");
            }
        }

        public string PrettyJsonDiff
        {
            get { return _prettyJsonDiff; }
            set
            {
                _prettyJsonDiff = value;
                OnPropertyChanged("PrettyJsonDiff");
            }
        }

        public string PrettyHtmlDiff
        {
            get { return _prettyHtmlDiff; }
            set
            {
                _prettyHtmlDiff = value;
                OnPropertyChanged("PrettyHtmlDiff");
            }
        }
    }
}
