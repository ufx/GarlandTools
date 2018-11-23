using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Libra
{
    public class BNpcName
    {
        public long Key { get; set; }
        public string SGL_en { get; set; }
        public string area { get; set; }
        public string data { get; set; }
        public string Index_en { get; set; }
        public string Index_fr { get; set; }
        public string Index_de { get; set; }
        public string Index_ja { get; set; }
    }

    public class ENpcResident
    {
        public int Key { get; set; }
        public string SGL_en { get; set; }
        public string area { get; set; }
        public string data { get; set; }
        public bool has_quest { get; set; }
        public bool has_shop { get; set; }
        public bool has_condition_shop { get; set; }
        public string Index_en { get; set; }
    }

    public class ENpcResident_Quest
    {
        public int ENpcResident_Key { get; set; }
        public int Quest_Key { get; set; }
    }

    public class ENpcResident_PlaceName
    {
        public int ENpcResident_Key { get; set; }
        public int PlaceName_Key { get; set; }
        public int region { get; set; }
    }

    public class Recipe
    {
        public int Key { get; set; }
        public bool CanAutoCraft { get; set; }
        public bool CanHq { get; set; }
        public int CraftItemId { get; set; }
        public int CraftNum { get; set; }
        public int CraftType { get; set; }
        public int Level { get; set; }
        public int levelView { get; set; }
        public int levelDiff { get; set; }
        public int Element { get; set; }
        public int NeedCraftmanship { get; set; }
        public int NeedControl { get; set; }
        public int Number { get; set; }
        public int NeedStatus { get; set; }
        public int NeedEquipItem { get; set; }
        public string data { get; set; }
        public string Index_en { get; set; }
    }

    public class PlaceName
    {
        public int Key { get; set; }
        public int region { get; set; }
        public string SGL_en { get; set; }
        public string SGL_ja { get; set; }
    }

    public class Gathering
    {
        public int Key { get; set; }
        public int Item { get; set; }
        public int GatheringType { get; set; }
        public int Level { get; set; }
        public int levelView { get; set; }
        public int levelDiff { get; set; }
        public bool is_hidden { get; set; }
        public string data { get; set; }
        public int GatheringNotebookList { get; set; }
        public int GatheringItemNo { get; set; }
        public string Index_en { get; set; }
    }

    public class InstanceContent
    {
        public int Key { get; set; }
        public int Type { get; set; }
        public string Name_en { get; set; }
        public string Description_en { get; set; }
        public int LevelMin { get; set; }
        public int LevelMax { get; set; }
        public int Time { get; set; }
        public int Halfway { get; set; }
        public int RandomContentType { get; set; }
        public int Alliance { get; set; }
        public int FinderPartyCondition { get; set; }
        public int PartyMemberCount { get; set; }
        public int TankCount { get; set; }
        public int HealerCount { get; set; }
        public int AttackerCount { get; set; }
        public int RangeCount { get; set; }
        public bool DifferentiateDPS { get; set; }
        public int PartyCount { get; set; }
        public int FreeRole { get; set; }
        public int ItemLevel { get; set; }
        public int ItemLevelMax { get; set; }
        public bool Colosseum { get; set; }
        public int Area { get; set; }
        public int ForceCount { get; set; }
        public string data { get; set; }
        public bool is_koeru_usually { get; set; }
        public bool is_koeru_annihilation { get; set; }
        public string Index_en { get; set; }
    }

    public class Item
    {
        public int Key { get; set; }
        public int Category { get; set; }
        public int UICategory { get; set; }
        public string UIName_en { get; set; }
        public string Help_en { get; set; }
        public int Level { get; set; }
        public int EquipLevel { get; set; }
        public int Rarity { get; set; }
        public bool HQ { get; set; }
        public bool SpecialBonus { get; set; }
        public bool Series { get; set; }
        public int Slot { get; set; }
        public decimal Damage { get; set; }
        public decimal Damage_hq { get; set; }
        public decimal MagicDamage { get; set; }
        public decimal MagicDamage_hq { get; set; }
        public decimal Defense { get; set; }
        public decimal Defense_hq { get; set; }
        public decimal MagicDefense { get; set; }
        public decimal MagicDefense_hq { get; set; }
        public decimal ShieldRate { get; set; }
        public decimal ShieldRate_hq { get; set; }
        public decimal ShieldBlockRate { get; set; }
        public decimal ShieldBlockRate_hq { get; set; }
        public decimal AttackInterval { get; set; }
        public decimal AttackInterval_hq { get; set; }
        public decimal AutoAttack { get; set; }
        public decimal AutoAttack_hq { get; set; }
        public int Price { get; set; }
        public int PriceMin { get; set; }
        public int MirageItem { get; set; }
        public string icon { get; set; }
        public string classjob { get; set; }
        public int Salvage { get; set; }
        public string data { get; set; }
        public string Index_en { get; set; }
        public bool legacy { get; set; }
        public int SortId { get; set; }

        // Used internally
        public int iconId { get; set; }
    }

    public class Shop
    {
        public int Key { get; set; }
        public string Name_en { get; set; }
    }

    public class Quest
    {
        public int Key { get; set; }
        public int Genre { get; set; }
        public int Area { get; set; }
        public string Name_en { get; set; }
        public int CompanyPointNum { get; set; }
        public int Gil { get; set; }
        public int ExpBonus { get; set; }
        public string data { get; set; }
    }
}
