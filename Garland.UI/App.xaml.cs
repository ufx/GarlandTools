using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;

namespace Garland.UI
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            Garland.Data.Config.Load();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            base.OnExit(e);

            Settings.Default.Save();
        }
    }
}
