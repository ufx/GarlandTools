gt.craft = {
    flatTemplate: null,
    treeTemplate: null,
    treeNodeTemplate: null,
    nodeTemplate: null,
    crystalTemplate: null,
    currentAmountFocus: null,
    categorySort: {
        'Crystal': 1,
        'Unknown': 10,
        'Marketboard': 20,
        'Gil Vendor': 30,
        'Currency Vendor': 40,
        'Vendor': 50,
        'Venture': 60,
        'Gathering': 70,
        'Fishing': 80,
        'Mob': 90,
        'Desynthesis / Reduction': 100,
        'Leve': 110,
        'FATE': 120,
        'Instance': 130,
        'Voyage': 140,
        'Treasure Map': 150,
        'Other': 160,
        'Gather': 170,
        'Craft': 180,
        'Goal': 500
    },

    initialize: function(data) {
        gt.craft.flatTemplate = doT.template($('#flat-craft-template').text());
        gt.craft.treeTemplate = doT.template($('#tree-craft-template').text());
        gt.craft.treeNodeTemplate = doT.template($('#tree-craft-node-template').text());
        gt.craft.stepTemplate = doT.template($('#step-craft-template').text());
        gt.craft.expandedStepTemplate = doT.template($('#expanded-step-craft-template').text());
        gt.craft.crystalTemplate = doT.template($('#crystal-craft-template').text());
        gt.craft.profitTemplate = doT.template($('#profit-craft-template').text());
    },

    bindEvents: function($block, data, view) {
        if (!view.craftSet)
            return; // Nothing to bind.

        $('.step .progress-container', $block).click(gt.craft.recipeProgressClicked);
        $('.craft-mode', $block).click(gt.craft.craftModeToggleClicked);

        if (gt.display.isTouchDevice)
            gt.display.longtap($('.step .block-link', $block), gt.craft.stepTapped, gt.craft.stepLongTapped);

        $('.step .amounts input.finished', $block)
            .focus(gt.craft.amountFinishedFocused)
            .blur(gt.craft.amountFinishedBlurred)
            .change(gt.craft.amountFinishedChanged);

        // todo: switch to setBlockExpansion.  1/10.
        //gt.item.setBlockExpansion($block, data);
        $block.toggleClass('expanded', view.craftSet.amounts ? true : false);
    },

    set: function(name, items) {
        this.name = name;
        this.results = [];
        this.steps = [];
        this.children = [];
        this.crystal = [];
        this.priceViews = null;
        this.tree = 0;
        this.groups = {};
        this.categories = [];
        this.startingQuality = 0;
        this.revenue = 0;
        this.expense = 0;
        this.profit = 0;
        this.phasesEnabled = false;

        for (var i = 0; i < items.length; i++)
            this.addResult(items[i].item, items[i].amount, true);
        this.readyCheck();
    },

    step: function (id, item, required, isGoal, set) {
        this.id = id;
        this.item = item;
        this.set = set;
        this.required = required; // Amount needed for recipes.
        this.finished = 0; // Amount crafter has completed.
        this.generated = 0; // For yield calculations.
        this.source = null;
        this.sourceType = null;
        this.affectsQuality = false; // Top-level item used by a goal craft.
        this.isReady = false; // All materials are ready for this step.
        this.craft = null; // Preferred crafting recipe.
        this.price = null; // For purchased items.
        this.part = null; // Company crafts.
        this.phase = null;
        this.startingQuality = 0; // Running tally of goal quality.
        this.isGoal = isGoal;

        // Use either ingredient or partial for view model.
        var ingredient = gt.item.ingredients[item.id];
        if (ingredient)
            this.view = gt.item.getViewModel(ingredient);
        else
            this.view = gt.model.partial(gt.item, item.id);

        this.setSource(set);

        if (!this.type)
            console.error("invalid craft step type", this);
        if (!this.category)
            console.error("invalid craft step category", this);

        // todo: remove when no errors above crop up.
        if (isGoal)
            this.type = 'goal';
        else if (gt.item.isCrystal(item))
            this.type = 'crystal';
        else if (this.craft)
            this.type = 'craft';
        else
            this.type = 'gathered';

        this.sortKey = this.getSortKey();
    },

    recipeTemplate: function(craftSet) {
        if (craftSet.tree)
            return gt.craft.treeTemplate(craftSet);
        else
            return gt.craft.flatTemplate(craftSet);
    },

    recipeProgressClicked: function(e) {
        e.stopPropagation();

        var $this = $(this);
        var $block = $this.closest('.block');
        var view = $block.data('view');

        if (view.craftSet.tree)
            gt.craft.toggleTreeNodeProgress($this, $block, view);
        else
            gt.craft.toggleFlatStepProgress($this, $block, view);

        var data = $block.data('block');
        data.craft = view.craftSet.save();
        gt.core.redisplay($block);
        gt.settings.saveDirty();
    },

    toggleTreeNodeProgress: function($this, $block, view) {
        // Not functional.
        return;

        // Generate a path to this node.
        // var indexes = _.map($this.parents('.node').get().reverse(), function(e) { return $(e).data('index'); });
        // var node = view.craftSet;
        // for (var i = 0; i < indexes.length; i++)
        //     node = node.children[indexes[i]];

        // if (node.required == node.finished)
        //     view.craftSet.unfinishNode(node);
        // else
        //     view.craftSet.finishNode(node);

        // view.craftSet.readyCheck();
    },

    toggleFlatStepProgress: function($this, $block, view) {
        var $link = $this.closest('.step');
        var stepid = $link.data('stepid');

        var step = view.craftSet.findStep(stepid);
        if (!step) {
            console.error("Can't find craft step.", stepid, $link);
            return;
        }

        if (step.required == step.finished)
            view.craftSet.unfinish(step, step.required);
        else
            view.craftSet.finish(step, step.required);

        view.craftSet.readyCheck();
    },

    craftModeToggleClicked: function(e) {
        e.stopPropagation();

        var $block = $(this).closest('.block');
        var data = $block.data('block');

        if (data.craftTree) {
            data.craftTree = 0;
            data.craftAmount = 1;
        } else if (data.craftAmount)
            data.craftAmount = 0;
        else
            data.craftTree = 1;

        gt.core.redisplay($block);

        gt.settings.saveDirty();
    },

    stepTapped: function(e) {
        e.stopPropagation();

        var $step = $(this).closest('.step');
        $('.progress-container', $step).click();
    },

    stepLongTapped: function(e) {
        return gt.core.blockLinkClicked.apply(this, [e]);
    },

    amountFinishedFocused: function(e) {
        var $step = $(this).closest('.step');
        var $block = $step.closest('.block');

        setTimeout(function() {
            gt.craft.currentAmountFocus = [$block.data('id'), $step.data('stepid')];
        }, 50);
    },

    amountFinishedBlurred: function(e) {
        gt.craft.currentAmountFocus = null;
    },

    amountFinishedChanged: function(e) {
        var $this = $(this);
        var $step = $this.closest('.step');
        var stepid = $step.data('stepid');
        var $block = $step.closest('.block');
        var blockid = $block.data('id');
        var view = $block.data('view');
        var data = $block.data('block');
        var step = view.craftSet.findStep(stepid);
        var newAmount = parseInt($this.val());

        if (step.finished > newAmount)
            view.craftSet.unfinish(step, step.finished - newAmount);
        else if (step.finished < newAmount)
            view.craftSet.finish(step, newAmount - step.finished);

        data.craft = view.craftSet.save();
        gt.settings.saveDirty();

        // Change ready state after a delay to give a new focus time.
        setTimeout(function() {
            // Block may have disappeared.
            if (!$.contains(document, $block[0]))
                return;
            
            var $newblock = gt.core.redisplay($block);

            // Change focus if applicable.
            var newFocus = gt.craft.currentAmountFocus;
            if (newFocus != null) {
                if (blockid == newFocus[0]) {
                    // This same block need focus.
                    $('.block[data-id="' + newFocus[0] + '"] .step[data-stepid="' + newFocus[1] + '"] input.finished')
                        .focus()
                        .select();
                }
            }
        }, 100);
    },

    completeText: function(list, skipReady) {
        var ready = 0;
        var finished = 0;
        for (var i = 0; i < list.length; i++) {
            var step = list[i];
            if (step.isReady)
                ready++;
            if (step.required == step.finished)
                finished++;
        }

        return (skipReady ? "" : ready + "/") + finished + "/" + list.length;
    }
};

