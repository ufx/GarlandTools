using Garland.UI.External;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.UI
{
    public static class Utils
    {
        static readonly string[] _htmlLineSeparator = new string[] { "<br>" };
        const string _startMarker = "<span class=\"start-marker\"></span>";
        const string _endMarker = "<span class=\"end-marker\"></span>";

        public static string FormatHtmlDiff(string original, string updated)
        {
            var diffAlg = new Garland.UI.External.diff_match_patch();
            var diffs = diffAlg.diff_lineModeCustom(original, updated, DateTime.MaxValue);
            diffAlg.diff_cleanupSemantic(diffs);

            if (diffs.Count <= 1)
                return WrapHtmlDiff("Files are identical.");

            var html = new StringBuilder();
            foreach (var aDiff in diffs)
            {
                string text = aDiff.text
                    .Replace("&", "&amp;")
                    .Replace("<", "&lt;")
                    .Replace(">", "&gt;")
                    .Replace("\r\n", "<br>");

                if (string.IsNullOrEmpty(text))
                    continue;

                switch (aDiff.operation)
                {
                    case Operation.INSERT:
                        html.Append(_startMarker)
                            .Append("<ins>")
                            .Append(text)
                            .Append("</ins>")
                            .Append(_endMarker);
                        break;
                    case Operation.DELETE:
                        html.Append(_startMarker)
                            .Append("<del>")
                            .Append(text)
                            .Append("</del>")
                            .Append(_endMarker);
                        break;
                    case Operation.EQUAL:
                        html.Append(text);
                        break;
                }
            }

            return WrapHtmlDiff(CutNoncontextualLines(html.ToString()));
        }

        static string CutNoncontextualLines(string html)
        {
            const int contextLines = 6;
            var allLines = html.Split(_htmlLineSeparator, StringSplitOptions.RemoveEmptyEntries);

            // First mark all line indexes of interest.
            var startCount = 0;
            var indexesOfInterest = new bool[allLines.Length];
            for (var i = 0; i < allLines.Length; i++)
            {
                var line = allLines[i];

                var starts = Occurrences(_startMarker, line);
                var ends = Occurrences(_endMarker, line);
                var diff = starts - ends;

                if (startCount == 0 && (starts > 0 || ends > 0))
                {
                    for (var ii = Math.Max(0, i - contextLines); ii < i; ii++)
                        indexesOfInterest[ii] = true;
                    indexesOfInterest[i] = true;
                }

                if (startCount > 0)
                    indexesOfInterest[i] = true;

                startCount += diff;

                if (startCount == 0 && (starts > 0 || ends > 0))
                {
                    for (var ii = i + 1; ii < i + contextLines && ii < allLines.Length; ii++)
                        indexesOfInterest[ii] = true;
                }
            }

            // Next spread indexes of interest if they're within contextLines.
            var lastInterestingIndex = int.MinValue;
            for (var i = 0; i < indexesOfInterest.Length; i++)
            {
                if (indexesOfInterest[i])
                {
                    lastInterestingIndex = i;
                    continue;
                }

                if (i - lastInterestingIndex <= contextLines)
                {
                    var maxSpan = Math.Min(indexesOfInterest.Length, i + contextLines);
                    for (var ii = i + 1; ii < maxSpan; ii++)
                    {
                        if (indexesOfInterest[ii])
                        {
                            indexesOfInterest[i] = true;
                            lastInterestingIndex = i;
                            break;
                        }
                    }
                }
            }

            // Finally display all interesting lines.
            var lines = new List<string>();
            var minLineIndex = 0;
            var showingLines = false;
            var blockStartIndex = 0;
            for (var i = 0; i < indexesOfInterest.Length; i++)
            {
                if (indexesOfInterest[i])
                {
                    if (!showingLines)
                    {
                        blockStartIndex = lines.Count;
                        showingLines = true;
                        minLineIndex = i;
                    }

                    lines.Add(allLines[i]);
                }
                else
                {
                    if (showingLines)
                    {
                        lines[blockStartIndex] = $"<div class=\"line-marker\">Lines {minLineIndex + 1}-{i + 1}</div>" + lines[blockStartIndex];
                        lines.Add("<hr>");
                        showingLines = false;
                    }
                }
            }

            // Clean it up and format into a single string.
            if (lines.Count == 0)
                return "";

            lines.RemoveAt(lines.Count - 1);
            return string.Join(_htmlLineSeparator[0], lines);
        }

        static int Occurrences(string substring, string source)
        {
            int count = 0, n = 0;

            while ((n = source.IndexOf(substring, n, StringComparison.InvariantCulture)) != -1)
            {
                n += substring.Length;
                ++count;
            }

            return count;
        }

        static string WrapHtmlDiff(string diff)
        {
            return $@"
<html>
<head>
<meta charset=""UTF-8"">
<style>
    ins {{ background: #00E077; text-decoration: none; }}
    del {{ background: #ffe6e6; }}
    hr {{ width: 95%; color: #dedede; margin: 0; }}
    .start-marker {{ position: absolute; left: 0; width: 100%; }}
    .end-marker {{ position: absolute; left: 0; width: 100%; text-align: right; }}
    .line-marker {{ text-align: right; }}
</style>
</head>
<body style=""margin: 0;"">
<pre style=""font-family: Consolas; font-size: 12px;"">
{diff}
</pre>
</body>
</html>";
        }

        public static string FormatDiff(string original, string updated)
        {
            var lineDelimiter = new string[] { "\r\n" };

            var sb = new StringBuilder();
            var diffAlgorithm = new Garland.UI.External.diff_match_patch();
            //var diffList = diffAlgorithm.diff_main(original, updated);
            var diffList = diffAlgorithm.diff_lineModeCustom(original, updated, DateTime.MaxValue);
            diffAlgorithm.diff_cleanupSemantic(diffList);

            var diffs = diffList.ToArray();
            var hunks = new List<string>();
            for (var i = 0; i < diffs.Length; i++)
            {
                var diff = diffs[i];
                if (diff.operation == External.Operation.EQUAL)
                    continue;

                var isFirst = sb.Length == 0;

                var prevDiff = diffs[i - 1];
                var prevDiffLines = prevDiff.text.TrimEnd().Split(lineDelimiter, StringSplitOptions.None);

                var nextDiff = diffs[i + 1];
                var nextDiffLines = nextDiff.text.Split(lineDelimiter, StringSplitOptions.None);

                var prefix = diff.operation == External.Operation.DELETE ? "- " : "+ ";
                var textLines = diff.text.TrimEnd().Split(lineDelimiter, StringSplitOptions.None);

                if (prevDiff.operation == External.Operation.EQUAL)
                    sb.AppendLine(string.Join("\r\n", prevDiffLines.Reverse().Take(3).Reverse().Select(l => "  " + l)));

                sb.AppendLine(string.Join("\r\n", textLines.Select(l => prefix + l)));

                if (nextDiff.operation == External.Operation.EQUAL)
                {
                    sb.AppendLine(string.Join("\r\n", nextDiffLines.Take(3).Select(l => "  " + l)));
                    hunks.Add(sb.ToString());
                    sb.Clear();
                }
            }

            if (sb.Length > 0)
                hunks.Add(sb.ToString());
            return string.Join("========================================\r\n", hunks);
        }
    }
}
