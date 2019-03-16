using Garland.Data.Models;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class TripleTriad : Module
    {
        Dictionary<int, dynamic> _itemsByTripleTriadCardId = new Dictionary<int, dynamic>();

        public override string Name => "Triple Triad";

        public override void Start()
        {
            BuildCards();
            BuildNpcData();
        }

        void BuildCards()
        {
            foreach (var sItem in _builder.ItemsToImport)
            {
                var unlock = sItem.ItemAction as SaintCoinach.Xiv.ItemActions.TripleTriadCardUnlock;
                if (unlock == null)
                    continue;

                var item = _builder.Db.ItemsById[sItem.Key];
                if (item.tripletriad != null)
                    throw new InvalidOperationException();

                var sCard = unlock.TripleTriadCard;
                var sResident = unlock.TripleTriadCard.TripleTriadCardResident;

                item.tripletriad = new JObject();
                _builder.Localize.Strings(item.tripletriad, unlock.TripleTriadCard, "Description");

                var type = sResident.TripleTriadCardType.Name.ToString();
                if (!string.IsNullOrEmpty(type))
                    item.tripletriad.type = type;

                if (sResident.SaleValue > 0)
                    item.tripletriad.sellMgp = sResident.SaleValue;

                // unlock.TripleTriadCard.Icon is only 40x40 and looks awful.
                item.tripletriad.plate = IconDatabase.EnsureEntry("triad\\plate", sCard.PlateIcon);

                item.tripletriad.rarity = sResident.TripleTriadCardRarity.Key;

                if (sResident.Top == 10)
                    item.tripletriad.top = "A";
                else
                    item.tripletriad.top = sResident.Top;

                if (sResident.Bottom == 10)
                    item.tripletriad.bottom = "A";
                else
                    item.tripletriad.bottom = sResident.Bottom;

                if (sResident.Left == 10)
                    item.tripletriad.left = "A";
                else
                    item.tripletriad.left = sResident.Left;

                if (sResident.Right == 10)
                    item.tripletriad.right = "A";
                else
                    item.tripletriad.right = sResident.Right;

                _itemsByTripleTriadCardId[sCard.Key] = item;
            }
        }

        void BuildNpcData()
        {
            foreach (var sTripleTriad in _builder.Sheet<Game.TripleTriad>())
            {
                var sNpc = sTripleTriad.ENpcs.FirstOrDefault();
                if (sNpc == null)
                    continue;

                var npc = _builder.Db.NpcsById[sNpc.Key];
                if (npc.tripletriad != null)
                    throw new InvalidOperationException();

                dynamic tt = new JObject();
                npc.tripletriad = tt;

                tt.fee = sTripleTriad.Fee;

                foreach (var sCard in sTripleTriad.AllCards)
                {
                    if (tt.cards == null)
                        tt.cards = new JArray();

                    var cardItem = _itemsByTripleTriadCardId[sCard.Key];
                    tt.cards.Add((int)cardItem.id);
                    _builder.Db.AddReference(npc, "item", (int)cardItem.id, false);
                }

                foreach (var sRule in sTripleTriad.FixedRules)
                {
                    if (tt.rules == null)
                        tt.rules = new JArray();
                    tt.rules.Add(sRule.Name.ToString());
                }

                if (sTripleTriad.StartTime > 0)
                {
                    tt.start = sTripleTriad.StartTime / 100;
                    tt.end = sTripleTriad.EndTime / 100;
                }

                foreach (var sQuest in sTripleTriad.QuestRequirement.Quests)
                {
                    if (tt.quests == null)
                        tt.quests = new JArray();
                    tt.quests.Add(sQuest.Key);
                    _builder.Db.AddReference(npc, "quest", sQuest.Key, false);
                }

                if (sTripleTriad.UsesRegionalRules)
                    tt.regionalRules = 1;

                foreach (var sItem in sTripleTriad.RewardItems)
                {
                    if (tt.rewards == null)
                        tt.rewards = new JArray();
                    tt.rewards.Add(sItem.Key);
                    _builder.Db.AddReference(npc, "item", sItem.Key, false);

                    var item = _builder.Db.ItemsById[sItem.Key];
                    if (item.tripletriad.rewardFrom == null)
                        item.tripletriad.rewardFrom = new JArray();
                    item.tripletriad.rewardFrom.Add(sNpc.Key);
                    _builder.Db.AddReference(item, "npc", sNpc.Key, false);
                }
            }
        }
    }
}
