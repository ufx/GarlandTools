using Garland.Data;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Controls;

namespace Garland.UI
{
    public class TextBoxPrinter : IPrinter
    {
        TextBox _textBox;

        public TextBoxPrinter(TextBox textBox)
        {
            _textBox = textBox;
        }

        public void PrintLine(string line)
        {
            _textBox.Dispatcher.InvokeAsync(() =>
            {
                _textBox.AppendText(line + "\n");
                _textBox.ScrollToEnd();
            });
        }
    }
}