// CraftSet

gt.craft.set.prototype.sort = function() {
    this.steps = _.sortBy(this.steps, 'sortKey');

    // Old grouping system.
    // TODO: remove.
    this.groups = {};
    for (var i = 0; i < this.steps.length; i++) {
        var s = this.steps[i];
        if (!this.groups[s.type])
            this.groups[s.type] = [];
        this.groups[s.type].push(s);
    }

    // Categorize steps.
    var categories = {};
    for (var i = 0; i < this.steps.length; i++) {
        var step = this.steps[i];
        var categoryName = step.category || 'Unknown';
        var category = categories[categoryName];
        if (!category) {
            category = {
                name: step.category,
                sort: gt.craft.categorySort[step.category] || 9999,
                steps: [],
                visible: true
            };
            categories[categoryName] = category;

            if (categoryName == "Goal" && !this.showGoals)
                category.visible = false;
            else if (categoryName == 'Crystal')
                category.visible = false;
        }
        category.steps.push(step);
    }
    this.categories = _.sortBy(_.values(categories), function(c) { return c.sort; });
}

gt.craft.set.prototype.groupByPhase = function() {
    // fixme: transform to category system.

    var phases = null;
    for (var i = 0; i < this.steps.length; i++) {
        var s = this.steps[i];
        if (s.part || s.phase) {
            var group = s.part + (s.phase ? (s.part ? ' ' : '') + 'Phase ' + s.phase : '');
            if (!phases)
                phases = {};
            if (!phases[group])
                phases[group] = [];
            phases[group].push(s);
            continue;
        }

        if (!this.groups[s.type])
            this.groups[s.type] = [];
        this.groups[s.type].push(s);
    }

    if (phases) {
        var sortedPhases = _.keys(phases);
        sortedPhases.sort();

        this.groups.phases = [];
        for (var i = 0; i < sortedPhases.length; i++) {
            var key = sortedPhases[i];
            this.groups.phases.push({name: key, steps: phases[key]});
        }
    }
};

