using SaintCoinach;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Modules
{
    public abstract class Module
    {
        protected DatabaseBuilder _builder;

        protected Module ()
        {
            _builder = DatabaseBuilder.Instance;
        }

        public abstract string Name { get; }

        public abstract void Start();
    }
}
