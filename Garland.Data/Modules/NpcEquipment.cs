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
                var matches = new List<Tuple<Saint.Items.Equipment, Saint.Stain, int>>();

                foreach (var pair in modelKeys)
                {
                    var slot = pair.Key;
                    var modelData = pair.Value;

                    var match = Match(slot, modelData.Key);
                    if (match.Item1 != null)
                        matches.Add(Tuple.Create(match.Item1, modelData.Stain, match.Item2));
                }

                if (matches.Count == 0)
                    continue;

                var npc = _builder.GetOrCreateNpc(sNpc);
                npc.equipment = new JArray();

                foreach (var match in matches)
                {
                    dynamic obj = new JObject();
                    obj.id = match.Item1.Key;
                    if (match.Item2.Key > 0)
                        obj.dye = match.Item2.Key;
                    if (match.Item3 > 0)
                        obj.uncertainty = match.Item3;

                    npc.equipment.Add(obj);
                    _builder.Db.AddReference(npc, "item", match.Item1.Key, false);
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

            foreach (var equipment in equipmentWithModels)
            {
                foreach (var slot in equipment.EquipSlotCategory.PossibleSlots)
                {
                    if (!_equipmentBySlotByModelKey.TryGetValue(slot, out var equipmentByModelKey))
                        _equipmentBySlotByModelKey[slot] = equipmentByModelKey = new Dictionary<Saint.Quad, Saint.Items.Equipment>();

                    if (equipmentByModelKey.TryGetValue(equipment.PrimaryModelKey, out var previousEquipment))
                    {
                        // Compare this equipment with the previous equipment,
                        // preferring the least complex source.
                        var complexity1 = _complexity.GetNqComplexity(equipment.Key);
                        var complexity2 = _complexity.GetNqComplexity(previousEquipment.Key);
                        if (complexity1 < complexity2)
                            equipmentByModelKey[equipment.PrimaryModelKey] = equipment;
                    }
                    else
                        equipmentByModelKey[equipment.PrimaryModelKey] = equipment;
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
