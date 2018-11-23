using Garland.Data.Models;
using Newtonsoft.Json.Linq;
using SaintCoinach.Imaging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class NPCs : Module
    {
        Saint.IXivSheet<Saint.IXivRow> _customize;
        Saint.IXivSheet<Saint.IXivRow> _type;
        SaintCoinach.Graphics.ColorMap _colorMap;

        const int EyeColorOffset = 0;
        const int HairHighlightColorOffset = 256;
        const int DarkLipFacePaintColorOffset = 512;
        const int LightLipFacePaintColorOffset = 1792;

        public override string Name => "NPCs";

        public override void Start()
        {
            _customize = _builder.Sheet("CharaMakeCustomize");
            _type = _builder.Sheet("CharaMakeType");
            _colorMap = new SaintCoinach.Graphics.ColorMap(_builder.Realm.GameData.PackCollection.GetFile("chara/xls/charamake/human.cmp"));

            BuildSupplementalData();
            BuildAppearanceData();
        }

        void BuildSupplementalData()
        {
            var lines = Utils.Tsv("Supplemental\\FFXIV Data - NPCs.tsv");
            foreach (var line in lines.Skip(1))
            {
                var id = int.Parse(line[1]);
                var isEventNpc = int.Parse(line[2]) == 1;

                var sNpc = _builder.Realm.GameData.ENpcs[id];
                var npc = _builder.GetOrCreateNpc(sNpc);

                if (isEventNpc)
                    npc["event"] = 1;
            }
        }

        void BuildAppearanceData()
        {
            foreach (var sNpc in _builder.NpcsToImport)
            {
                var race = (Saint.Race)sNpc.Base["Race"];
                if (race == null || race.Key == 0)
                    continue;

                var npc = _builder.GetOrCreateNpc(sNpc);
                dynamic appearance = new JObject();
                npc.appearance = appearance;

                var gender = (byte)sNpc.Base["Gender"];
                var isMale = gender == 0;
                appearance.gender = isMale ? "Male" : "Female";

                appearance.race = isMale ? race.Masculine.ToString() : race.Feminine.ToString();

                var tribe = (Saint.Tribe)sNpc.Base["Tribe"];
                appearance.tribe = isMale ? tribe.Masculine.ToString() : tribe.Feminine.ToString();

                appearance.height = sNpc.Base["Height"];

                var bodyType = (byte)sNpc.Base["BodyType"];
                if (bodyType != 1)
                    appearance.bodyType = GetBodyType(bodyType);

                var type = CharaMakeTypeRow(tribe.Key, gender);

                // Faces
                var baseFace = (byte)sNpc.Base["Face"];
                var face = baseFace % 100; // Value matches the asset number, % 100 approximate face # nicely.
                appearance.face = face;

                var isValidFace = face < 8;
                var isCustomFace = baseFace > 7;
                if (isCustomFace)
                    appearance.customFace = 1;

                appearance.jaw = 1 + (byte)sNpc.Base["Jaw"];

                appearance.eyebrows = 1 + (byte)sNpc.Base["Eyebrows"];

                appearance.nose = 1 + (byte)sNpc.Base["Nose"];

                appearance.skinColor = FormatColorCoordinates((byte)sNpc.Base["SkinColor"]);
                appearance.skinColorCode = FormatColor((byte)sNpc.Base["SkinColor"], GetSkinColorMapIndex(tribe.Key, isMale));

                // Bust & Muscles - flex fields.
                if (race.Key == 5 || race.Key == 1)
                {
                    // Roegadyn & Hyur
                    appearance.muscle = (byte)sNpc.Base["BustOrTone1"];
                    if (!isMale)
                        appearance.bust = (byte)sNpc.Base["ExtraFeature2OrBust"];
                }
                else if (race.Key == 6 && isMale)
                {
                    // Au Ra male muscles
                    appearance.muscle = (byte)sNpc.Base["BustOrTone1"];
                }
                else if (!isMale)
                {
                    // Other female bust sizes
                    appearance.bust = (byte)sNpc.Base["BustOrTone1"];
                }

                // Hair & Highlights
                var hairstyle = (byte)sNpc.Base["HairStyle"];
                var hairstyleIcon = CustomizeIcon(GetHairstyleCustomizeIndex(tribe.Key, isMale), 100, hairstyle, npc);
                if (hairstyleIcon > 0)
                    appearance.hairStyle = hairstyleIcon;

                appearance.hairColor = FormatColorCoordinates((byte)sNpc.Base["HairColor"]);
                appearance.hairColorCode = FormatColor((byte)sNpc.Base["HairColor"], GetHairColorMapIndex(tribe.Key, isMale));

                var highlights = Unpack2((byte)sNpc.Base["HairHighlight"]);
                if (highlights.Item1 == 1)
                {
                    appearance.highlightColor = FormatColorCoordinates((byte)sNpc.Base["HairHighlightColor"]);
                    appearance.highlightColorCode = FormatColor((byte)sNpc.Base["HairHighlightColor"], HairHighlightColorOffset);
                }

                // Eyes & Heterochromia
                var eyeShape = Unpack2((byte)sNpc.Base["EyeShape"]);
                appearance.eyeSize = eyeShape.Item1 == 1 ? "Small" : "Large";
                appearance.eyeShape = 1 + eyeShape.Item2;

                var eyeColor = (byte)sNpc.Base["EyeColor"];
                appearance.eyeColor = FormatColorCoordinates(eyeColor);
                appearance.eyeColorCode = FormatColor(eyeColor, EyeColorOffset);

                var heterochromia = (byte)sNpc.Base["EyeHeterochromia"];
                if (heterochromia != eyeColor)
                {
                    appearance.heterochromia = FormatColorCoordinates(heterochromia);
                    appearance.heterochromiaCode = FormatColor(heterochromia, EyeColorOffset);
                }

                // Mouth & Lips
                var mouth = Unpack2((byte)sNpc.Base["Mouth"]);
                appearance.mouth = 1 + mouth.Item2;

                if (mouth.Item1 == 1)
                {
                    var lipColor = Unpack2((byte)sNpc.Base["LipColor"]);
                    appearance.lipShade = lipColor.Item1 == 1 ? "Light" : "Dark";
                    appearance.lipColor = FormatColorCoordinates(lipColor.Item2);
                    appearance.lipColorCode = FormatColor(lipColor.Item2, lipColor.Item1 == 1 ? LightLipFacePaintColorOffset : DarkLipFacePaintColorOffset);
                }

                // Extra Features
                var extraFeatureName = ExtraFeatureName(race.Key);
                if (extraFeatureName != null)
                {
                    appearance.extraFeatureName = extraFeatureName;

                    appearance.extraFeatureShape = (byte)sNpc.Base["ExtraFeature1"];
                    appearance.extraFeatureSize = (byte)sNpc.Base["ExtraFeature2OrBust"];
                }

                // Facepaint
                var facepaint = Unpack2((byte)sNpc.Base["FacePaint"]);
                var facepaintIcon = CustomizeIcon(GetFacePaintCustomizeIndex(tribe.Key, isMale), 50, facepaint.Item2, npc);
                if (facepaintIcon > 0)
                {
                    appearance.facepaint = facepaintIcon;

                    if (facepaint.Item1 == 1)
                        appearance.facepaintReverse = 1;

                    var facepaintColor = Unpack2((byte)sNpc.Base["FacePaintColor"]);
                    appearance.facepaintShade = facepaintColor.Item1 == 1 ? "Light" : "Dark";
                    appearance.facepaintColor = FormatColorCoordinates(facepaintColor.Item2);
                    appearance.facepaintColorCode = FormatColor(facepaintColor.Item2, facepaintColor.Item1 == 1 ? LightLipFacePaintColorOffset : DarkLipFacePaintColorOffset);
                }

                // Facial Features
                var facialfeature = (byte)sNpc.Base["FacialFeature"];
                if (facialfeature != 0 && isValidFace)
                {
                    appearance.facialfeatures = new JArray();

                    // There are only 7 groups of facial features at the moment.
                    var facialfeatures = new System.Collections.BitArray(new byte[] { facialfeature });
                    for (var i = 0; i < 7; i++)
                    {
                        if (!facialfeatures[i])
                            continue;

                        // Columns are split into groups of 6, 1 for each face type.
                        var iconIndex = (i * 6) + face - 1;
                        var icon = (ImageFile)type["FacialFeatureIcon[" + iconIndex + "]"];
                        appearance.facialfeatures.Add(IconDatabase.EnsureEntry("customize", icon));
                    }

                    appearance.facialfeatureColor = FormatColorCoordinates((byte)sNpc.Base["FacialFeatureColor"]);
                    appearance.facialfeatureColorCode = FormatColor((byte)sNpc.Base["FacialFeatureColor"], 0);
                }

                // todo: CharaMakeType ExtraFeatureData for faces, extra feature icons.
            }
        }

        Saint.IXivRow CharaMakeTypeRow(int tribeKey, byte gender)
        {
            foreach (var row in _type)
            {
                var tribe = (Saint.Tribe)row["Tribe"];
                if (tribe.Key == tribeKey && (sbyte)row["Gender"] == gender)
                    return row;
            }

            throw new NotImplementedException();
        }

        static string ExtraFeatureName(int raceKey)
        {
            switch (raceKey)
            {
                case 1: // Hyur
                case 5: // Roegadyn
                    return null;

                case 2: // Elezen
                case 3: // Lalafell
                    return "Ears";

                case 4: // Miqo'te
                case 6: // Au Ra
                    return "Tail";
            }

            throw new NotImplementedException();
        }

        static Tuple<byte, byte> Unpack2(byte value)
        {
            if (value >= 128)
                return Tuple.Create((byte)1, (byte)(value - 128));
            else
                return Tuple.Create((byte)0, value);
        }

        int CustomizeIcon(int startIndex, int length, byte dataKey, dynamic npc)
        {
            if (dataKey == 0)
                return 0; // Custom or not specified.

            for (var i = 1; i < length; i++)
            {
                var row = _customize[startIndex + i];
                if ((byte)row[0] == dataKey)
                {
                    var icon = (ImageFile)row["Icon"];
                    return IconDatabase.EnsureEntry("customize", icon);
                }
            }

            //System.Diagnostics.Debug.WriteLine("{0} has custom hair {1}", (string)npc.name, hairstyle);
            return 0; // Not found - custom.
        }

        static int GetSkinColorMapIndex(int tribeKey, bool isMale)
        {
            switch (tribeKey)
            {
                case 1: // Midlander
                    return isMale ? 3328 : 4608;
                case 2: // Highlander
                    return isMale ? 5888 : 7168;
                case 3: // Wildwood
                    return isMale ? 8448 : 9728;
                case 4: // Duskwight
                    return isMale ? 11008 : 12288;
                case 5: // Plainsfolks
                    return isMale ? 13568 : 14848;
                case 6: // Dunesfolk
                    return isMale ? 16128 : 17408;
                case 7: // Seeker of the Sun
                    return isMale ? 18688 : 19968;
                case 8: // Keeper of the Moon
                    return isMale ? 21248 : 22528;
                case 9: // Sea Wolf
                    return isMale ? 23808 : 25088;
                case 10: // Hellsguard
                    return isMale ? 26368 : 27648;
                case 11: // Raen
                    return isMale ? 28928 : 30208;
                case 12: // Xaela
                    return isMale ? 31488 : 32768;
            }

            throw new NotImplementedException();
        }

        static int GetHairColorMapIndex(int tribeKey, bool isMale)
        {
            switch (tribeKey)
            {
                case 1: // Midlander
                    return isMale ? 3584 : 4864;
                case 2: // Highlander
                    return isMale ? 6144 : 7424;
                case 3: // Wildwood
                    return isMale ? 8704 : 9984;
                case 4: // Duskwight
                    return isMale ? 11264 : 12544;
                case 5: // Plainsfolks
                    return isMale ? 13824 : 15104;
                case 6: // Dunesfolk
                    return isMale ? 16384 : 17664;
                case 7: // Seeker of the Sun
                    return isMale ? 18944 : 20224;
                case 8: // Keeper of the Moon
                    return isMale ? 21504 : 22784;
                case 9: // Sea Wolf
                    return isMale ? 24064 : 25344;
                case 10: // Hellsguard
                    return isMale ? 26624 : 27904;
                case 11: // Raen
                    return isMale ? 29184 : 30464;
                case 12: // Xaela
                    return isMale ? 31744 : 33024;
            }

            throw new NotImplementedException();
        }

        static int GetHairstyleCustomizeIndex(int tribeKey, bool isMale)
        {
            switch (tribeKey)
            {
                case 1: // Midlander
                    return isMale ? 0 : 100;
                case 2: // Highlander
                    return isMale ? 200 : 300;
                case 3: // Wildwood
                case 4: // Duskwight
                    return isMale ? 400 : 500;
                case 5: // Plainsfolks
                case 6: // Dunesfolk
                    return isMale ? 600 : 700;
                case 7: // Seeker of the Sun
                case 8: // Keeper of the Moon
                    return isMale ? 800 : 900;
                case 9: // Sea Wolf
                case 10: // Hellsguard
                    return isMale ? 1000 : 1100;
                case 11: // Raen
                case 12: // Xaela
                    return isMale ? 1200 : 1300;
            }

            throw new NotImplementedException();
        }

        static int GetFacePaintCustomizeIndex(int tribeKey, bool isMale)
        {
            switch (tribeKey)
            {
                case 1: // Midlander
                    return isMale ? 1400 : 1450;
                case 2: // Highlander
                    return isMale ? 1500 : 1550;
                case 3: // Wildwood
                    return isMale ? 1600 : 1650;
                case 4: // Duskwight
                    return isMale ? 1700 : 1750;
                case 5: // Plainsfolks
                    return isMale ? 1800 : 1850;
                case 6: // Dunesfolk
                    return isMale ? 1900 : 1950;
                case 7: // Seeker of the Sun
                    return isMale ? 2000 : 2050;
                case 8: // Keeper of the Moon
                    return isMale ? 2100 : 2150;
                case 9: // Sea Wolf
                    return isMale ? 2200 : 2250;
                case 10: // Hellsguard
                    return isMale ? 2300 : 2350;
                case 11: // Raen
                    return isMale ? 2400 : 2450;
                case 12: // Xaela
                    return isMale ? 2500 : 2550;
            }

            throw new NotImplementedException();
        }

        static string GetBodyType (byte type)
        {
            switch (type)
            {
                case 3: return "Elderly";
                case 4: return "Child";
                default:
                    throw new ArgumentException("Invalid body type " + type, "type");
            }
        }

        static string FormatColorCoordinates(byte color)
        {
            var row = 1 + (color / 8);
            var column = 1 + (color % 8);
            return $"{row}, {column}";
        }

        string FormatColor(byte colorIndex, int offset)
        {
            var c = _colorMap.Colors[offset + colorIndex];
            return $"#{c.R.ToString("X2")}{c.G.ToString("X2")}{c.B.ToString("X2")}";
        }
    }
}
