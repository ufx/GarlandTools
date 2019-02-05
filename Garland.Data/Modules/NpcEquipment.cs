using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class NpcEquipment : Module
    {
        Saint.Collections.EquipSlotCollection _slots;
        Dictionary<Saint.EquipSlot, Dictionary<Saint.Quad, Saint.Items.Equipment>> _equipmentBySlotByModelKey
            = new Dictionary<Saint.EquipSlot, Dictionary<Saint.Quad, Saint.Items.Equipment>>();
        ItemSourceComplexity _complexity;

        public NpcEquipment(ItemSourceComplexity complexity)
        {
            _complexity = complexity;
        }

        public override string Name => "NPC Equipment";

        public override void Start()
        {
            Index();

            foreach (var sNpc in _builder.NpcsToImport)
            {
                var sRace = (Saint.Race)sNpc.Base["Race"];
                if (sRace == null || sRace.Key == 0)
                    continue; // Filter out demihuman NPCs.

                var sNpcEquip = (Saint.XivRow)sNpc.Base["NpcEquip"];
                var modelKeys = GetModelKeys(sNpcEquip, sNpc.Base);
                if (modelKeys.Count == 0)
                    continue;

                var npc = _builder.GetOrCreateNpc(sNpc);
                npc.equipment = new JArray();

                foreach (var pair in modelKeys)
                {
                    var slot = pair.Key;
                    var modelData = pair.Value;

                    dynamic obj = new JObject();
                    obj.slot = EquipSlotToEquipSlotCategoryKey(slot);
                    obj.model = modelData.Key.ToString().Replace(", ", "-");

                    var match = Match(slot, modelData.Key);
                    var equipment = match.Item1;
                    var uncertainty = match.Item2;
                    if (equipment != null)
                    {
                        obj.id = equipment.Key;
                        if (modelData.Stain.Key > 0)
                            obj.dye = modelData.Stain.Key;
                        if (uncertainty > 0)
                            obj.uncertainty = uncertainty;

                        _builder.Db.AddReference(npc, "item", equipment.Key, false);
                    }

                    npc.equipment.Add(obj);
                }
            }
        }

        Tuple<Saint.Items.Equipment, int> Match(Saint.EquipSlot slot, Saint.Quad key)
        {
            var equipmentByModelKey = _equipmentBySlotByModelKey[slot];

            // Check for an exact match.
            if (equipmentByModelKey.TryGetValue(key, out var equipment))
                return Tuple.Create(equipment, 0);

            // Search for the closest-matching equipment with this key.
            var matchComplexity = int.MaxValue;
            var matchUncertainty = int.MaxValue;
            Saint.Items.Equipment matchEquipment = null;
            foreach (var pair in equipmentByModelKey)
            {
                // The first value must always match.
                if (pair.Key.Value1 != key.Value1)
                    continue;

                // If the equipment is a weapon or shield, the second value must always match too.
                if ((pair.Value is Saint.Items.Weapon || pair.Value is Saint.Items.Shield)
                    && pair.Key.Value2 != key.Value2)
                    continue;

                // For every 10 levels of variance in the second value, match uncertainty increases.
                var uncertainty = 1 + Math.Abs(pair.Key.Value2 - key.Value2) / 10;
                if (uncertainty > matchUncertainty)
                    continue;

                // Now find the least complicated match on the lowest uncertainty level.
                var complexity = _complexity.GetNqComplexity(pair.Value.Key);
                if (complexity < matchComplexity)
                {
                    matchUncertainty = uncertainty;
                    matchEquipment = pair.Value;
                }
            }

            return Tuple.Create(matchEquipment, matchUncertainty);
        }

        void Index()
        {
            _slots = _builder.Realm.GameData.EquipSlots;

            var equipmentWithModels = _builder.ItemsToImport
                .OfType<Saint.Items.Equipment>()
                .Where(e => e.ItemUICategory.Key != 33) // No fishing tackle
                .Where(e => e.ItemUICategory.Key != 39) // No models for waist slots
                .Where(e => e.Rarity != 7)
                .Where(e => e.EquipRestriction != 0);

            foreach (var sEquipment in equipmentWithModels)
            {
                foreach (var sEquipSlot in sEquipment.EquipSlotCategory.PossibleSlots)
                {
                    if (!_equipmentBySlotByModelKey.TryGetValue(sEquipSlot, out var equipmentByModelKey))
                        _equipmentBySlotByModelKey[sEquipSlot] = equipmentByModelKey = new Dictionary<Saint.Quad, Saint.Items.Equipment>();

                    if (equipmentByModelKey.TryGetValue(sEquipment.PrimaryModelKey, out var sPreviousEquipment))
                    {
                        // Compare this equipment with the previous equipment,
                        // preferring the least complex source.
                        var complexity1 = _complexity.GetNqComplexity(sEquipment.Key);
                        var complexity2 = _complexity.GetNqComplexity(sPreviousEquipment.Key);
                        if (complexity1 < complexity2)
                            equipmentByModelKey[sEquipment.PrimaryModelKey] = sEquipment;
                    }
                    else
                        equipmentByModelKey[sEquipment.PrimaryModelKey] = sEquipment;
                }
            }
        }

        Dictionary<Saint.EquipSlot, ModelData> GetModelKeys(Saint.XivRow sNpcEquip, Saint.XivRow sENpcBase)
        {
            var keys = new Dictionary<Saint.EquipSlot, ModelData>();

            // First process the sNpcEquip template.
            if (sNpcEquip != null && sNpcEquip.Key != 0)
                StoreModelKeys(keys, sNpcEquip);

            // Next override with ENpcBase data.
            StoreModelKeys(keys, sENpcBase);

            return keys;
        }

        void StoreModelKeys(Dictionary<Saint.EquipSlot, ModelData> keys, Saint.XivRow row)
        {
            StoreModelKey(keys, (Saint.Quad)row["Model{MainHand}"], (Saint.Stain)row["Dye{MainHand}"], _slots[0]);
            StoreModelKey(keys, (Saint.Quad)row["Model{OffHand}"], (Saint.Stain)row["Dye{OffHand}"], _slots[1]);
            StoreModelKey(keys, (UInt32)row["Model{Head}"], (Saint.Stain)row["Dye{Head}"], _slots[2]);
            StoreModelKey(keys, (UInt32)row["Model{Body}"], (Saint.Stain)row["Dye{Body}"], _slots[3]);
            StoreModelKey(keys, (UInt32)row["Model{Hands}"], (Saint.Stain)row["Dye{Hands}"], _slots[4]);
            StoreModelKey(keys, (UInt32)row["Model{Legs}"], (Saint.Stain)row["Dye{Legs}"], _slots[6]);
            StoreModelKey(keys, (UInt32)row["Model{Feet}"], (Saint.Stain)row["Dye{Feet}"], _slots[7]);
            StoreModelKey(keys, (UInt32)row["Model{Ears}"], (Saint.Stain)row["Dye{Ears}"], _slots[8]);
            StoreModelKey(keys, (UInt32)row["Model{Neck}"], (Saint.Stain)row["Dye{Neck}"], _slots[9]);
            StoreModelKey(keys, (UInt32)row["Model{Wrists}"], (Saint.Stain)row["Dye{Wrists}"], _slots[10]);
            StoreModelKey(keys, (UInt32)row["Model{LeftRing}"], (Saint.Stain)row["Dye{LeftRing}"], _slots[11]);
            StoreModelKey(keys, (UInt32)row["Model{RightRing}"], (Saint.Stain)row["Dye{RightRing}"], _slots[12]);
        }

        int EquipSlotToEquipSlotCategoryKey (Saint.EquipSlot sEquipSlot)
        {
            switch (sEquipSlot.Key)
            {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                case 9:
                case 10:
                case 11:
                    return sEquipSlot.Key + 1;

                case 12: // Fingers share an EquipSlotCategory
                    return 12;

                default:
                    throw new NotImplementedException();
            }
        }

        void StoreModelKey(Dictionary<Saint.EquipSlot, ModelData> keys, Saint.Quad model, Saint.Stain stain, Saint.EquipSlot slot)
        {
            if (!model.IsEmpty)
                keys[slot] = new ModelData(model, stain);
        }

        void StoreModelKey(Dictionary<Saint.EquipSlot, ModelData> keys, UInt32 model, Saint.Stain stain, Saint.EquipSlot slot)
        {
            // UInt32.MaxValue is an override used to remove a piece from the template.
            if (model == UInt32.MaxValue)
                keys.Remove(slot);
            else if (model > 0)
                keys[slot] = new ModelData(new Saint.Quad(model), stain);
        }

        class ModelData
        {
            public Saint.Quad Key;
            public Saint.Stain Stain;

            public ModelData(Saint.Quad key, Saint.Stain stain)
            {
                Key = key;
                Stain = stain;
            }
        }
    }
}
