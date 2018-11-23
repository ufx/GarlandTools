using SaintCoinach.Text.Nodes;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using SaintCoinach.Text;
using System.Text.RegularExpressions;

namespace Garland.Data
{
    public class HtmlStringFormatter : INodeVisitor<string>
    {
        private List<string> _conditionals;
        //private bool _wasHqIconEncountered = false;
        //private Regex _number = new Regex(".*?(\\d+).*?");

        private HtmlStringFormatter() { }

        public static string Convert(XivString str)
        {
            var formatter = new HtmlStringFormatter();
            return str.Accept(formatter);
        }

        public string Visit(CloseTag closeTag)
        {
            return "</span>";
        }

        public string Visit(GenericElement genericElement)
        {
            var genericText = genericElement.ToString();
            switch (genericElement.Tag)
            {
                case TagType.Split:
                    if (genericText == "<Split(<Highlight>ObjectParameter(1)</Highlight>, ,1)/>")
                        return "<span class=\"highlight\">Forename</span>";
                    else if (genericText == "<Split(<Highlight>ObjectParameter(1)</Highlight>, ,2)/>")
                        return "<span class=\"highlight\">Surname</span>";
                    else
                        throw new NotImplementedException();

                case TagType.Highlight:
                    var content = genericElement.Content.Accept(this);
                    return "<span class=\"highlight\">" + content + "</span>";

                case TagType.Sheet:
                    if (genericText == "<Sheet(Addon,9,0)/>")
                        return "<img class=\"hq-icon small\" src=\"images/hq.png\">";
                    else if (genericText.Contains("GCRank"))
                        return "[GC Rank]";
                    else if (genericText == "<Sheet(Race,PlayerParameter(71),0)/>")
                        return "[Race]";
                    else if (genericText == "<Sheet(ClassJob,PlayerParameter(68),0)/>")
                        return "[Job]";
                    else if (genericText == "<Sheet(Town,PlayerParameter(70),0)/>")
                        return "[Starting City]";
                    else if (genericText == "<Sheet(ContentFinderCondition,IntegerParameter(1),18)/>")
                        return "[Item Level]";
                    else if (genericText == "<Sheet(ContentFinderCondition,IntegerParameter(2),32)/>")
                        return "[Instance]";
                    else if (genericText.StartsWith("<Sheet(") && !genericText.Contains("PlayerParameter("))
                    {
                        var genericElementArgs = genericElement.Arguments.ToArray();
                        var sheetName = genericElementArgs[0].Accept(this);
                        var sheetKeyRaw = genericElementArgs[1].Accept(this);
                        var sheetKey = int.Parse(sheetKeyRaw.Trim());
                        var sheet = DatabaseBuilder.Instance.Realm.GameData.GetSheet(sheetName);
                        var row = sheet[sheetKey];
                        var rowIndex = int.Parse(genericElementArgs[2].Accept(this).Trim());
                        return row[rowIndex].ToString();
                    }
                    else
                        throw new NotImplementedException();

                case TagType.Clickable:
                    return string.Join("", genericElement.Arguments.Select(v => v.Accept(this)));

                case TagType.Gui:
                    if (genericText == "<Gui(54)/>")
                        return "{";
                    else if (genericText == "<Gui(55)/>")
                        return "}";
                    else
                        throw new NotImplementedException();

                case TagType.Time:
                    return "[Time]";

                case TagType.SheetEn:
                case TagType.SheetDe:
                case TagType.SheetFr:
                case TagType.SheetJa:
                    {
                        var genericElementArgs = genericElement.Arguments.ToArray();
                        var args = genericElement.Arguments.Select(a => a.Accept(this)).ToArray();
                        var sheetName = genericElementArgs[0].Accept(this);
                        var sheet = DatabaseBuilder.Instance.Realm.GameData.GetSheet(sheetName);
                        if (genericElementArgs[2] is Parameter sheetKeyParam)
                            return "[Error]";
                        var sheetKey = int.Parse(genericElementArgs[2].Accept(this).Trim());
                        var row = sheet[sheetKey];
                        return row.ToString();
                    }

                case TagType.Value:
                    return genericElement.Content.Accept(this);

                case TagType.CommandIcon:
                    return "[???]";

                default:
                    throw new NotImplementedException();
            }
        }

