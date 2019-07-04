using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Leves : Module
    {
        Dictionary<Game.Leve, Game.CraftLeve> _craftLevesByLeve;

        public override string Name => "Leves";

        public override void Start()
        {
            _craftLevesByLeve = _builder.Sheet<Game.CraftLeve>().ToDictionary(d => d.Leve);

            foreach (var sLeveRewardItem in _builder.Sheet<Game.LeveRewardItem>())
                BuildLeveReward(sLeveRewardItem);

            foreach (var sLeve in _builder.Sheet<Game.Leve>())
                BuildLeve(sLeve);
        }

        void BuildLeveReward(Game.LeveRewardItem sLeveRewardItem)
        {
            if (!sLeveRewardItem.ItemGroups.Any(ig => ig.Value.Key > 0))
                return; // No rewards.

            dynamic leveRewards = new JObject();
            leveRewards.id = sLeveRewardItem.Key;

            var entriesBag = new List<dynamic>();

            foreach (var group in sLeveRewardItem.ItemGroups)
            {
                if (group.Probability <= 0 || group.Value.Key == 0)
                    continue;

                var groupItems = group.Value.Items.ToArray();
                foreach (var item in groupItems)
                {
                    dynamic entry = new JObject();
                    entry.item = item.Item.Key;
                    entry.rate = Math.Round(group.Probability / groupItems.Length, 2, MidpointRounding.AwayFromZero);

                    if (item.Count > 1)
                        entry.amount = item.Count;

                    if (item.IsHq)
                        entry.hq = 1;

                    entriesBag.Add(entry);
                }
            }

            leveRewards.entries = new JArray(entriesBag.OrderByDescending(e => (double)e.rate));

            _builder.Db.LeveRewardsById[sLeveRewardItem.Key] = leveRewards;
        }

        void BuildLeve(Game.Leve sLeve)
        {
            if (sLeve.Key <= 20 || sLeve.Name == "")
                return;

            dynamic leve = new JObject();
            leve.id = sLeve.Key;
            _builder.Localize.HtmlStrings((JObject)leve, sLeve, "Name", "Description");
            leve.patch = PatchDatabase.Get("leve", sLeve.Key);
            leve.client = sLeve.LeveClient.Name.ToString().Replace("Client: ", "");
            leve.lvl = sLeve.ClassJobLevel;
            leve.jobCategory = sLeve.ClassJobCategory.Key;

            var sNpc = _builder.Realm.GameData.ENpcs[sLeve.LevemeteLevel.Object.Key];
            var levemete = _builder.Db.NpcsById[sNpc.Key];
            leve.levemete = sNpc.Key;
            _builder.Db.AddReference(leve, "npc", sNpc.Key, false);

            if (sLeve.StartLevel != null && sLeve.StartLevel.Key != 0)
            {
                leve.coords = _builder.GetCoords(sLeve.StartLevel);
                leve.map = _builder.Db.MapsById[sLeve.StartLevel.Map.Key];
            }

            leve.areaid = sLeve.PlaceNameStart.Key;
            leve.area = sLeve.PlaceNameStart.ToString();

            if (sLeve.ExpReward > 0)
                leve.xp = sLeve.ExpReward;

            if (sLeve.GilReward > 0)
                leve.gil = sLeve.GilReward;

            switch (sLeve.LeveAssignmentType.Key)
            {
                case 16: // Maelstrom
                case 17: // Adders
                case 18: // Flames
                    leve.gc = sLeve.LeveAssignmentType.Key - 15;
                    break;
            }

            if (sLeve.LeveRewardItem.ItemGroups.Any(ig => ig.Value.Key > 0))
            {
                // Embed the rewards, as they will be kept in separate files.
                leve.rewards = sLeve.LeveRewardItem.Key;

                foreach (var group in sLeve.LeveRewardItem.ItemGroups.SelectMany(g => g.Value.Items))
                {
                    var item = _builder.Db.ItemsById[group.Item.Key];
                    if (item.category == 59) // Crystal
                        continue; // Skip these, there are too many.

                    if (item.leves == null)
                        item.leves = new JArray();

                    JArray leves = item.leves;
                    if (!leves.Any(l => (int)l == sLeve.Key))
                    {
                        leves.Add(sLeve.Key);
                        _builder.Db.AddReference(item, "leve", sLeve.Key, false);
                        _builder.Db.AddReference(leve, "item", group.Item.Key, false);
                    }
                }
            }

            leve.plate = Utils.GetIconId(sLeve.PlateIcon);
            leve.frame = Utils.GetIconId(sLeve.FrameIcon);
            leve.areaicon = IconDatabase.EnsureEntry("leve\\area", sLeve.IssuerIcon);

            // Find turn-ins for crafting and fisher leves.
            if (_craftLevesByLeve.TryGetValue(sLeve, out var sCraftLeve))
            {
                if (sCraftLeve.Repeats > 0)
                    leve.repeats = sCraftLeve.Repeats;

                JArray requires = new JArray();
                leve.requires = requires;
                foreach (var sCraftLeveItem in sCraftLeve.Items)
                {
                    dynamic entry = requires.FirstOrDefault(t => (int)t["item"] == sCraftLeveItem.Item.Key);
                    if (entry != null)
                    {
                        if (entry.amount == null)
                            entry.amount = 1;
                        entry.amount += sCraftLeveItem.Count;
                        continue;
                    }

                    dynamic requireItem = new JObject();
                    requireItem.item = sCraftLeveItem.Item.Key;
                    if (sCraftLeveItem.Count > 1)
                        requireItem.amount = sCraftLeveItem.Count;
                    leve.requires.Add(requireItem);

                    var item = _builder.Db.ItemsById[sCraftLeveItem.Item.Key];
                    if (item.requiredByLeves == null)
                        item.requiredByLeves = new JArray();
                    item.requiredByLeves.Add(sLeve.Key);

                    _builder.Db.AddReference(item, "leve", sLeve.Key, false);
                    _builder.Db.AddReference(leve, "item", sCraftLeveItem.Item.Key, false);
                }
            }

            // TODO: CompanyLeve sheet for seal rewards and stuff?

            _builder.Db.Leves.Add(leve);
        }
    }
}
