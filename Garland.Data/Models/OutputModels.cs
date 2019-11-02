using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Models
{
    public class ScriptInstruction
    {
        public int Index { get; set; }
        public string Label { get; set; }
        public UInt32 Argument { get; set; }
        public List<object> RawValues { get; set; }

        public string AllRaws
        {
            get { return string.Join(", ", RawValues.Select(o => (o ?? "{null}").ToString())); }
        }

        public static ScriptInstruction[] Read(Saint.IXivRow row, int count)
        {
            //var extraStartIndex = 142;
            //var extraEndIndex = 653;

            //var extraStartIndex2 = 654;
            //var extraEndIndex2 = 1405;

            var instructions = new ScriptInstruction[count];
            for (var i = 0; i < count; i++)
            {
                var instruction = new ScriptInstruction();
                instruction.Index = i;
                Console.WriteLine(row.GetRaw("Script{Instruction}[" + i + "]"));
                instruction.Label = (SaintCoinach.Text.XivString)row.GetRaw("Script{Instruction}[" + i + "]");
                instruction.Argument = (UInt32)row.GetRaw("Script{Arg}[" + i + "]");
                instructions[i] = instruction;

                //if (instruction.Instruction == "")
                //    continue;

                //instruction.RawValues = new List<object>();
                //for (var ii = extraStartIndex + i; ii < extraEndIndex; ii += count)
                //    instruction.RawValues.Add(quest[ii]);

                //for (var ii = extraStartIndex2 + i; ii < extraEndIndex2; ii += count)
                //    instruction.RawValues.Add(quest[ii]);
            }

            return instructions
                .Where(i => i.Label != "")
                .ToArray();
        }

        public override string ToString()
        {
            return Label + "(" + Argument + ")";
        }
    }
}