        public string Visit(DefaultElement defaultElement)
        {
            switch (defaultElement.Tag) {
                case TagType.Indent:
                    // Skip these - appears in names that I don't want special formatting in.
                    return "";

                case TagType.SoftHyphen:
                    return "&shy;";

                case TagType.Unknown2F:
                    // Moglin says this about naming the player "Mog<??>"
                    return "";

                case TagType.ResetTime:
                    // Mini cactpot message in quest "Scratch it Rich"
                    return "[Reset]";

                case TagType.UIForeground:
                    {
                        var data = defaultElement.Data.ToString();
                        if (data == "01") // This closes the tag.
                            return "</span>";
                        return "<span class=\"" + GetColorClass(data) + "\">";
                    }
                case TagType.UIGlow:
                    return ""; // Skip these.

                default:
                    throw new NotImplementedException();
            }
        }

        public string Visit(TopLevelParameter topLevelParameter)
        {
            return "??";
        }

        public string Visit(StaticString staticString)
        {
            return ToHtmlString(staticString.Value);
        }

        public string Visit(StaticByteArray staticByteArray)
        {
            // What are the uses?
            throw new NotImplementedException();
        }

        public string Visit(Parameter parameter)
        {
            var parameterIndex = parameter.ParameterIndex.Accept(this);

            switch (parameter.ParameterType)
            {
                case DecodeExpressionType.ObjectParameter:
                    if (parameterIndex == "1")
                        return "Forename Surname";
                    else if (parameterIndex == "55")
                        return "Companion";

                    throw new NotImplementedException();

                case DecodeExpressionType.IntegerParameter:
                    return "[#" + parameterIndex + "]";

                default:
                    throw new NotImplementedException();
            }
        }

        public string Visit(StaticInteger staticInteger)
        {
            return staticInteger.Value.ToString();
        }

        public string Visit(SwitchElement switchElement)
        {
            var cases = switchElement.Cases.Values.Select(v => v.Accept(this));
            return JoinAlternatives(cases);
        }

        public string Visit(Comparison comparison)
        {
            // These are not part of the output, so are ignored?
            throw new NotImplementedException();
        }

        public string Visit(EmptyElement emptyElement)
        {
            // What are the uses?
            throw new NotImplementedException();
        }

        public string Visit(IfElement ifElement)
        {
            var isTopIf = false;
            if (_conditionals == null)
            {
                _conditionals = new List<string>();
                isTopIf = true;
            }

            var trueValue = ifElement.TrueValue.Accept(this);
            _conditionals.Add(trueValue);

            var falseValue = ifElement.FalseValue.Accept(this);
            _conditionals.Add(falseValue);

            if (isTopIf)
            {
                var result = JoinAlternatives(_conditionals);
                _conditionals = null;
                return result;
            }

            return null;
        }

        public string Visit(OpenTag openTag)
        {
            var args = openTag.Arguments.ToArray();

            switch (openTag.Tag) {
                case TagType.Color:
                    return "<span class=\"" + GetColorClass(args[0].ToString()) + "\">";

                case SaintCoinach.Text.TagType.Emphasis:
                    return "<span class=\"emphasis\">";

                default:
                    throw new NotImplementedException();
            }
        }

        public string Visit(XivString xivString)
        {
            StringBuilder builder = new StringBuilder();
            foreach (var child in xivString.Children)
                builder.Append(child.Accept(this));
            return builder.ToString();
        }

        #region Utility
        static string ToHtmlString(string str)
        {
            return str
                .Replace(">", "&gt;")
                .Replace("<", "&lt;")
                .Replace("\r\n", "<br>");
        }

        static string GetColorClass(string color)
        {
            switch (color)
            {
                case "52258": return "highlight-green";
                case "-34022": return "highlight";
                case "-154": return "highlight-yellow";
                case "-3917469": return "highlight-purple";
                case "-12533761": return "highlight"; // [Slots Available], "The Ties that Bind" quest.
                case "-10438406": return "highlight"; // /egiglamour action Egi Glamour quest.

                // Patch 4.4 new colors.
                case "F201F8": return "highlight-green";
                case "F201FA": return "highlight-yellow";
                case "F201F4": return "highlight";
                case "F201F6": return "highlight";
                case "F20222": return "highlight";
                case "F20223": return "highlight-purple";

                default:
                    throw new NotImplementedException();
            }
        }

        static string JoinAlternatives(IEnumerable<string> values)
        {
            var distinctResults = values
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Distinct()
                .ToArray();

            if (distinctResults.Length == 1)
                return distinctResults[0];

            var alternatives = distinctResults.Select(v => "<span class=\"alternative\">" + v + "</span>");
            return "<span class=\"alternative-container\">" + string.Join("", alternatives) + "</span>";
        }

        #endregion
    }
}
