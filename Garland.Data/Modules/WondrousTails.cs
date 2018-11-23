using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class WondrousTails : Module
    {
        public override string Name => "Wondrous Tails";

        public override void Start()
        {
            const int id = 2002023;
            var rawBook = _builder.Sheet<Game.EventItem>()[id];
            var rawHelp = _builder.Sheet("EventItemHelp")[id];

            var book = _builder.CreateItem("wondroustails");
            _builder.Localize.Strings((JObject)book, rawBook, "Name");
            _builder.Localize.Strings((JObject)book, rawHelp, "Description");
            book.ilvl = 1;
            book.category = 63; // Other
            book.icon = "custom/wondroustails";

            var lv60TwoLines = RewardList("Level 60 Rewards");
            var lv60ThreeLines = RewardList("Level 60 Rewards (Three Lines)");
            var lv70TwoLines = RewardList("Level 70 Rewards");
            var lv70ThreeLines = RewardList("Level 70 Rewards (Three Lines)");

            // Rewards
            foreach (var row in _builder.Sheet("WeeklyBingoRewardData"))
            {
                // Filter blank rows with no first reward.
                var sRewardItem1 = (Game.Item)row["Reward{Item}[0]"];
                if (sRewardItem1 == null || sRewardItem1.Key == 0)
                    continue;

                // Filter invalid rows with no 2nd reward or option.
                var sRewardItem2 = (Game.Item)row["Reward{Item}[1]"];
                var optionRow = (Game.IXivRow)row["Reward{Option}[0]"];
                if (optionRow.Key == 0 && (sRewardItem2 == null || sRewardItem2.Key == 0))
                    continue;

                // Two different formats now:
                // 1. Reward{Option}[0] == 0 -> 3 columns of rewards for Lv70.
                // 2. Reward{Option}[0] > 0 -> 2 columns of rewards for Lv60.

                var options = new JArray();

                var isHQ = (bool)row["Reward{HQ}[0]"];

                if (optionRow.Key == 0)
                {
                    // Lv70 reward structure - no options.
                    options = new JArray(Option(book, row, 0), Option(book, row, 1), Option(book, row, 2));
                    (isHQ ? lv70ThreeLines : lv70TwoLines).rewards.Add(options);
                }
                else
                {
                    // Lv60 reward structure - use the option.
                    options = new JArray(Option(book, row, 0), Option(book, optionRow, 0));
                    (isHQ ? lv60ThreeLines : lv60TwoLines).rewards.Add(options);
                }
            }

            book.bingoData = new JArray(lv70TwoLines, lv70ThreeLines, lv60TwoLines, lv60ThreeLines);
        }

        private static dynamic RewardList(string name)
        {
            dynamic list = new JObject();
            list.name = name;
            list.rewards = new JArray();
            return list;
        }

        private JObject Option(dynamic book, Game.IXivRow row, int index)
        {
            var quantity = (UInt16)row["Reward{Quantity}[" + index + "]"];
            var rewardItem = (Game.Item)row["Reward{Item}[" + index + "]"];
            var isHQ = (bool)row["Reward{HQ}[" + index + "]"];

            var item = _builder.Db.ItemsById[rewardItem.Key];
            item.bingoReward = 1;
            _builder.Db.AddReference(item, "item", "wondroustails", false);
            _builder.Db.AddReference(book, "item", rewardItem.Key, false);

            dynamic option = new JObject();
            option.item = rewardItem.Key;
            option.amount = quantity;

            if (isHQ)
                option.hq = 1;

            return option;
        }
    }
}
