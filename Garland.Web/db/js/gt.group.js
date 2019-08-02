gt.group = {
    blockTemplate: null,
    type: 'group',
    baseParamValues: {
        CP: 180,
        GP: 400
    },

    initialize: function(data) {
        gt.group.blockTemplate = doT.template($('#block-group-template').text());
        gt.group.shopTemplate = doT.template($('#block-group-shop-template').text());

        $('#new-group').click(gt.group.newGroupClicked);
    },

    bindEvents: function($block, data, view) {
        $('.name-handle', $block).bind(gt.display.downEvent, gt.core.renameHeaderClicked);
        $('.remove-group-block', $block).click(gt.group.removeGroupBlockClicked);
        $('.atomos', $block).click(gt.group.atomosClicked);
        $('.block-stats input.amount', $block).blur(gt.group.amountBlurred);
        $('.aggregate-leves input.current-level', $block).blur(gt.group.currentLevelBlurred);
        $('.aggregate-leves input.current-xp', $block).blur(gt.group.currentXpBlurred);
        $('.materia .socket', $block).click(gt.item.materiaSocketClicked);
        $('.contents-link', $block).click(gt.group.contentLinkClicked);
        gt.craft.bindEvents($block, data, view);

        // Assign views data to block-stats.
        for (var i = 0; i < view.contents.length; i++) {
            var model = view.contents[i];

            var $header = $('.block-stats[data-type=' + model.type + '][data-id=' + model.view.id + ']', $block);
            $header.data('view', model.view);
            $header.data('block', model.block);
        }
    },

    newGroupClicked: function(e) {
        var name = "Group";
        var counter = 2;

        while (gt.list.getBlockData('group', name))
            name = "Group " + counter++;

        var group = { type: 'group', id: name, blocks: [] };
        gt.list.addBlock(group);
        gt.core.activate('group', name);
    },

    removeGroupBlockClicked: function(e) {
        e.stopPropagation(); // Prevents opening the block.

        gt.group.updateBlockOf(this, function(doomedBlock, data) {
            gt.list.removeBlockCore(doomedBlock, data.blocks);
            return true;
        });
    },

    amountBlurred: function(e) {
        var $this = $(this);
        var newAmount = parseInt($this.val());
        if (!newAmount || newAmount <= 0)
            newAmount = 1;
        if (newAmount > 999)
            newAmount = 999; // Don't wreck browser for this.

        gt.group.updateBlockOf(this, function(block) {
            var existingAmount = block.amount || 1;
            if (existingAmount == newAmount)
                return false;

            if (newAmount == 1)
                delete block.amount;
            else
                block.amount = newAmount;
            return true;
        });
    },

    currentXpBlurred: function(e) {
        var $this = $(this);
        var $block = $this.closest('.block');
        var data = $block.data('block');
        data.currentXp = parseInt($this.val()) || 0;

        gt.core.redisplay($block);
        gt.settings.saveDirty();
    },

    currentLevelBlurred: function(e) {
        var $this = $(this);
        var $block = $this.closest('.block');
        var data = $block.data('block');
        data.currentLevel = parseInt($this.val()) || 0;

        gt.core.redisplay($block);
        gt.settings.saveDirty();
    },

    atomosClicked: function(e) {
        var $block = $(this).closest('.block');
        $block.toggleClass('atomos-active');
        // This is intentionally not persisted.
        setTimeout(function() { gt.list.resized($block) }, 300);
    },

    insertGroup: function($block, $group) {
        var groupData = $group.data('block');
        var blockData = $block.data('block');

        // Make sure it isn't a duplicate.
        gt.group.insertGroupCore(blockData, groupData);

        if ($block.is('.active'))
            gt.core.setHash(null);

        gt.list.removeBlock(blockData);
        gt.core.removeBlockCore($block, false);
        
        var $replacement = gt.core.redisplay($group);
        $group.data('view', $replacement.data('view'));
    },

    insertGroupCore: function(blockData, groupData) {
        var existing = _.find(groupData.blocks, function(b) { return b.type == blockData.type && b.id == blockData.id; });
        if (existing)
            existing.amount = (existing.amount || 1) + (blockData.amount || 1);
        else
            groupData.blocks.push(blockData);
    },

    updateBlockOf: function(element, func) {
        var $element = $(element);
        var $header = $element.closest('.block-stats');
        var $group = $header.closest('.block');

        var type = $header.data('type');
        var id = $header.data('id');
        var data = $group.data('block');

        var block = _.find(data.blocks, function(b) { return b.type == type && b.id == id; });
        if (!block) {
            console.error("Can't find contents " + type + " with id " + id +" in group " + data.id);
            return;
        }

        func(block, data);

        gt.core.redisplay($group);
        var view = $group.data('view');
        if (view.craftSet)
            data.craft = view.craftSet.save();
        else if (data.craft)
            delete data.craft;

        gt.settings.saveDirty();
    },

    getViewModel: function(group, data) {
        group = data;
        if (!group.blocks)
            group.blocks = [];

        // todo: remove he module check.
        var view = {
            id: group.id,
            type: 'group',
            name: group.id,
            displayName: he.encode(group.id),
            template: gt.group.blockTemplate,
            blockClass: 'tool noexpand',
            icon: 'images/Atomos.png',
            subheader: 'Group Tool',
            tool: 1,
            settings: 1,

            blocks: group.blocks,
            sourceName: group.id + ' (' + group.blocks.length + ')'
        };

        if (!data)
            return view;

        var deferredContents = [];
        view.contents = [];
        for (var i = 0; i < group.blocks.length; i++) {
            var block = group.blocks[i];

            var module = gt[block.type];
            if (!module) {
                console.error('Group ' + view.id + ' contains invalid block: ' + block.type + ' ' + block.id);
                continue;
            }

            // Handle groups containing unloaded data.
            if (!module.index[block.id]) {
                deferredContents.push(block);
                continue;
            }

            var innerView = gt.model.availableView(block);
            if (!innerView) {
                console.error('Group ' + view.id + ' contains invalid block: ' + block.type + ' ' + block.id);
                continue;
            }

            view.contents.push({ type: block.type, view: innerView, amount: block.amount, block: block });
        }

        // Aggregate leves.
        var leves = _.filter(view.contents, function(m) { return m.type == 'leve'; });
        view.aggregateLeves = gt.group.aggregateLeves(leves, data);
        view.currentXp = data.currentXp || 0;
        view.currentLevel = data.currentLevel || 0;

        // Aggregate items.
        var items = _.filter(view.contents, function(m) { return m.type == 'item'; });

        // Calculate average item level, aggregate stats of equipment.
        var equipment = _.filter(items, function(m) { return m.view.equip; });
        view.averageilvl = Math.round(gt.util.average(equipment, function(e) { return e.view.ilvl; }));

        // Aggregate crafts.
        view.craftSet = gt.group.aggregateCrafts(items, leves, data);

        if (view.craftSet) {
            var gatheredItems = [];
            for (var i = 0; i < view.craftSet.steps.length; i++) {
                var step = view.craftSet.steps[i];
                if (step.type == 'gathered') {
                    var amount = step.required - step.finished;
                    gt.item.fillShops(step.view, step.item);
                    gatheredItems.push({ view: step.view, amount: amount });
                }
            }
            view.craftShops = gt.group.aggregateShops(gatheredItems);
        }

        // Aggregate stats.
        view.aggregateStats = gt.group.aggregateAttributes(items);

        // Aggregate materia shops.
        if (view.aggregateStats && view.aggregateStats.melds) {
            var melds = view.aggregateStats.melds;
            var materia = [];
            for (var i = 0; i < melds.length; i++) {
                var meld = melds[i];
                var meldBlock = { type: 'item', id: meld.item.id };
                var meldItem = gt.item.index[meld.item.id];
                if (!meldItem) {
                    deferredContents.push(meldBlock);
                    continue;
                }

                materia.push({
                    amount: meld.amount,
                    block: meldBlock,
                    view: gt.item.getViewModel(meldItem, {})
                });
            }

            if (materia.length)
                view.materiaShops = gt.group.aggregateShops(materia);
        }

        // Aggregate contents shops.
        view.shops = gt.group.aggregateShops(items);

        // Kick off a load of the deferred contents.
        if (deferredContents.length) {
            var fetched = [];
            var contentsByType = _.groupBy(deferredContents, function(b) { return b.type; });
            for (var type in contentsByType) {
                var ids = _.map(contentsByType[type], function(b) { return b.id; });
                gt.core.fetch(gt[type], ids, function(results) {
                    for (var i = 0; i < results.length; i++) {
                        if (fetched.push(i) == deferredContents.length) {
                            // Group may have gone away during fetch.
                            var $block = $('.block.group[data-id="' + data.id + '"][data-type="' + data.type + '"]');
                            if ($block.length)
                                gt.core.redisplay($block);
                            return;
                        }
                    }
                });
            }
        }

        return view;
    },

    aggregateLeves: function(leves, data) {
        // Sum XP, accounting for repeats.
        var sums = { xp: 0, hqXp: 0, toStep: 0, levelStep: 0, xpPerSet: 0, hqXpPerSet: 0, nqLevesToStep: 0, hqLevesToStep: 0 };
        for (var i = 0; i < leves.length; i++) {
            var block = leves[i];
            var leve = block.view.leve;
            if (!leve.xp)
                continue;

            var amount = block.amount || 1;
            var repeats = (leve.repeats || 0) + 1;
            var xp = leve.xp * repeats;
            sums.xp += xp * amount;
            sums.xpPerSet += xp;

            if (leve.requires) {
                sums.hqXp += xp * 2 * amount;
                sums.hqXpPerSet += xp * 2;
            }
        }

        // No leves to sum.
        if (!sums.xp)
            return null;

        // Calculate XP to next ten level.
        if (data.currentLevel) {
            var maxLevel = data.currentLevel + 10 - (data.currentLevel % 10);
            var xpToStep = -data.currentXp || 0;
            for (var level = data.currentLevel; level < maxLevel && level < gt.xp.length - 1; level++)
                xpToStep += gt.xp[level];
            
            if (xpToStep > 0) {
                sums.toStep = xpToStep;
                sums.levelStep = maxLevel;

                sums.nqLevesToStep = gt.util.round1(xpToStep / sums.xpPerSet);
                if (sums.hqXpPerSet)
                    sums.hqLevesToStep = gt.util.round1(xpToStep / sums.hqXpPerSet);
            }
        }

        return sums.xp ? sums : null;
    },

    aggregateCrafts: function(items, leves, data) {
        var craftableItems = [];

        for (var i = 0; i < items.length; i++) {
            var block = items[i];
            var obj = block.view.obj;
            if (obj.craft)
                craftableItems.push({item: obj, amount: block.amount || 1});
        }

        for (var i = 0; i < leves.length; i++) {
            var block = leves[i];
            var obj = block.view.leve;
            if (obj.requires) {
                for (var ii = 0; ii < obj.requires.length; ii++) {
                    var required = obj.requires[ii];
                    var ingredient = gt.item.ingredients[required.item] || gt.item.index[required.item];
                    if (!ingredient || !ingredient.craft)
                        continue;

                    var repeats = (obj.repeats || 0) + 1;
                    craftableItems.push({item: ingredient, amount: (block.amount || 1) * (required.amount || 1) * repeats});
                }
            }
        }

        if (!craftableItems.length)
            return null;

        // Create a craftSet with all craftable contents.
        var set = new gt.craft.set('', craftableItems);
        if (data.craft)
            set.load(data.craft);
        set.sort();
        set.showGoals = 1;
        set.tree = data.craftTree;
        set.amounts = data.craftAmount;
        return set;
    },

    aggregateAttributes: function(items) {
        // First aggregate the values.
        var sumBonuses = {}, sumPrimes = {}, sumMelds = {};
        var hasBonusMeter = false;
        var hasStats = false;
        var actions = [];

        for (var i = 0; i < items.length; i++) {
            var model = items[i];
            if (model.view.actions) {
                model.stats = { actions: model.view.actions };
                actions.push(model);
                continue;
            }

            if (!model.view.equip || !model.view.obj.attr)
                continue;

            hasStats = true;
            var melds = model.view.melds;
            model.stats = gt.item.getAttributesViewModel(model.view.obj, melds);

            // Remove useless large prime values for DoH/DoL and glamour equipment.
            if (model.view.obj.patchCategory != 0)
                model.stats.primes = [];

            var amount = model.amount || 1;
            hasBonusMeter = hasBonusMeter || model.stats.hasBonusMeter;
            gt.group.aggregateAttributeList(model.stats.bonuses, sumBonuses, amount);
            gt.group.aggregateAttributeList(model.stats.primes, sumPrimes, amount);

            // Sum materia melded to this item.
            if (melds) {
                for (var ii = 0; ii < melds.length; ii++) {
                    var meld = melds[ii];
                    var meldAggregate = sumMelds[meld.item.id];
                    if (!meldAggregate)
                        sumMelds[meld.item.id] = meldAggregate = { item: meld.item, amount: 0, estimate: 0 };
                    
                    meldAggregate.amount++;
                    meldAggregate.estimate += 100 / (meld.hqRate || 100);
                }
            }
        }

        if (!hasStats)
            return null;

        // Make one more pass through the attributes to catch meld maximums
        // that weren't included.
        for (var i = 0; i < items.length; i++) {
            var model = items[i];
            if (!model.stats)
                continue;

            var obj = model.view.obj;
            for (var attrName in sumBonuses) {
                // Find stats present in our sum but aren't represented by this piece.
                if (_.any(model.stats.bonuses, function(stat) { return stat.key == attrName; }))
                    continue;

                var sumAttr = sumBonuses[attrName];
                if (sumAttr.value_max && obj.attr_max)
                    sumAttr.value_max += obj.attr_max[attrName] || 0;
            }
        }

        // Modify attributes before feeding them to actions.
        var bonuses = _.values(sumBonuses);
        var primes = _.values(sumPrimes);
        var attrs = _.union(bonuses, primes);
        for (var i = 0; i < attrs.length; i++) {
            var attr = attrs[i];

            // Remove max values matching their hq or nq values.
            if (attr.value_meld == attr.value_hq || attr.value_meld == attr.value)
                delete attr.value_meld;

            // Remove hq values matching their nq values.
            if (attr.value_hq == attr.value)
                delete attr.value_hq;

            // Add extra base param values.
            if (gt.group.baseParamValues[attr.key]) {
                var value = gt.group.baseParamValues[attr.key];
                if (value) {
                    attr.value += value;
                    if (attr.value_hq)
                        attr.value_hq += value;
                    if (attr.value_meld)
                        attr.value_meld += value;
                    if (attr.value_max)
                        attr.value_max += value;
                }
            }
        }

        // Sum and sort melds.
        var melds = _.sortBy(_.values(sumMelds), function(m) { return m.item.materia.tier + " " + m.item.name; });
        melds.reverse();

        // Finally aggregate stats from actions.
        for (var i = 0; i < actions.length; i++) {
            var model = actions[i];
            gt.group.aggregateActionList(model.view.actions, sumBonuses, amount);
        }

        // Done!
        bonuses = _.sortBy(bonuses, function(b) { return b.sort; });
        return { bonuses: bonuses, primes: primes, melds: melds, hasBonusMeter: hasBonusMeter };
    },

    aggregateActionList: function(list, sum, amount) {
        for (var i = 0; i < list.length; i++) {
            var attr = list[i];
            var sumAttr = sum[attr.key];
            if (!sumAttr)
                continue; // Nothing to increase.

            var rate = attr.rate_hq / 100;

            sumAttr.value += Math.floor(Math.min(attr.limit_hq, sumAttr.value * rate));
            if (sumAttr.value_meld)
                sumAttr.value_meld += Math.floor(Math.min(attr.limit_hq, sumAttr.value_meld * rate));
            sumAttr.value_hq += Math.floor(Math.min(attr.limit_hq, sumAttr.value_hq * rate));
            sumAttr.value_max += Math.floor(Math.min(attr.limit_hq, sumAttr.value_max * rate));
        }
    },

    aggregateAttributeList: function(list, sum, amount) {
        for (var i = 0; i < list.length; i++) {
            var attr = list[i];
            var sumAttr = sum[attr.key];
            if (!sumAttr) {
                sumAttr = sum[attr.key] = { value: 0, value_hq: 0, value_max: 0, value_meld: 0, name: attr.name, key: attr.key, prime: attr.prime, sort: attr.sort };
            }

            sumAttr.value += attr.value * amount;
            sumAttr.value_hq += (attr.value_hq || attr.value) * amount;
            sumAttr.value_max += (attr.value_max || attr.value_hq || attr.value) * amount;
            sumAttr.value_meld += (attr.value_meld || attr.value_hq || attr.value) * amount;
        }
    },

    aggregateShops: function(items) {
        // First generate a list of purchasable items by NPC.
        var npcs = {};
        for (var i = 0; i < items.length; i++) {
            var block = items[i];
            var itemView = block.view;
            itemView.groupAmount = (block.amount === undefined ? 1 : block.amount); // Record to display in vendor link.

            // Vendors
            if (itemView.vendors) {
                for (var ii = 0; ii < itemView.vendors.length; ii++) {
                    var id = itemView.vendors[ii].id;
                    var list = npcs[id] || (npcs[id] = []);
                    list.push(itemView);
                }
            } else if (itemView.obj.tradeShops) {
                for (var tradeShopIndex = 0; tradeShopIndex < itemView.obj.tradeShops.length; tradeShopIndex++) {
                    var tradeShop = itemView.obj.tradeShops[tradeShopIndex];

                    for (var npcIndex = 0; npcIndex < tradeShop.npcs.length; npcIndex++) {
                        var npcId = tradeShop.npcs[npcIndex];
                        // For now, hardcode a skip on certain NPCs.
                        // To anyone maintaining this in the future: The ultimate
                        // goal is a ranking system for currencies which prefers
                        // renewables like scrips over rare resources.
                        if (npcId == 1027567 || npcId == 1027995)
                            continue;

                        var list = npcs[npcId] || (npcs[npcId] = []);
                        list.push(itemView);
                    }
                }
            }
        }

        // Convert and order a list by the number of items.
        var workingSet = [];
        for (var npcId in npcs)
            workingSet.push({ id: npcId, items: npcs[npcId] });
        workingSet = _.sortBy(workingSet, function(e) { return e.items.length; });

        if (!workingSet.length)
            return null;

        // Filter list to find largest set of discrete items.
        var shops = [];
        while (workingSet.length) {
            // Record the largest shop with items.
            var shop = workingSet.pop();
            if (!shop.items.length)
                continue;

            shop.npc = gt.model.partial(gt.npc, shop.id);
            shops.push(shop);

            // Remove the items in this shop from all the others in the set.
            for (var i = 0; i < workingSet.length; i++) {
                var workingShop = workingSet[i];
                workingShop.items = _.filter(workingShop.items, function(e) { return !_.contains(shop.items, e); });
            }

            // Re-sort the working set.
            workingSet = _.sortBy(workingSet, function(e) { return e.items.length; });
        }

        // Make a pass through shops to calculate currencies for these NPCs.
        var currency = {};
        for (var shopIndex = 0; shopIndex < shops.length; shopIndex++) {
            var shop = shops[shopIndex];
            for (var itemIndex = 0; itemIndex < shop.items.length; itemIndex++) {
                var itemView = shop.items[itemIndex];
                
                if (itemView.vendors) {
                    var cost = itemView.groupAmount * itemView.price;
                    currency[1] = (currency[1] || 0) + cost;
                } else if (itemView.obj.tradeShops) {
                    var tradeShop = _.find(itemView.obj.tradeShops, function(s) { return _.contains(s.npcs, shop.npc.id); });
                    var listing = tradeShop.listings[0];
                    var rewardListing = _.find(listing.item, function(listingItem) { return listingItem.id == itemView.id; });

                    itemView.groupTradeSource = listing;
                    for (var currencyIndex = 0; currencyIndex < listing.currency.length; currencyIndex++) {
                        var currencyListing = listing.currency[currencyIndex];
                        currencyListing.obj = gt.model.partial(gt.item, currencyListing.id);
                        var amount = currencyListing.amount * (block.amount || 1) / rewardListing.amount;
                        var currentAmount = currency[currencyListing.id] || 0;
                        // Mobile Safari is injecting weird NaNs for index 0 and 2 here.  No idea why.
                        currency[currencyListing.id] = currentAmount + amount;
                    }
                }
            }
        }

        // Convert currencies.
        var currencyList = [];
        for (var key in currency) {
            var amount = currency[key];
            if (amount)
                currencyList.push({ currency: gt.model.partial(gt.item, key), amount: amount });
        }

        return { vendors: shops, currency: currencyList };
    },

    setup: function(name, $from, callback) {
        gt.core.activate('group', name, $from, function($group) {
            var groupData = $group.data('block');
            groupData.activePage = 'crafting-page';

            callback(groupData);

            gt.core.redisplay($group);
            gt.core.activate('group', name); // Once more to capture the new data.
        });
    },

    contentLinkClicked: function(e) {
        e.stopPropagation();

        var $this = $(this);
        var $group = $this.closest('.block');
        var type = $this.data('type');
        var id = $this.data('id');

        var existingBlock = gt.list.getBlockData(type, id);
        if (!existingBlock) {
            // Create a new block with data from this group contents.
            var data = $group.data('block');
            var block = _.find(data.blocks, function(b) { return b.type == type && b.id == id; });
            if (!block)
                return;

            gt.list.current.push(block);
        }

        gt.core.activate(type, id, $group);
    }
};
