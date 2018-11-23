using Newtonsoft.Json.Linq;
using SaintCoinach;
using SaintCoinach.Ex;
using SaintCoinach.Text;
using SaintCoinach.Xiv;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data
{
    public class Localize
    {
        private ARealmReversed _realm;
        private readonly XivCollection _data;
        private readonly Tuple<string, Language>[] _langs;

        public Localize(ARealmReversed realm)
        {
            _realm = realm;
            _data = realm.GameData;
            _langs = new Tuple<string, Language>[]
            {
                Tuple.Create(Language.English.GetCode(), Language.English),
                Tuple.Create(Language.Japanese.GetCode(), Language.Japanese),
                Tuple.Create(Language.German.GetCode(), Language.German),
                Tuple.Create(Language.French.GetCode(), Language.French)
            };
        }

        public void Strings(JObject obj, IXivRow row, Func<XivString, string> transform, params string[] cols)
        {
            var currentLang = _data.ActiveLanguage;

            foreach (var langTuple in _langs)
            {
                var code = langTuple.Item1;
                var lang = langTuple.Item2;
                _data.ActiveLanguage = lang;

                if (!obj.TryGetValue(code, out var strs))
                    obj[code] = strs = new JObject();

                foreach (var col in cols)
                {
                    var value = row[col];
                    if (value is XivString && string.IsNullOrEmpty((XivString)value))
                        continue;

                    var sanitizedCol = col.ToLower().Replace("{", "").Replace("}", "");
                    strs[sanitizedCol] = transform == null ? (value.ToString()) : transform((XivString)value);
                }
            }

            _data.ActiveLanguage = currentLang;
        }

        public void Strings(JObject obj, IXivRow row, params string[] cols)
        {
            Strings(obj, row, null, cols);
        }

        public void HtmlStrings(JObject obj, IXivRow row, params string[] cols)
        {
            Strings(obj, row, HtmlStringFormatter.Convert, cols);
        }

        public void Column(JObject obj, IXivRow row, Func<XivString, string> transform, string fromColumn, string toColumn)
        {
            var currentLang = _data.ActiveLanguage;

            foreach (var langTuple in _langs)
            {
                var code = langTuple.Item1;
                var lang = langTuple.Item2;
                _data.ActiveLanguage = lang;

                if (!obj.TryGetValue(code, out var strs))
                    obj[code] = strs = new JObject();

                var value = row[fromColumn];
                var toValue = transform == null ? (value.ToString()) : transform((XivString)value);
                if (string.IsNullOrEmpty(toValue))
                    continue;

                strs[toColumn] = toValue;
            }

            _data.ActiveLanguage = currentLang;
        }
    }
}
