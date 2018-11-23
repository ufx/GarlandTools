using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Input;

namespace Garland.UI.Commands
{
    public abstract class CommandBase : ICommand
    {
        event EventHandler System.Windows.Input.ICommand.CanExecuteChanged
        {
            add { }
            remove { }
        }

        public virtual bool CanExecute(object parameter)
        {
            return true;
        }

        public abstract void Execute(object parameter);
    }
}