gt.craft.set.prototype.findStep = function(id) {
    return _.find(this.steps, function(s) { return s.id == id; });
};

gt.craft.set.prototype.getStepId = function(ingredient) {
    if (this.phasesEnabled)
        return ingredient.stepid || ingredient.id;
    return ingredient.id;
};

gt.craft.set.prototype.addItem = function(ingredient, item, amount, depth, parent) {
    var stepid = this.getStepId(ingredient);
    var step = this.findStep(stepid);
    if (step)
        step.required += amount;
    else {
        step = new gt.craft.step(stepid, item, amount, depth == 0, this);
        step.part = ingredient.part;
        step.phase = ingredient.phase;
        this.steps.push(step);
    }

    step.affectsQuality = step.affectsQuality || (depth == 1);

    // Setup tree
    var node = {
        set: this,
        parent: parent, children: [], crystal: [],
        required: amount, finished: 0,
        item: item,
        view: step.view,
        sourceView: step.sourceView,
        craft: step.craft,
        affectsQuality: depth == 1
    };

    (step.type == 'crystal' ? parent.crystal : parent.children).push(node);

    if (!step.craft)
        return step;

    var needed = step.required - step.generated;

    // Generated more than is needed, skip adding more ingredients.
    if (needed <= 0)
        return step;

    var cyield = step.craft.yield || 1;
    var newAmountNeeded = Math.ceil(needed / cyield);
    step.generated += newAmountNeeded * cyield;

    if (depth < gt.settings.data.craftDepth) {
        var self = this;
        step.eachIngredient(function(subIngredient, subItem) {
            self.addItem(subIngredient, subItem, subIngredient.amount * newAmountNeeded, depth + 1, node);
        });
    }

    return step;
};

