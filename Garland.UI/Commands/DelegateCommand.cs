using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.UI.Commands
{
    public class DelegateCommand : CommandBase
    {
        Action _target;

        public DelegateCommand(Action target)
        {
            _target = target;
        }

        public override void Execute(object parameter)
        {
            _target();
        }
    }

    public class DelegateCommand<T> : CommandBase
    {
        Action<T> _target;

        public DelegateCommand(Action<T> target)
        {
            _target = target;
        }

        public override bool CanExecute(object parameter)
        {
            return parameter == null || (parameter is T);
        }

        public override void Execute(object parameter)
        {
            _target((T)parameter);
        }
    }
}
