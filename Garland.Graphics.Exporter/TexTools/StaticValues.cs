using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using xivModdingFramework.General.Enums;

namespace Garland.Graphics.Exporter.TexTools
{
    public static class XivStrings
    {
        public static string Character => "Character";
        public static string Tail => "Tail";
        public static string Hair => "Hair";
        public static string Face => "Face";
        public static string Body => "Body";
    }

    public static class XivStringRaces
    {
        public static string Aura_R => "Au Ra Raen";
        public static string Aura_X => "Au Ra Xaela";
        public static string Hyur_H => "Hyur Highlander";
        public static string Hyur_M => "Hyur Midlander";

        public static string ToRaceGenderName(XivRace race)
        {
            switch (race)
            {
                case XivRace.Hyur_Midlander_Male:
                    return "Hyur Midlander Male";

                case XivRace.Hyur_Midlander_Female:
                    return "Hyur Midlander Female";

                case XivRace.Hyur_Highlander_Male:
                    return "Hyur Highlander Male";

                case XivRace.Hyur_Highlander_Female:
                    return "Hyur Highlander Female";

                case XivRace.Elezen_Male:
                    return "Elezen Male";

                case XivRace.Elezen_Female:
                    return "Elezen Female";

                case XivRace.Miqote_Male:
                    return "Miqo'te Male";

                case XivRace.Miqote_Female:
                    return "Miqo'te Female";

                case XivRace.Roegadyn_Male:
                    return "Roegadyn Male";

                case XivRace.Roegadyn_Female:
                    return "Roegadyn Female";

                case XivRace.Lalafell_Male:
                    return "Lalafell Male";

                case XivRace.Lalafell_Female:
                    return "Lalafell Female";

                case XivRace.AuRa_Male:
                    return "Au Ra Male";

                case XivRace.AuRa_Female:
                    return "Au Ra Female";

                case XivRace.All_Races:
                    return "ALL";

                case XivRace.Monster:
                    return "";

                case XivRace.Hrothgar_Male:
                    return "Hrothgar Male";

                case XivRace.Hrothgar_Female:
                    return "Hrothgar Female";

                case XivRace.Viera_Male:
                    return "Viera Male";

                case XivRace.Viera_Female:
                    return "Viera Female";

                case XivRace.DemiHuman:
                case XivRace.Hyur_Midlander_Male_NPC:
                case XivRace.Hyur_Midlander_Female_NPC:
                case XivRace.Hyur_Highlander_Male_NPC:
                case XivRace.Hyur_Highlander_Female_NPC:
                case XivRace.Elezen_Male_NPC:
                case XivRace.Elezen_Female_NPC:
                case XivRace.Miqote_Male_NPC:
                case XivRace.Miqote_Female_NPC:
                case XivRace.Lalafell_Male_NPC:
                case XivRace.Lalafell_Female_NPC:
                case XivRace.AuRa_Male_NPC:
                case XivRace.AuRa_Female_NPC:
                case XivRace.Roegadyn_Male_NPC:
                case XivRace.Roegadyn_Female_NPC:
                case XivRace.NPC_Male:
                case XivRace.NPC_Female:
                default:
                    throw new NotImplementedException();
            }
        }
    }

    public class Settings
    {
        public static Settings Default { get; } = new Settings();

        public string Skin_Color => "#FFFFFFFF";
        public string Hair_Color => "#FF603913";
        public string Iris_Color => "#FF603913";
        public string Etc_Color => "#FF603913";
        public string Default_Race => "Hyur Midlander";
        public string DX_Version = "11";
    }
}