gt.craft.set.prototype.removeItem = function(ingredient, amount) {
    var stepid = this.getStepId(ingredient);
    var step = this.findSteps(stepid);
    if (!step) {
        console.log("Attempt to remove item which doesn't exist in the set.", item);
        return;
    }

    step.required -= amount;
    step.finished = Math.max(step.finished - amount, 0);
    if (step.required <= 0)
        this[step.type] = _.without(this[step.type], step);

    if (!step.craft)
        return;

    var cyield = step.craft.yield || 1;
    var excess = step.generated - step.required;

    // This hasn't generated more than is yielded, don't remove ingredients.
    if (excess < cyield)
        return;

    var newExcessAmount = Math.floor(excess / cyield);
    step.generated -= newExcessAmount * cyield;

    var self = this;
    step.eachIngredient(function(subIngredient) {
        self.removeItem(subIngredient, subIngredient.amount * newExcessAmount);
    }); 
};

gt.craft.set.prototype.addResult = function(item, amount, skipReadyCheck) {
    for (var i = 0; i < amount; i++)
        this.results.push(item);

    var ingredient = { id: item.id };
    var step = this.addItem(ingredient, item, amount, 0, this);
    if (!skipReadyCheck)
        step.readyCheck(this);
    return step;
};

gt.craft.set.prototype.removeResult = function(item) {
    var itemRemoved = false;
    var newResults = [];

    for (var i = 0; i < this.results.length; i++) {
        var result = this.results[i];
        if (!itemRemoved && result == item) {
            itemRemoved = true;
            continue;
        }

        newResults.push(result);
    }

    this.removeItem({ id: item.id }, 1);
    this.results = newResults;
};

gt.craft.set.prototype.finish = function(step, amount) {
    if (amount == 0)
        return;

    var cyield = step.craft ? (step.craft.yield || 1) : 1;
    var priorFinished = step.finished;
    step.finished = Math.min(Math.max(step.finished + amount, 0), step.required);
    var craftsFinished = Math.ceil(step.finished / cyield) - Math.ceil(priorFinished / cyield);

    if (step.craft && craftsFinished > 0) {
        var self = this;
        step.eachIngredient(function(ingredient) {
            var innerStep = self.findStep(self.getStepId(ingredient));
            if (innerStep)
                self.finish(innerStep, ingredient.amount * craftsFinished);
        });
    }
};

gt.craft.set.prototype.unfinish = function(step, amount) {
    if (amount == 0)
        return;

    var cyield = step.craft ? (step.craft.yield || 1) : 1;
    var priorFinished = step.finished;
    step.finished = Math.max(step.finished - amount, 0);
    var craftsUnfinished = Math.ceil(priorFinished / cyield) - Math.ceil(step.finished / cyield);

    if (step.craft && craftsUnfinished > 0) {
        var self = this;
        step.eachIngredient(function(ingredient) {
            var innerStep = self.findStep(self.getStepId(ingredient));
            if (innerStep)
                self.unfinish(innerStep, ingredient.amount * craftsUnfinished);
        });
    }
};

gt.craft.set.prototype.export = function() {
    var lines = _.map(this.steps, function(s) {
        var sourceType = s.craft ? 'craft' : (s.sourceType || '""');
        var sourceName = '';
        if (!s.craft && s.sourceView) {
            sourceName = s.sourceView.longSourceName;
            if (s.sourceType == 'node')
                sourceName += ' ' + s.sourceView.job;
        }
        else if (s.craft && !s.craft.fc)
            sourceName = "Lv. " + s.craft.lvl + " " + gt.jobs[s.craft.job].abbreviation;

        return '"' + s.view.name + '",' + s.required + ',' + sourceType + ',"' + sourceName + '"';
    });


    return "Item,Amount,Type,Source\r\n" + lines.join("\r\n");
};

