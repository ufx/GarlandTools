using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Nodes : Module
    {
        Dictionary<int, dynamic> _bonusesByKey = new Dictionary<int, dynamic>();

        public override string Name => "Nodes";

        public override void Start()
        {
            BuildGatheringPointBonuses();

            // GatheringItemPoint collection.
            var sGatheringItemSheet = _builder.Sheet<Saint.GatheringItem>();
            var sGatheringItemPoints = _builder.Sheet2("GatheringItemPoint")
                .Cast<Saint.XivSubRow>()
                .Select(r => new { Row = r, GatheringItemPoint = (Saint.XivRow)r[0], GatheringItem = sGatheringItemSheet[r.ParentKey] })
                .ToArray();

            // Basic gathering points.
            dynamic lastNode = null;
            foreach (var sGatheringPoint in _builder.Sheet<Saint.GatheringPoint>())
            {
                if (sGatheringPoint.Base.Key == 0)
                    continue;

                // Find or create the node.
                if (!_builder.Db.NodesById.TryGetValue(sGatheringPoint.Base.Key, out var node))
                {
                    node = BuildNode(sGatheringPoint, lastNode);
                    if (node == null)
                        continue;
                }

                // All potential bonuses are stored.
                AddNodeBonuses(node, sGatheringPoint);

                // Find hidden items linked to this node via GatheringItemPoint.
                var sRelevantItems = sGatheringItemPoints
                    .Where(r => r.GatheringItemPoint.Key == sGatheringPoint.Key)
                    .Select(r => r.GatheringItem.Item)
                    .OfType<Saint.Item>();
                BuildNodeHiddenItems(node, sRelevantItems);

                // Set node location data.
                if (node.zoneid == null && sGatheringPoint.TerritoryType.Map.Key != 0)
                {
                    node.zoneid = sGatheringPoint.TerritoryType.Map.PlaceName.Key;
                    _builder.Db.AddLocationReference(sGatheringPoint.TerritoryType.Map.PlaceName.Key);
                }
                if (node.areaid == null && sGatheringPoint.PlaceName.Key != 0)
                {
                    node.areaid = sGatheringPoint.PlaceName.Key;
                    _builder.Db.AddLocationReference(sGatheringPoint.PlaceName.Key);
                    node.name = Utils.SanitizeTags(sGatheringPoint.PlaceName.Name);
                }

                lastNode = node;
            }

            BuildLimitedNodes();

            Hacks.CreateDiademNodes(_builder.Db);

            Cleanup();
        }

        void AddNodeBonuses(dynamic node, Saint.GatheringPoint sGatheringPoint)
        {
            if (sGatheringPoint.GatheringPointBonus.Length == 0)
                return;

            if (node.bonus == null)
                node.bonus = new JArray();

            JArray bonuses = node.bonus;
            foreach (var sGatheringPointBonus in sGatheringPoint.GatheringPointBonus)
            {
                if (!bonuses.Any(j => (int)j == sGatheringPointBonus.Key))
                    bonuses.Add(sGatheringPointBonus.Key);
            }
        }

        dynamic BuildNode(Saint.GatheringPoint sGatheringPoint, dynamic lastNode)
        {
            dynamic node = new JObject();
            node.id = sGatheringPoint.Base.Key;
            node.name = "Node";
            node.patch = PatchDatabase.Get("node", sGatheringPoint.Base.Key);
            node.type = sGatheringPoint.Base.Type.Key;
            node.lvl = sGatheringPoint.Base.GatheringLevel;
            node.items = new JArray();

            if (sGatheringPoint.Base.IsLimited)
                node.limited = 1;

            // Special case for concealed nodes - take the name of the last node,
            // as these are in order in the files.
            var nameModifier = (byte)sGatheringPoint[0];
            if (nameModifier == 6)
            {
                node.limitType = "Concealed";
                node.name = lastNode.name;
            }

            // Folklore books
            dynamic folkloreItem = null;
            if (sGatheringPoint.GatheringSubCategory != null)
            {
                folkloreItem = _builder.Db.ItemsById[sGatheringPoint.GatheringSubCategory.Item.Key];
                if (folkloreItem.unlocks == null)
                    folkloreItem.unlocks = new JArray();

                node.unlockId = sGatheringPoint.GatheringSubCategory.Item.Key;
                _builder.Db.AddReference(node, "item", sGatheringPoint.GatheringSubCategory.Item.Key, false);
            }

            // Items
            var sGatheringItemBases = sGatheringPoint.Base.Items
                .Where(gi => gi != null && gi.Key != 0 && gi.Item is Saint.Item)
                .ToArray();

            if (sGatheringItemBases.Length == 0)
                return null;

            int maxStars = 0;
            foreach (var sGatheringItemBase in sGatheringItemBases)
            {
                var sGatheringItemLevelConvertTable = (Saint.XivRow)sGatheringItemBase["GatheringItemLevel"];
                var stars = (byte)sGatheringItemLevelConvertTable["Stars"];
                maxStars = Math.Max(stars, maxStars);

                var sItem = sGatheringItemBase.Item;

                dynamic nodeItem = new JObject();
                nodeItem.id = sItem.Key;
                node.items.Add(nodeItem);

                if (folkloreItem != null)
                {
                    var folkloreItemId = (int)folkloreItem.id;
                    var item = _builder.Db.ItemsById[sItem.Key];
                    item.unlockId = folkloreItemId;
                    folkloreItem.unlocks.Add(sItem.Key);
                    _builder.Db.AddReference(folkloreItem, "item", sItem.Key, false);
                    _builder.Db.AddReference(item, "item", folkloreItemId, false);
                }
            }

            if (maxStars > 0)
                node.stars = maxStars;

            // Lookup coordinates for spearfishing nodes.
            if (sGatheringPoint.Base.Type.Key == 4)
            {
                foreach (var sSpearfishingNotebook in _builder.Sheet("SpearfishingNotebook"))
                {
                    var sGatheringPointBase = (Saint.XivRow)sSpearfishingNotebook["GatheringPointBase"];
                    if (sGatheringPointBase == null || sGatheringPointBase.Key != sGatheringPoint.Base.Key)
                        continue;

                    node.name = Utils.SanitizeTags(sSpearfishingNotebook.As<Saint.PlaceName>().Name);
                    node.radius = sSpearfishingNotebook.AsInt32("Radius");

                    var sTerritoryType = sSpearfishingNotebook.As<Saint.TerritoryType>();
                    node.coords = new JArray
                    {
                        Math.Round(sTerritoryType.Map.ToMapCoordinate2d(sSpearfishingNotebook.AsInt32("X"), 0), 2),
                        Math.Round(sTerritoryType.Map.ToMapCoordinate2d(sSpearfishingNotebook.AsInt32("Y"), 0), 2)
                    };
                    break;
                }

                string keyName = node.name;
                if (keyName == "Node")
                    keyName = "Node #" + (int)node.id;
                _builder.Db.SpearfishingNodesByName[keyName] = node;
            }

            // Store and return!
            _builder.Db.Nodes.Add(node);
            _builder.Db.NodesById[sGatheringPoint.Base.Key] = node;
            return node;
        }

        void BuildNodeHiddenItems(dynamic node, IEnumerable<Saint.Item> sItems)
        {
            foreach (var sItem in sItems)
            {
                JArray items = node.items;
                if (items.Any(t => (int)t["id"] == sItem.Key))
                    continue;

                dynamic obj = new JObject();
                obj.id = sItem.Key;
                obj.slot = "?";
                items.Add(obj);
            }
        }

        void BuildGatheringPointBonuses()
        {
            foreach (var sGatheringPointBonus in _builder.Sheet<Saint.GatheringPointBonus>())
            {
                if (sGatheringPointBonus.Condition.Key == 0)
                    continue;

                var conditionText = sGatheringPointBonus.Condition.Text.ToString();
                var conditionFilled = conditionText.Replace("<Value>IntegerParameter(1)</Value>", sGatheringPointBonus.ConditionValue.ToString());
                var bonusText = sGatheringPointBonus.BonusType.Text.ToString();
                var bonusFilled = bonusText.Replace("<Value>IntegerParameter(1)</Value>", sGatheringPointBonus.BonusValue.ToString());

                dynamic bonus = new JObject();
                bonus.id = sGatheringPointBonus.Key;
                bonus.condition = conditionFilled;
                bonus.bonus = bonusFilled;
                _builder.Db.NodeBonuses.Add(bonus);
                _bonusesByKey[sGatheringPointBonus.Key] = bonus;
            }
        }

        void BuildLimitedNodes()
        {
            var viewsByNodeId = new Dictionary<int, dynamic>();

            var lines = Utils.Tsv("Supplemental\\FFXIV Data - Nodes.tsv");
            foreach (var line in lines.Skip(1))
            {
                var itemName = line[0];
                var slot = line[1];
                var nodeId = int.Parse(line[2]);
                var times = Utils.IntComma(line[3]);
                var uptime = int.Parse(line[4]);
                var coords = Utils.IntComma(line[5]);
                var areaName = line[6];
                var type = line[7];

                var item = _builder.Db.ItemsByName[itemName];

                // First match this data to the node object.
                var node = _builder.Db.NodesById[nodeId];

                node.limitType = type;
                node.uptime = uptime;
                node.coords = new JArray(coords);
                node.time = new JArray(times);

                if (node.areaid == null && areaName != "")
                {
                    var areaId = _builder.Db.LocationIdsByName[areaName];
                    _builder.Db.AddLocationReference(areaId);
                    node.areaid = areaId;
                    node.name = areaName;
                }

                var nodeItems = (JArray)node.items;
                dynamic nodeItem = nodeItems.FirstOrDefault(ni => (int)ni["id"] == (int)item.id);
                if (nodeItem == null)
                    throw new Exception("Invalid item " + itemName + " on node " + areaName);
                nodeItem.slot = slot;

                // Next build up the gathering node view.
                if (!viewsByNodeId.TryGetValue(nodeId, out var view))
                {
                    view = new JObject();
                    viewsByNodeId[nodeId] = view;
                    _builder.Db.NodeViews.Add(view);

                    view.type = TypeToName((int)node.type);
                    view.func = "node";
                    view.items = new JArray();

                    if (node.stars != null)
                        view.stars = node.stars;

                    view.time = node.time;
                    view.title = node.name;

                    var zone = _builder.Db.LocationsById[(int)node.zoneid];
                    view.zone = zone.name;

                    view.coords = node.coords;
                    view.name = type;
                    view.uptime = uptime;
                    view.lvl = node.lvl;
                    view.id = nodeId;

                    if (node.bonus != null)
                    {
                        var bonus = _bonusesByKey[(int)node.bonus[0]];
                        view.condition = bonus.condition;
                        view.bonus = bonus.bonus;
                    }

                    view.patch = node.patch;
                }

                // Add items to the view.
                dynamic itemView = new JObject();
                itemView.item = itemName;
                itemView.icon = item.icon;
                itemView.id = item.id;

                if (slot != "")
                    itemView.slot = slot;

                view.items.Add(itemView);
            }
        }

        static string TypeToName(int gatheringType)
        {
            switch (gatheringType)
            {
                case 0: return "Mineral Deposit";
                case 1: return "Rocky Outcropping";
                case 2: return "Mature Tree";
                case 3: return "Lush Vegetation";
                default: throw new NotImplementedException();
            }
        }

        void Cleanup()
        {
            // Clean out invalid nodes, and add node IDs to items.

            var allNodes = _builder.Db.Nodes.ToArray();
            foreach (var node in allNodes)
            {
                if (node.zoneid == null)
                {
                    // These nodes are probably just used for testing, or they're for
                    // areas that don't exist yet in Saint.
                    _builder.Db.Nodes.Remove(node);
                    continue;
                }

                foreach (var gi in node.items)
                {
                    int itemId = gi.id;
                    var item = _builder.Db.ItemsById[itemId];
                    if (item.nodes == null)
                        item.nodes = new JArray();
                    item.nodes.Add(node.id);
                    _builder.Db.AddReference(node, "item", itemId, false);
                    _builder.Db.AddReference(item, "node", (int)node.id, true);
                }
            }
        }
    }
}
