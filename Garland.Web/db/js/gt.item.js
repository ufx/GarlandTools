gt.item = {
    // Data
    pluralName: 'Items',
    type: 'item',
    blockTemplate: null,
    halfLinkTemplate: null,
    attributeValueTemplate: null,
    materiaSelectTemplate: null,
    materiaSocketsTemplate: null,
    vendorLinkTemplate: null,
    categoryIndex: null,
    equipSlotNames: [null, 'Main Hand', 'Off Hand', 'Head', 'Body', 'Hands', 'Waist', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrists', 'Rings', 'Main Hand', 'Main Hand', null, null, 'Soul Crystal'],
    specialBonusIndex: null,
    seriesIndex: null,
    index: {},
    partialIndex: {},
    ingredients: {},
    complexity: {},
    version: 3,
    itemPrimeKeys: ['Defense', 'Magic Defense', 'Physical Damage', 'Magic Damage', 'Auto-attack', 'Delay', 'Block Rate', 'Block Strength'],
    minionPrimeKeys: ['HP', 'Attack', 'Defense', 'Speed'],
    mainAttributeKeys: { Strength: 1, Dexterity: 1, Vitality: 1, Intelligence: 1, Mind: 1 },
    baseParamAbbreviations: {
        'Magic Damage': 'Damage',
        'Physical Damage': 'Damage',
        'Reduced Durability Loss': 'Red. Dur. Loss',
        'Increased Spiritbond Gain': 'Inc. Spr. Gain',
        'Careful Desynthesis': 'C. Desynthesis',
        'Critical Hit Rate': 'Critical Rate'
    },
    nqMateriaMeldRates = [
        // Sockets
        //2, 3,  4,  5      // Tier
        [40, 20, 10, 5],    // I
        [36, 18, 9,  5],    // II
        [30, 15, 8,  4],    // III
        [24, 12, 6,  3],    // IV
        [12, 6,  3,  2],    // V
        [12, 0,  0,  0]     // VI
    ],
    hqMateriaMeldRates = [
        // Sockets
        //2, 3,  4,  5     // Tier
        [45, 24, 14, 8],   // I
        [41, 22, 13, 8],   // II
        [35, 19, 11, 7],   // III
        [29, 16, 10, 6],   // IV
        [17, 10, 7,  5],   // V
        [17, 0,  0,  0]    // VI
    ],
    browse: [ { type: 'sort', prop: 'name' } ],
    
    // Functions
    initialize: function(data) {
        gt.item.blockTemplate = doT.template($('#block-item-template').text());
        gt.item.halfLinkTemplate = doT.template($('#half-link-item-template').text());
        gt.item.attributeValueTemplate = doT.template($('#attribute-value-template').text());
        gt.item.materiaSocketsTemplate = doT.template($('#materia-sockets-template').text());
        gt.item.vendorLinkTemplate = doT.template($('#vendor-item-link-template').text());
    },

    cache: function(data) {
        gt.item.index[data.item.id] = data.item;
        _.each(data.ingredients, function(i) { gt.item.ingredients[i.id] = i; });
    },

    bindEvents: function($block, data, view) {
        $('select.recipe-select', $block).change(gt.item.recipeChanged);
        $('.sources-uses-page input[type=checkbox]', $block).click(gt.item.sourceClicked);
        gt.craft.bindEvents($block, data, view);

        if (view.sourceType) {
            var selector = '.sources-uses-page div.source-link[data-id=' + view.sourceId + '][data-type=' + view.sourceType + '] input[type=checkbox]';
            $(selector, $block).attr('checked', 'checked');
        }

        $('.copy-recipe', $block).click(gt.item.copyRecipeClicked);
        $('.new-group', $block).click(gt.item.newGroupClicked);
        $('.materia .socket', $block).click(gt.item.materiaSocketClicked);
        $('.market-price', $block).change(gt.item.marketPriceChanged);
        $block.bind('page-loaded', gt.item.menuPageLoaded);
    },

    getViewModel: function(item, data) {
        var itemCategory = gt.item.categoryIndex[item.category];

        var view = {
            obj: item,
            id: item.id,
            type: 'item',
            name: item.name,
            nameClass: item.rarity ? 'rarity' + item.rarity : '',
            patch: gt.formatPatch(item.patch),
            patchCategory: gt.patch.categoryIndex[item.patchCategory],
            template: gt.item.blockTemplate,
            icon: gt.item.iconPath(item.icon),
            iconBorder: 1,
            subheader: 'Item Level ' + item.ilvl,
            settings: 1,

            help: item.description,
            tooltip: item.tooltip,
            ilvl: item.ilvl,
            convertable: item.convertable,
            desynthSkill: item.desynthSkill,
            reducible: item.reducible,
            crestworthy: item.crestworthy,
            glamourous: item.glamourous,
            untradeable: !item.tradeable,
            dyeable: item.dyeable,
            unique: item.unique,
            sell_price: item.sell_price,
            price: item.price,
            sockets: item.sockets,
            category: itemCategory ? itemCategory.name : '???',
            delivery: item.delivery,
            storable: item.storable,
            equip: item.equip,
            unlistable: item.unlistable,
            advancedMeldingForbidden: item.advancedMeldingForbidden,
            tripletriad: item.tripletriad,
            supply: item.supply,
            customize: item.customize,
            rarity: item.rarity,
            mount: item.mount,
            slot: item.slot,
            models: item.models,
            jobs: item.jobCategories
        };

        view.sourceName = view.name;

        if (item.category == 81)
            view.minion = 1;

        if (!data)
            return view;

        var itemSettings = gt.settings.getItem(item.id);

        // Repairs
        if (item.repair)
            view.repair_job = gt.jobs[item.repair].name;

        // Equipment information
        if (item.equip) {
            view.elvl = item.elvl;
            view.repair_lvl = Math.max(1, item.elvl - 10);
            view.repair_price = item.repair_price;

            if (item.repair_item)
                view.repair_item = gt.model.partial(gt.item, item.repair_item);

            if (item.sockets)
                view.meld_lvl = item.elvl;

            if (item.sharedModels)
                view.sharedModels = gt.model.partialList(gt.item, item.sharedModels);
        }

        // Materia
        if (item.materia)
            view.materia = { tier: item.materia.tier + 1, value: item.materia.value, attr: item.materia.attr };

        // Initialize materia.
        if (item.sockets && !gt.item.materia) {
            view.melds = [];
            if (data.melds) {
                view.melds = _.map(data.melds, function(id) {
                    var meldView = { item: gt.model.partial(gt.item, id) };
                    meldView.text = meldView.item.name.replace(" Materia", "");
                    return meldView;
                });
            }
        }

        // Jobs
        if (item.jobs) //  todo: remove 1/15
            view.jobs = gt.jobCategories[item.jobs].name;

        // Bonuses
        if (item.attr) {
            var attrs = gt.item.getAttributesViewModel(item, view.melds);
            if (attrs.primes.length) {
                view.hasPrimes = true;
                for (var i = 0; i < attrs.primes.length; i++) {
                    var attr = attrs.primes[i];
                    view[attr.key] = attr;
                }
            }

            if (attrs.bonuses.length)
                view.bonuses = attrs.bonuses;

            if (attrs.hasBonusMeter)
                view.hasBonusMeter = true;

            // Melds reduced to caps, finish info.
            if (view.melds) {
                for (var i = 0; i < view.melds.length; i++) {
                    var meld = view.melds[i];

                    var parts = [];
                    if (meld.reduced !== undefined)
                        parts.push('+' + meld.reduced + ' of ' + meld.item.materia.value);
                    else
                        parts.push('+'  + meld.item.materia.value);

                    if (i >= item.sockets)
                        parts.push(meld.nqRate + ' - ' + meld.hqRate + '%');

                    meld.info = parts.join(', ');
                }
            }
        }

        // Special Bonuses
        if (item.special) {
            var specialBonus = gt.item.specialBonusIndex[item.special.bonusId];
            view.special = {
                name: specialBonus ? specialBonus.name : "Unknown Bonus",
                isSet: item.special.bonusId == 2 || item.special.bonusId == 6,
                attr: []
            };

            if (item.special.seriesId) {
                var series = gt.item.seriesIndex[item.special.seriesId];
                if (series)
                    view.special.series = series.name;
            }

            if (item.special.bonusParam && item.special.bonusId == 6)
                view.special.condition = 'Active Under Lv. ' + item.special.bonusParam;

            for (var i = 0; i < item.special.attr.length; i++) {
                var bonus = item.special.attr[i];
                view.special.attr.push({
                    prefix: view.special.isSet ? (bonus.index + 2 + ' Equipped:') : '',
                    name: bonus.name,
                    value: bonus.value < 0 ? bonus.value : '+' + bonus.value
                });
            }
        }

        // Actions
        if (item.attr && item.attr.action) {
            view.actions = [];
            var action_hq = item.attr_hq ? item.attr_hq.action : null;
            for (var key in item.attr.action) {
                var action = gt.item.formatAttribute(key, item.attr.action, action_hq, null, 0, gt.item.itemPrimeKeys);
                action.action = 1;
                view.actions.push(action);
            }
        }

        // Ingredients of
        if (item.ingredient_of) {
            var ingredient_of = [];
            _.each(_.pairs(item.ingredient_of), function(pair) {
                var itemInfo = gt.model.partial(gt.item, pair[0]);
                if (itemInfo)
                    ingredient_of.push({i: itemInfo.id, icon: itemInfo.icon, n: itemInfo.name, a: pair[1]});
            });

            if (ingredient_of.length)
                view.ingredient_of = _.sortBy(ingredient_of, function(i) { return i.n; });
        }

        gt.item.fillShops(view, item);

        // Nodes
        if (item.nodes)
            view.nodes = gt.model.partialList(gt.node, item.nodes);

        // Drops
        if (item.drops) {
            view.drops = gt.model.partialList(gt.mob, item.drops);
            view.drops = _.sortBy(view.drops, function(m) { return (m.quest ? 'zz' : '') + m.name; });
        }

        // Instances
        if (item.instances) {
            view.instances = gt.model.partialList(gt.instance, item.instances);
            view.instances = _.sortBy(view.instances, function(i) { return i.name; });
        }

        // Quest Rewards
        if (item.quests)
            view.quests = gt.model.partialList(gt.quest, item.quests);

        // Leves
        if (item.leves) {
            view.leves = gt.model.partialList(gt.leve, item.leves);
            view.leves = _.sortBy(view.leves, function(l) { return l.lvl + ' ' + l.location + ' ' + l.name; });
        }

        // Fishing Spots
        if (item.fishingSpots)
            view.fishingSpots = gt.model.partialList(gt.fishing, item.fishingSpots);

        // Crafts
        var set = null;
        if (item.craft) {
            set = new gt.craft.set('', [{item: item, amount: 1}]);
            if (data.craft)
                set.load(data.craft);
            set.sort();

            view.craft = set.groups.goal[0].craft;

            if (view.craft.special)
                view.crafterSoul = gt.model.partial(gt.item, view.craft.special);

            view.crafts = item.craft;
            view.craftSet = set;

            set.tree = data.craftTree;
            set.amounts = data.craftAmount;

            if (view.craft.unlockId)
                view.unlockItem = gt.model.partial(gt.item, view.craft.unlockId);
        }

        // Other unlocks
        if (item.unlockId)
            view.unlockItem = gt.model.partial(gt.item, item.unlockId);

        // Used in Quests
        if (item.usedInQuest)
            view.usedInQuest = gt.model.partialList(gt.quest, item.usedInQuest);

        // Unlocks
        if (item.unlocks)
            view.unlocks = gt.model.partialList(gt.item, item.unlocks);

        // Leve Requirements
        if (item.requiredByLeves)
            view.requiredByLeves = gt.model.partialList(gt.leve, item.requiredByLeves);

        // Desynthesis
        if (view.desynthSkill) {
            view.rlvl = set ? set.groups.goal[0].craft.rlvl : item.ilvl;
            view.desynth_job = view.repair_job;
        }

        // Ventures
        if (item.ventures)
            view.ventures = gt.model.partialList(gt.venture, item.ventures);

        // Treasure Map Loot
        if (item.loot)
            view.loot = gt.model.partialList(gt.item, item.loot);

        // Aetherial Reduction
        view.reduceTotal = 0;

        if (item.reducedFrom) {
            view.reducedFrom = gt.model.partialList(gt.item, item.reducedFrom);
            view.reduceTotal += view.reducedFrom.length;
        }

        if (item.reducesTo) {
            view.reducesTo = gt.model.partialList(gt.item, item.reducesTo);
            view.reduceTotal += view.reducesTo.length;
        }

        // Other Sources
        if (item.bingoReward)
            view.other = _.union(view.other, [gt.model.partial(gt.item, 'wondroustails')]);

        if (item.desynthedFrom && item.desynthedFrom.length)
            view.other = _.union(view.other, gt.model.partialList(gt.item, item.desynthedFrom, function(v) { v.right = 'Desynthesis'; return v; }));

        if (item.achievements)
            view.other = _.union(view.other, _.map(gt.model.partialList(gt.achievement, item.achievements), function(i) { return $.extend(i, {right: 'Achievement'}); }));

        if (item.voyages)
            view.other = _.union(view.other, _.map(item.voyages, function(s) { return { name: s, icon: 'images/Voyage.png', right: 'Voyage' }; }));

        if (item.treasure)
            view.other = _.union(view.other, _.map(gt.model.partialList(gt.item, item.treasure), function(i) { return $.extend(i, {right: 'Loot'}); }));

        if (item.fates)
            view.other = _.union(view.other, gt.model.partialList(gt.fate, item.fates));

        // Rowena Masterpiecces
        if (item.masterpiece) {
            view.masterpiece = item.masterpiece;
            view.masterpiece.rewardItem = gt.model.partial(gt.item, item.masterpiece.reward);
            view.masterpiece.rewardAmountBonus =  _.map(item.masterpiece.rewardAmount, function(a) { return Math.floor(a * 1.2); });
            view.masterpiece.xpBonus = _.map(item.masterpiece.xp, function(x) { return Math.floor(x * 1.2); });
            if (view.craft && view.craft.complexity) {
                view.masterpiece.complexity = view.craft.complexity.hq;
                view.masterpiece.efficiencyScore = gt.item.efficiencyScore(item.masterpiece.rewardAmount[item.masterpiece.rewardAmount.length-1], view.masterpiece.complexity);
            }
        }

        if (item.supplyReward) {
            var supplyReward = _.map(item.supplyReward, function(r) {
                return {
                    job: gt.jobs[r.job],
                    complexity: r.complexity,
                    reward: r.reward[0],
                    rating: r.rating,
                    item: gt.model.partial(gt.item, r.item),
                    efficiencyScore: gt.item.efficiencyScore(r.reward[r.reward.length-1], r.complexity)
                };
            });

            view.supplyReward = _.sortBy(supplyReward, 'efficiencyScore').reverse();
        }

        // Satisfaction
        if (item.satisfaction) {
            view.satisfaction = [];
            for (var i = 0; i < item.satisfaction.length; i++) {
                var satisfaction = item.satisfaction[i];
                view.satisfaction.push({
                    npc: gt.model.partial(gt.npc, satisfaction.npc),
                    rating: satisfaction.rating,
                    probability: satisfaction.probability,
                    items: gt.model.partialList(gt.item, satisfaction.items, function(v, i) { v.amount = i.amount; return v; }),
                    gil: satisfaction.gil,
                    satisfaction: satisfaction.satisfaction,
                    level: satisfaction.level
                });
            }
        }

        // Triple Triad Reward From
        if (item.tripletriad && item.tripletriad.rewardFrom)
            view.tripletriadReward = gt.model.partialList(gt.npc, item.tripletriad.rewardFrom);

        // Upgrades
        var progressionParts = [];
        if (item.upgrades) {
            view.upgrades = gt.model.partialList(gt.item, item.upgrades);
            progressionParts.push(item.upgrades.length + '▲');
        }

        if (item.downgrades) {
            view.downgrades = gt.model.partialList(gt.item, item.downgrades);
            progressionParts.push(item.downgrades.length + '▼');
        }

        if (progressionParts.length)
            view.progressionText = progressionParts.join('  ');

        // Source data
        if (itemSettings.sourceType) {
            view.sourceType = itemSettings.sourceType;
            view.sourceId = itemSettings.sourceId;
        }
        
        // Marketboard price
        if (itemSettings.marketPrice) {
            view.marketPrice = itemSettings.marketPrice;

            if (itemSettings.sourceType == 'market')
                view.marketType = 'Buying';
            else
                view.marketType = 'Selling';
        }

        // Minion
        if (view.minion) {
            view.specialAction = item.specialactionname;
            view.specialActionDesc = item.specialactiondescription;
            view.minionRace = item.minionrace;
            view.minionSkillType = item.minionskilltype;
            view.strengths = (item.strengths && item.strengths.length) ? item.strengths.join(', ') : 'None';
            view.specialActionAngle = item.skill_angle;
        }

        // Bingo
        if (item.bingoData) {
            view.bingoData = [];
            for (var i = 0; i < item.bingoData.length; i++) {
                var list = item.bingoData[i];
                var viewList = { name: list.name, rewards: [] };
                for (var ii = 0; ii < list.rewards.length; ii++) {
                    var options = _.map(list.rewards[ii], function(o) { return { item: gt.model.partial(gt.item, o.item), amount: o.amount, hq: o.hq }; });
                    viewList.rewards.push(options);
                }
                view.bingoData.push(viewList);
            }
        }

        // Fishing
        if (item.fish) {
            view.fish = {
                guide: item.fish.guide,
                icon: '../files/icons/fish/' + item.fish.icon + '.png',
                spots: item.fish.spots ? [] : null,
                folklore: item.fish.folklore ? gt.model.partial(gt.item, item.fish.folklore) : null,
                groups: []
            };

            if (item.fish.spots) {
                for (var i = 0; i < item.fish.spots.length; i++) {
                    var spot = item.fish.spots[i];

                    // Group fishing spots by bait chain.
                    var group = null;
                    if (spot.bait || !spot.gig) {
                        group = _.find(view.fish.groups, function(g) { return _.isEqual(g.baitIds, spot.bait); });
                        view.fish.predatorType = 'Predator';
                    }
                    else {
                        group = _.find(view.fish.groups, function(g) { return _.isEqual(g.gig, spot.gig); });
                        view.fish.predatorType = 'Shadows';
                    }

                    if (!group) {
                        group = {
                            baitIds: spot.bait,
                            bait: spot.bait ? gt.model.partialList(gt.item, spot.bait) : null,
                            gig: spot.gig,
                            spots: []
                        };

                        view.fish.groups.push(group);
                    }

                    // Push common conditions up to the main fish view.
                    view.fish.during = spot.during;
                    view.fish.transition = spot.transition;
                    view.fish.weather = spot.weather;
                    view.fish.hookset = spot.hookset;
                    view.fish.gatheringReq = spot.gatheringReq;
                    view.fish.snagging = spot.snagging;
                    view.fish.fishEyes = spot.fishEyes;

                    if (spot.hookset) {
                        if (spot.hookset == "Powerful Hookset")
                            view.fish.hooksetIcon = 1115;
                        else
                            view.fish.hooksetIcon = 1116;
                    }

                    if (spot.predator) 
                        view.fish.predator = gt.model.partialList(gt.item, spot.predator, function(v, p) { return { item: v, amount: p.amount }; });

                    // List spots beneath the group.
                    var spotView = { };
                    if (spot.spot) {
                        spotView.spot = gt.model.partial(gt.fishing, spot.spot);
                        spotView.spotType = 'fishing';
                    } else if (spot.node) {
                        spotView.spot = gt.model.partial(gt.node, spot.node);
                        spotView.spotType = 'node';
                    }
                    group.spots.push(spotView);
                }
            }
        }

        // Disposal
        if (item.disposal) {
            view.disposal = [];
            for (var i = 0; i < item.disposal.length; i++) {
                var entry = $.extend({}, item.disposal[i]);
                entry.item = gt.model.partial(gt.item, entry.item);
                entry.npcs = gt.model.partialList(gt.npc, entry.npcs);
                view.disposal.push(entry);
            }
        }

        // Orchestrion
        if (item.orchestrion) {
            view.orchestrion = {
                name: item.orchestrion.name,
                description: item.orchestrion.description,
                category: item.orchestrion.category,
                path: '../files/orchestrion/' + item.orchestrion.id + '.ogg',
                order: gt.util.zeroPad(item.orchestrion.order, 3)
            };
        }

        // Stats
        view.hasStats = (view.fish || view.equip || view.actions || view.bonuses || view.special || view.upgrades
            || view.downgrades || view.sharedModels || view.minion || view.tripletriad || view.mount
            || view.desynthSkill);
        view.hasSourcesUses = (view.vendors || view.drops || view.nodes || view.fishingSpots || view.instances
            || view.trades || view.quests || view.leves || view.ventures || view.requiredByLeves
            || view.unlocks || view.usedInQuest || view.ingredient_of || view.loot
            || view.masterpiece || view.supply || view.delivery || view.bingoData || view.other
            || view.satisfaction || view.customize || view.reducedFrom || view.disposal || view.tripletriadReward
            || view.sell_price || view.supplyReward || (!view.unlistable && !view.untradeable) || view.reducesTo);

        return view;
    },

    efficiencyScore: function(reward, complexity) {
        return Math.floor(1500 * reward / complexity);
    },

    fillShops: function(view, item) {
        // Vendors
        if (item.vendors)
            view.vendors = gt.model.partialList(gt.npc, item.vendors);

        // Traders
        if (item.tradeCurrency || item.tradeShops) {
            var trades = _.union(item.tradeCurrency, item.tradeShops);
            view.trades = [];
            for (var i = 0; i < trades.length; i++) {
                var entry = trades[i];
                view.trades.push({
                    shop: entry.shop,
                    npcs: gt.model.partialList(gt.npc, entry.npcs),
                    listings: _.map(entry.listings, gt.npc.getTradeViewModel)
                });
            }
        }
    },

    formatAttribute: function(key, obj, obj_hq, obj_max, meld, primeKeys) {
        var value = obj[key];
        var maxValue = obj_max ? obj_max[key] : null;

        var attr = {
            key: key,
            name: gt.item.baseParamName(key),
            value: value || 0,
            value_hq: obj_hq ? (obj_hq[key] || 0) : 0,
            value_max: maxValue,
            value_meld: meld,
            meter: 0,
            meldMeter: 0,
            prime: _.contains(primeKeys, key),
            mainAttribute: gt.item.mainAttributeKeys[key]
        };

        attr.sort = (attr.mainAttribute ? 'a' : 'b') + key;

        if (attr.value && typeof(attr.value) == 'object') {
            attr.rate = attr.value.rate;
            attr.limit = attr.value.limit;
        }

        if (attr.value_hq && typeof(attr.value_hq) == 'object') {
            attr.rate_hq = attr.value_hq.rate;
            attr.limit_hq = attr.value_hq.limit;
        }

        if (attr.value_hq && !attr.value_max)
            attr.value_max = attr.value_hq;

        if (meld)
            attr.value_meld += attr.value_hq || attr.value;

        return attr;
    },

    getAttributesViewModel: function(item, melds) {
        var bonuses = [];
        var primes = [];
        var hasBonusMeter = false;
        var minion = item.category == 81;
        var primeKeys = minion ? gt.item.minionPrimeKeys : gt.item.itemPrimeKeys;

        var meldKeys = melds ? _.map(melds, function(m) { return m.item.materia.attr; }) : [];
        var keys = _.unique(_.union(_.keys(item.attr), _.keys(item.attr_hq), meldKeys)).sort();
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (key == 'action' || key == 'Magic Damage' || key == 'Physical Damage' || key == 'Auto-attack')
                continue; // Skip this bag, and mutually exclusive damage attributes.

            if (minion && key == 'Speed')
                continue; // Done later.

            // Calculate melds
            var attr_meld = undefined;
            if (melds) {
                var value = item.attr[key] || 0;
                var value_hq = item.attr_hq ? (item.attr_hq[key] || 0) : 0;
                var value_max = item.attr_max[key] || value_hq;
                for (var ii = 0; ii < melds.length; ii++) {
                    var meld = melds[ii];
                    var materia = meld.item.materia;
                    if (ii >= item.sockets) {
                        meld.nqRate = gt.item.nqMateriaMeldRates[materia.tier][ii - item.sockets];
                        meld.hqRate = gt.item.hqMateriaMeldRates[materia.tier][ii - item.sockets];
                        meld.overmeld = 1;
                    }

                    if (key == materia.attr) {
                        if (meld.overmeld && (!meld.nqRate || !meld.hqRate)) {
                            // Skip melds with a 0% join rate.
                            meld.reduced = 0;
                            continue;
                        }

                        if (attr_meld === undefined)
                            attr_meld = 0;

                        var remaining = value_max ? (value_max - Math.max(value, value_hq) - attr_meld) : 0;
                        if (materia.value > remaining) {
                            attr_meld += remaining;
                            meld.reduced = remaining;
                        } else {
                            attr_meld += materia.value;
                            delete meld.reduced;
                        }
                    }
                }
            }

            var attr = gt.item.formatAttribute(key, item.attr, item.attr_hq, item.attr_max, attr_meld, primeKeys);
            if (attr.prime)
                primes.push(attr);
            else {
                bonuses.push(attr);
                hasBonusMeter = hasBonusMeter || attr.value_hq || attr.value_max;
            }
        }

        if (minion) {
            var speed = gt.item.formatAttribute('Speed', item.attr, null, null, 0, primeKeys);
            speed.stars = 1;
            primes.push(speed);
        }

        var itemCategory = gt.item.categoryIndex[item.category];
        if (itemCategory && (item.attr["Physical Damage"] || item.attr["Magic Damage"])) {
            var dmgKey = itemCategory.attr;
            primes.push(gt.item.formatAttribute(dmgKey, item.attr, item.attr_hq, item.attr_max, 0, primeKeys));
        }

        if (item.attr["Physical Damage"]) {
            item.attr["Auto-attack"] = gt.item.calculateAutoAttack(item.attr["Physical Damage"], item.attr.Delay);
            if (item.attr_hq)
                item.attr_hq["Auto-attack"] = gt.item.calculateAutoAttack(item.attr_hq["Physical Damage"], item.attr.Delay);
            primes.push(gt.item.formatAttribute('Auto-attack', item.attr, item.attr_hq, item.attr_max, 0, primeKeys));
        }

        bonuses = _.sortBy(bonuses, function(b) { return b.sort; });
        return { bonuses: bonuses, primes: primes, hasBonusMeter: hasBonusMeter };
    },

    calculateAutoAttack: function(dmg, delay) {
        return gt.util.floor2(delay / 3 * dmg);
    },

    marketPriceChanged: function(e) {
        var $this = $(this);
        var $block = $this.closest('.block');
        var data = $block.data('block');

        var itemSettings = gt.settings.getItem(data.id);
        itemSettings.marketPrice = parseInt($this.val());
        if (!itemSettings.marketPrice)
            delete itemSettings.marketPrice;

        gt.settings.setItem(data.id, itemSettings);

        gt.item.redisplayUses(data.id);
        gt.core.redisplay($block);
    },

    recipeChanged: function(e) {
        var $this = $(this);
        var $block = $this.closest('.block');
        var data = $block.data('block');

        var itemSettings = gt.settings.getItem(data.id);
        itemSettings.recipe = parseInt($this.val());
        gt.settings.setItem(data.id, itemSettings);
        
        gt.core.redisplay($block);
        gt.item.redisplayUses(data.id);
    },

    sourceClicked: function(e) {
        // Prevents block link click event from triggering.
        e.stopPropagation();

        var $this = $(this);
        var isChecked = $this.is(':checked');

        var $link = $this.closest('.source-link');
        var $block = $link.closest('.block');
        var id = $block.data('id');
        var sourceId = $link.data('id');
        var sourceType = $link.data('type');

        var itemSettings = gt.settings.getItem(id);
        if (isChecked) {
            itemSettings.sourceType = sourceType;
            itemSettings.sourceId = sourceId;

            // Uncheck the other boxes.
            $('.sources-uses-page input[type=checkbox]', $block).not($this).attr('checked', false);

        } else {
            delete itemSettings.sourceType;
            delete itemSettings.sourceId;
        }

        gt.settings.setItem(id, itemSettings);
        gt.item.redisplayUses(id);

        if (sourceType == 'market')
            gt.core.redisplay($block);
    },

    redisplayUses: function(id) {
        var $uses = $('.recipe.subsection .block-link[data-id=' + id + '][data-type=item]').closest('.block');
        for (var i = 0; i < $uses.length; i++) {
            var $useBlock = $($uses[i]);
            gt.core.redisplay($useBlock);
        }
    },

    getPartialViewModel: function(partial) {
        var name = gt.model.name(partial);
        var itemCategory = gt.item.categoryIndex[partial.t];

        var view = {
            icon: gt.item.iconPath(partial.c),
            name: name,
            sourceName: name,
            id: partial.i,
            type: 'item',
            byline: 'iLv. ' + partial.l + ' ' + (itemCategory ? itemCategory.name : '???')
        };

        if (partial.p)
            view.price = partial.p;
        if (partial.materia)
            view.materia = partial.materia;

        return view;
    },

    iconPath: function(iconId) {
        return '../files/icons/item/' + iconId + '.png';
    },

    isCrystal: function(item) {
        return item.category == 59;
    },

    materiaChanged: function(e) {
        e.stopPropagation();

        var $popover = $('#popover-container');
        var $container = $popover.data('container');
        if (!$container)
            return false;

        $popover.removeData('container');

        var materiaId = $(this).data('id');

        var data = $container.data('block');
        if (!data.melds)
            data.melds = [];

        // Replace the old materia, or add to the current slot.
        var number = $popover.data('number');
        if (data.melds[number]) {
            if (materiaId)
                data.melds[number] = materiaId;
            else
                data.melds.splice(number, 1);
        } else if (materiaId)
            data.melds.push(materiaId);

        // Sort by tier, then name if applicable.
        if (gt.settings.data.sortMelds) {
            data.melds = _.sortBy(data.melds, function(id) {
                var item = gt.item.partialIndex[id];
                return item.materia.tier + "-" + item.n;
            }).reverse();
        }

        // Dismiss popover and redisplay.
        $('#popover-dismiss').click();

        var $block = $container.closest('.block');
        var $newBlock = gt.core.redisplay($block);
        if ($block.is('.active'))
            gt.core.setHash($block);

        gt.settings.saveDirty();

        return false;
    },

    materiaFilterClicked: function(e) {
        var $this = $(this);
        var $materiaSelect = $this.closest('.materia-select');
        $('.filters img.active').removeClass('active');
        $this.addClass('active');

        var $activeFilters = $('.filters img.active', $materiaSelect);
        var activeFilters = _.map($activeFilters, function(img) { return '.attribute-group.' + $(img).data('category'); }).join(', ');

        $('.attribute-group', $materiaSelect).hide();
        $(activeFilters, $materiaSelect).show();
    },

    materiaSocketClicked: function(e) {
        if (!gt.item.materiaSelectTemplate) {
            var template = doT.template($('#materia-select-template').text());
            var materiaItems = _.filter(_.values(gt.item.partialIndex), function(i) { return i.materia; });
            materiaItems = _.map(materiaItems, function(i) {
                var view = gt.model.partial(gt.item, i.i);
                view.text = view.name.replace(" Materia", "");
                return view;
            });
            var materiaGroups = _.groupBy(materiaItems, function(i) { return i.materia.attr; });
            gt.item.materiaSelectTemplate = template(materiaGroups);
        }

        var $this = $(this);
        var number = $this.data('number');
        var $block = $this.closest('.block, .block-stats');
        var view = $block.data('view');

        var $materiaSelect = $(gt.item.materiaSelectTemplate);
        $('.materia', $materiaSelect).click(gt.item.materiaChanged);
        $('.filters img', $materiaSelect).click(gt.item.materiaFilterClicked);

        var $popover = gt.display.popover($materiaSelect, 'position-center');
        $popover.data('container', $block);
        $popover.data('number', number);

        // Set the active category.
        $('.filters img.category' + view.obj.patchCategory, $materiaSelect).click();

        // Show meld cap info on each materia category.
        for (var i = 0; i < view.bonuses.length; i++) {
            var bonus = view.bonuses[i];
            var max = bonus.value_max || bonus.value_hq || bonus.value_meld || bonus.value;
            var melded = bonus.value_meld || 0;
            var nq = bonus.value || 0;
            var hq = bonus.value_hq || bonus.value_meld || nq;

            var nqcap = max - nq;
            if (melded)
                nqcap -= (melded - nq);

            var hqcap = max - hq;

            var capText = 'max';
            if (nqcap || hqcap) {
                var parts = ['+' + nqcap + " nq"];
                if (!hqcap)
                    parts.push('hq max');
                else if (nqcap == hqcap)
                    parts[0] += ' / hq';
                else
                    parts.push('+' + hqcap + " hq");
                capText = parts.join(', ');
            }

            $('.attribute-group[data-baseparam="' + bonus.key + '"] .cap', $materiaSelect).text(capText);
        }

        // Highlight current materia.
        var meld = view.melds[number];
        if (meld)
            $('.materia[data-id=' + meld.item.id + ']', $materiaSelect).addClass('current');
    },

    copyRecipeClicked: function(e) {
        var $this = $(this);
        var $block = $this.closest('.block');

        var $recipeText = $('.recipe-text', $block);
        if ($recipeText.length) {
            $recipeText.remove();
            gt.list.layout();
            return;
        }

        var view = $block.data('view');

        $recipeText = $('<textarea class="recipe-text"></textarea>');
        $recipeText.text(view.craftSet.print());

        $('.craftinfo.subsection', $block).append($recipeText);
        $recipeText.select();

        gt.list.layout();
    },

    newGroupClicked: function(e) {
        var $block = $(this).closest('.block');
        gt.group.setup('Crafting List', $block, function(groupData) {
            var blockData = $.extend({}, $block.data('block'));
            gt.group.insertGroupCore(blockData, groupData);
        });
    },

    baseParamName: function(name) {
        var n = gt.item.baseParamAbbreviations[name];
        return n ? n : name.replace('Resistance', 'Res.');
    },

    findSimplestTradeSource: function(item, traderId) {
        if (!item.tradeShops)
            return null;

        if (traderId) {
            for (var i = 0; i < item.tradeShops.length; i++) {
                var shop = item.tradeShops[i];
                if (_.contains(shop.npcs, traderId))
                    return shop.listings[0];
            }
        }

        // Prefer GC seal trades first.
        var gcTrade = gt.item.findTrade(item.tradeShops, function(itemId, type) {
            return type == 'currency' && (itemId == 20 || itemId == 21 || itemId == 22);
        });
        
        if (gcTrade)
            return gcTrade;

        // Fallback to the first listed trade.
        return item.tradeShops[0].listings[0];
    },

    findTrade: function(tradeList, predicate) {
        for (var i = 0; i < tradeList.length; i++) {
            var shop = tradeList[i];
            for (var ii = 0; ii < shop.listings.length; ii++) {
                var listing = shop.listings[ii];
                for (var iii = 0; iii < listing.item.length; iii++) {
                    if (predicate(listing.item[iii].id, 'reward'))
                        return listing;
                }
                for (var iii = 0; iii < listing.currency.length; iii++) {
                    if (predicate(listing.currency[iii].id, 'currency'))
                        return listing;
                }
            }
        }

        return null;
    },

    setBlockExpansion: function($block, data) {
        // This function may be called for a group too.  No worries.
        var isExpanded = false;
        
        if (data.craftAmount)
            isExpanded = true;
        else if (data.activePage == 'models-page')
            isExpanded = true;

        $block.toggleClass('expanded', isExpanded ? true : false);
    },

    menuPageLoaded: function(e) {
        var $block = $(e.currentTarget);
        var $page = $('.models-page', $block);
        var isViewerInjected = $page.data('viewer-injected');
        if (e.page != 'models-page') {
            if (isViewerInjected) {
                $page.empty();
                $page.data('viewer-injected', false);
            }

            gt.item.setBlockExpansion($block, $block.data('block'));
            return;
        }

        if (!isViewerInjected) {
            var $modelViewers = $('iframe.model-viewer');
            if ($modelViewers.length > 2) {
                var html = '<p>Model viewer limit reached.  Please close one and try again.</p>';
                $page.empty().append($(html));
                return;
            }
        }

        $block.addClass('expanded');
        $page.data('viewer-injected', true);

        var view = $block.data('view');
        var modelPrefix = view.minion ? 'minion' : view.mount ? 'mount' : view.slot;
        var modelKeys = _.map(view.models, function(m) { return modelPrefix + '/' + m; });
        var url = '3d/viewer.html?id=' + modelKeys.join('+');
        var html = '<iframe class="model-viewer" src="' + url + '"></iframe>';
        $page.empty().append($(html));
    }
};