gt.craft.set.prototype.print = function() {
    var print = function(s) { return (s.required == 1 ? "" : (s.required + " ")) + s.view.name; };

    var parts = [];

    var gatherSteps = _.filter(this.steps, function(s) { return s.type == 'gathered'; });
    if (gatherSteps.length)
        parts.push('Gather: ' + _.map(gatherSteps, print).join(', '));

    var craftSteps = _.filter(this.steps, function(s) { return s.type == 'craft'; });
    if (craftSteps.length)
        parts.push('Craft: ' + _.map(craftSteps, print).join(', '));

    var crystalSteps = _.filter(this.steps, function(s) { return s.type == 'crystal'; });
    if (crystalSteps.length)
        parts.push('[' + _.map(crystalSteps, print).join(', ') + ']');

    var goalSteps = _.filter(this.steps, function(s) { return s.type == 'goal'; });
    return _.map(goalSteps, print).join(', ') + '. ' + parts.join('. ');
};

gt.craft.set.prototype.save = function() {
    var steps = _.filter(this.steps, function(s) { return s.finished; });
    var mapStep = function(s) { return { id: s.id, finished: s.finished } };
    return { steps: _.map(steps, mapStep) };
};

gt.craft.set.prototype.load = function(data) {
    var self = this;
    _.each(data.steps, function(stepData) {
        var step = self.findStep(stepData.id);
        if (step)
            step.finished = Math.min(stepData.finished, step.required);
    });

    this.readyCheck();
};

gt.craft.set.prototype.hasResult = function(id) {
    return _.some(this.results, function(item) { return item.id == id; });
};

gt.craft.set.prototype.readyCheck = function() {
    var price = {};
    this.startingQuality = 0;
    this.expense = 0;
    this.profit = 0;

    for (var i = 0; i < this.steps.length; i++) {
        var step = this.steps[i];
        if (step.type == 'craft' || step.type == 'goal')
            step.readyCheck(this);
        else if (step.price) {
            var needed = step.required - step.finished;
            var trades = Math.ceil(needed / step.price.yield);
            step.price.totalCost = step.price.cost * trades;
            price[step.price.currency] = (price[step.price.currency] || 0) + step.price.totalCost;

            if (step.price.currency == 1)
                this.expense += step.price.cost * step.required;
            else {
                // Quick and dirty update the "source name" used for the total trade cost.
                step.sourceView.sourceName = step.price.totalCost.toLocaleString();
                step.sourceView.longSourceName = step.sourceView.sourceName;
            }
        }

        this.startingQuality += step.startingQuality;
    }

    this.priceViews = [];
    for (var key in price) {
        var view = gt.model.partial(gt.item, key);
        view.amount = price[key];
        this.priceViews.push(view);
    }

    if (this.revenue)
        this.profit = this.revenue - this.expense;
};

gt.craft.set.prototype.clone = function() {
    var data = this.save();
    var set = new gt.craft.set(this.name, []);
    set.load(data);
    return set;
};

// CraftStep

gt.craft.step.prototype.setSource = function(set) {
    var itemSettings = gt.settings.getItem(this.item.id);

    if (this.isGoal) {
        this.setCraftSource(itemSettings);

        // Record revenue for any goals that are sold.
        if (itemSettings.marketPrice && itemSettings.sourceType != 'market') {
            var saleAmount = this.required == 1 && this.craft.yield ? this.craft.yield : this.required;
            set.revenue += itemSettings.marketPrice * saleAmount;
        }

        return;
    }

    if (itemSettings.sourceType) {
        if (itemSettings.sourceType == 'trade') {
            if (this.setTradeSource(itemSettings.sourceId))
                return;
        } else if (itemSettings.sourceType == 'craft') {
            this.setCraftSource(itemSettings);
            return;
        } else if (itemSettings.sourceType == 'market') {
            if (itemSettings.marketPrice) {
                this.setMarketSource(itemSettings);
                return;
            }
        } else {
            var module = gt[itemSettings.sourceType];
            module.resolveCraftSource(this, itemSettings.sourceId);
            if (this.sourceView) {
                this.source = this.sourceView.obj;
                return;
            }
        }
    }

    this.discoverSource(itemSettings);

    if (!this.source && this.sourceView && this.sourceView.obj)
        this.source = this.sourceView.obj;
};

gt.craft.step.prototype.discoverSource = function(itemSettings) {
    // This is a priority list.  Sources above are preferred to sources below.

    if (gt.item.isCrystal(this.item)) {
        this.category = 'Crystal';
        this.type = 'crystal';
        return; // Don't bother with other sources for crystals.
    }

    // Vendors are the easiest and best source.
    if (this.item.vendors) {
        gt.npc.resolveCraftSource(this);
        return;
    }

    // Ventures are preferred next where applicable.
    if (this.item.ventures && gt.venture.resolveCraftSource(this))
        return;

    // Gathering sources.
    if (this.item.nodes) {
        gt.node.resolveCraftSource(this);
        return;
    }

    if (this.item.fishingSpots) {
        gt.fishing.resolveCraftSource(this);
        return;
    }

    if (this.item.reducedFrom) {
        var reduceItem = gt.model.partialList(gt.item, this.item.reducedFrom)[0] || { name: '???' };
        this.sourceType = 'reduction';
        this.source = { sourceName: reduceItem.name, longSourceName: reduceItem.name + ' Aetherial Reduction', icon: 'images/Reduce.png' };
        this.sourceView = this.source;
        this.setCategory(['Desynthesis / Reduction', 'Gather']);
        return;
    }

    if (this.item.craft) {
        this.setCraftSource(itemSettings);
        return;
    }

    if (this.item.tradeShops && this.setTradeSource())
        return;

    // Things that are painful to acquire.
    if (this.item.drops) {
        gt.mob.resolveCraftSource(this);
        return;
    }

    if (this.item.instances) {
        gt.instance.resolveCraftSource(this);
        return;
    }

    if (this.item.voyages) {
        this.sourceType = 'voyage';
        this.source = { sourceName: this.item.voyages[0], icon: 'images/Voyage.png' };
        this.source.longSourceName = this.source.sourceName;
        this.sourceView = this.source;
        this.setCategory(['Voyage', 'Other']);
        return;
    }

    if (this.item.desynthedFrom) {
        this.sourceType = 'desynthesis';
        this.source = { sourceName: 'Desynthesis', longSourceName: 'Desynthesis', icon: 'images/Desynth.png' };
        this.sourceView = this.source;
        this.setCategory(['Desynthesis / Reduction', 'Other']);
        return;
    }

    if (this.item.treasure) {
        this.sourceType = 'map';
        this.sourceView = gt.model.partial(gt.item, this.item.treasure[0]);
        this.setCategory(['Treasure Map', 'Other']);
        return;
    }

    if (this.item.leves) {
        gt.leve.resolveCraftSource(this);
        return;
    }

    // Don't know of any fates that drop crafting materials.  For completeness.
    if (this.item.fates) {
        gt.fate.resolveCraftSource(this);
        return;
    }

    //console.log('No source found for item', this.item);
    this.setCategory(['Unknown']);
};

gt.craft.step.prototype.setTradeSource = function(traderId) {
    // Find the first non-currency trade involving our item.
    var trade = gt.item.findSimplestTradeSource(this.item, traderId);
    if (!trade)
        return null;

    // TODO: only captures the first currency entry.
    var currencyId = trade.currency[0].id;
    var currency = gt.item.partialIndex[currencyId];

    var view = {
        amount: trade.currency[0].amount,
        icon: gt.item.iconPath(currency.c),
        currency: 1,
        currencyView: currency
    };
    view.sourceName = view.amount.toLocaleString();
    view.longSourceName = view.sourceName;

    this.source = view;
    this.sourceView = view;
    this.sourceType = 'trade';
    this.price = { currency: currencyId, cost: view.amount, totalCost: view.amount, yield: trade.item[0].amount };
    this.setCategory(['Currency Vendor', 'Vendor']);

    return view;
};

gt.craft.step.prototype.setCraftSource = function(itemSettings) {
    if (itemSettings.recipe)
        this.craft = _.find(this.item.craft, function(r) { return r.id == itemSettings.recipe; });

    if (!this.craft)
        this.craft = this.item.craft[0];

    this.setCategory(['Craft']);
};

gt.craft.step.prototype.setMarketSource = function(itemSettings) {
    var view = {
        amount: itemSettings.marketPrice,
        icon: gt.item.iconPath(1),
        currency: 1,
        sourceName: itemSettings.marketPrice.toLocaleString(),
        longSourceName: itemSettings.marketPrice.toLocaleString()
    };

    this.source = view;
    this.sourceView = view;
    this.sourceType = 'market';
    this.price = { currency: 1, cost: view.amount, totalCost: view.amount, yield: 1 };
    this.setCategory(['Marketboard']);

    return view;
};

gt.craft.step.prototype.setCategory = function(categories) {
    // Handle special goal items.
    if (this.isGoal) {
        this.category = 'Goal';
        this.type = 'goal';
        return;
    }

    // Handle special craft items.
    if (this.craft) {
        this.category = 'Craft';
        this.type = 'craft';
        return;
    }

    // Find the first active category applicable.
    for (var i = 0; i < categories.length; i++) {
        var category = categories[i];
        if (gt.settings.data.craftCategories[category]) {
            this.category = category;
            this.type = 'gathered';
            return;
        }
    }

    // No category found, fallback to standard Gather.
    this.category = 'Gather';
    this.type = 'gathered';
};

gt.craft.step.prototype.getSortKey = function() {
    if (this.type == 'crystal')
        return this.view.name;

    if (this.type == 'gathered') {
        var sort = '';
        if (this.sourceView)
            sort = this.sourceView.region + ' ' + this.sourceView.location;

        if (this.sourceType == 'node')
            return sort + 'node ' + this.sourceView.zone.name + this.sourceView.lvl + this.sourceView.category;
        else if (this.sourceType == 'trade')
            return sort + 'trade ' + this.sourceView.currencyView.n + this.view.name;
        else if (this.sourceType == 'npc')
            return sort + 'npc ' + this.item.category + ' ' + this.view.name;
        else
            return sort + ' ' + (this.sourceType || '') + this.view.name;
    }

    if (this.craft) {
        var job = gt.jobs[this.craft.job];
        return job.name + ' ' + gt.util.zeroPad(this.craft.rlvl, 3) + this.view.name;
    }

    return this.view.name;
};

gt.craft.step.prototype.readyCheck = function(set) {
    if (!this.craft)
        return true;

    var cyield = this.craft.yield || 1;
    var amountRequired = Math.ceil(this.required / cyield);

    this.isReady = true;
    this.startingQuality = 0;

    var self = this;
    this.eachIngredient(function(ingredient) {
        var step = set.findStep(set.getStepId(ingredient));
        if (!step) // Ignore out-of-depth stuff.
            return;

        if (ingredient.quality && self.type == 'goal')
            self.startingQuality += ingredient.quality * Math.min(ingredient.amount, step.finished);

        if (step.type == 'crystal') {
            // Ignore gather status of crystals.
        } else if (step.finished < (ingredient.amount * amountRequired))
            self.isReady = false;
    });
};

gt.craft.step.prototype.eachIngredient = function(func) {
    for (var i = 0; i < this.craft.ingredients.length; i++) {
        var craftIngredient = this.craft.ingredients[i];
        var item = gt.item.ingredients[craftIngredient.id] || gt.item.index[craftIngredient.id];
        if (!item) {
            console.error("Recipe cache miss on item " + craftIngredient.id + ", skipping.", this.craft);
            continue;
        }

        func(craftIngredient, item);
    }
};
