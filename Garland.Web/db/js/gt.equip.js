gt.equip = {
    index: { leveling: {}, early: {}, end: {} },
    levelingTemplate: null,
    endTemplate: null,
    mneuTemplate: null,
    jobSelectTemplate: null,
    jobGroups: null,
    version: 2,
    type: 'equip',

    initialize: function(data) {
        gt.equip.levelingTemplate = doT.template($('#leveling-equip-template').text());
        gt.equip.endTemplate = doT.template($('#end-equip-template').text());
        gt.equip.jobSelectTemplate = doT.template($('#job-select-template').text());
        gt.equip.menuTemplate = doT.template($('#menu-equip-template').text());

        gt.equip.jobGroups = _.groupBy(_.filter(gt.jobs, function(j) { return j.abbreviation != 'ADV'; }), 'category');
    },

    cache: function(data, id) {
        gt.equip.index[id] = data.equip;
    },

    bindEvents: function($block) {
        $('input.lvl', $block).change(gt.equip.lvlChanged);

        if ($block.is('.early')) {
            $('.new-crafting-list', $block).click(gt.equip.newCraftingListClicked);
            $('.all-crafting-list', $block).click(gt.equip.allCraftingListClicked);
            $('.toggle-crafted', $block).click(gt.equip.toggleCraftedClicked);
            $('.toggle-grand-company', $block).click(gt.equip.toggleGrandCompanyClicked);
        }
    },

    getViewModel: function(obj, data) {
        // Job Menu
        if (data.id == 'leveling' || data.id == 'early') {
            return {
                id: 'leveling',
                type: 'equip',
                name: 'Leveling Equipment',
                template: gt.equip.menuTemplate,
                blockClass: 'early tool noexpand',
                icon: 'images/Leveling.png',
                subheader: 'Recommendation Tool',
                tool: 1,
                settings: 1
            };
        } else if (data.id == 'end') {
            return {
                id: 'end',
                type: 'equip',
                name: 'End Game Equipment',
                template: gt.equip.menuTemplate,
                blockClass: 'end tool noexpand',
                icon: 'images/Mentor.png',
                subheader: 'Progression Tool',
                tool: 1,
                settings: 1
            };
        }

        // Specific Jobs
        if (data.id.indexOf('leveling') == 0) {
            var abbr = data.id.substr(9);
            var job = _.find(gt.jobs, function(j) { return j.abbreviation == abbr; });
            if (job)
                return gt.equip.getLevelingViewModel(job, data);
        }
        else if (data.id.indexOf('end') == 0) {
            var abbr = data.id.substr(4);
            var job = _.find(gt.jobs, function(j) { return j.abbreviation == abbr; });
            if (job)
                return gt.equip.getEndViewModel(job, data);
        }

        console.error('Invalid id for view model', data);
        return null;
    },

    getLevelingViewModel: function(job, data) {
        var view = {
            id: data.id,
            type: 'equip',
            name: 'Leveling ' + job.name,
            template: gt.equip.levelingTemplate,
            blockClass: 'early tool noexpand',
            icon: 'images/' + job.abbreviation + '.png',
            subheader: 'Recommendation Tool',
            tool: 1,
            settings: 1,

            lvl: data.lvl || Math.max(job.startingLevel, 3),
            job: job,
            hideCrafted: data.hideCrafted ? 1 : 0,
            hideGC: data.hideGC ? 1 : 0
        };

        var equipment = gt.equip.index[data.id];

        // Filter the equipment to find the highest ranking item per slot and level.
        var validKeys = ['gil'];
        if (!data.hideCrafted)
            validKeys.push('craft');
        if (!data.hideGC)
            validKeys.push('gc');

        var filteredEquipment = [];
        for (var lvl = 0; lvl < equipment.length; lvl++) {
            var slotItems = equipment[lvl];
            var filteredSlotItems = [];
            for (var slot = 1; slot <= 13; slot++) {
                var items = slotItems[slot];
                if (items == null) {
                    filteredSlotItems.push(null);
                    continue;
                }

                var item = _.find(items, function(item) {
                    return _.any(validKeys, function(k) { return item[k]; });
                });
                filteredSlotItems.push(item ? item.id : null);
            }
            filteredEquipment.push(filteredSlotItems);
        }

        // Generate the equipment grid within the level range.
        view.equipment = {};
        var startLevel = Math.max(1, view.lvl - 2);
        var endLevel = Math.min(69, view.lvl + 4);

        // Each row represents a slot, so start iterating these.
        for (var slot = 0; slot <= 12; slot++) {
            var items = [];
            var hasItems = false;
            for (var lvl = startLevel; lvl <= endLevel; lvl++) {
                var currentEquipment = filteredEquipment[lvl-1] || [];
                var id = currentEquipment[slot];
                if (!id) {
                    items.push(null);
                    continue;
                }

                var obj = { item: gt.model.partial(gt.item, id) };
                if (lvl > 1) {
                    var lastEquipment = filteredEquipment[lvl-2] || [];
                    obj.isNew = lastEquipment[slot] != id;
                }
                else
                    obj.isNew = 1;

                items.push(obj);
                hasItems = true;
            }

            if (hasItems)
                view.equipment[slot] = items;
        }
        
        view.maxLvl = equipment.length;
        view.startLevel = startLevel;
        view.endLevel = endLevel;
        return view;
    },

    getEndViewModel: function(job, data) {
        var view = {
            id: data.id,
            type: 'equip',
            name: 'End Game ' + job.name,
            template: gt.equip.endTemplate,
            blockClass: 'end tool noexpand',
            icon: 'images/' + job.abbreviation + '.png',
            subheader: 'Progression Tool',
            tool: 1,
            settings: 1,

            job: job
        };

        var equipment = gt.equip.index[data.id];
        view.equipment = _.map(_.values(equipment), function(ranks) {
            var rankSlice = ranks.slice(0, 7);
            var items = [];
            for (var i = Math.max(rankSlice.length, 7) - 1; i >= 0; i--) {
                var rank = rankSlice[i];
                if (!rank) {
                    items.push(null);
                    continue;
                }
                
                items.push(gt.model.partial(gt.item, rank.id));
            }
            return items;
        });

        return view;
    },

    lvlChanged: function(e) {
        var $this = $(this);
        var $block = $this.closest('.block');
        var data = $block.data('block');

        data.lvl = parseInt($this.val());
        data.lvl = Math.min(Math.max(data.lvl, 3), 69)

        gt.core.redisplay($block);
        gt.settings.saveDirty();
        return true;
    },

    newCraftingListClicked: function(e) {
        var $block = $(this).closest('.block');
        var view = $block.data('view');

        var items = [];
        var index = view.lvl - view.startLevel;
        for (var slot = 0; slot <= 12; slot++) {
            var equipment = view.equipment[slot];
            if (equipment) {
                var obj = equipment[index];
                if (obj && obj.isNew) {
                    items.push({ type: 'item', id: obj.item.id });
                }
            }
        }

        if (!items.length)
            return;

        gt.equip.createCraftingList(items, $block);
    },

    allCraftingListClicked: function(e) {
        var $block = $(this).closest('.block');
        var view = $block.data('view');

        var items = [];
        var index = view.lvl - view.startLevel;
        for (var slot = 0; slot <= 12; slot++) {
            var equipment = view.equipment[slot];
            if (equipment) {
                var obj = equipment[index];
                if (obj)
                    items.push({ type: 'item', id: obj.item.id });
            }
        }

        gt.equip.createCraftingList(items, $block);
    },

    createCraftingList: function(items, $block) {
        gt.group.setup('Crafting List', $block, function(groupData) {
            for (var i = 0; i < items.length; i++) {
                var itemData = items[i];
                if (gt.item.partialIndex[itemData.id].t == 43) // Ring
                    itemData.amount = 2;
                gt.group.insertGroupCore(itemData, groupData);
            }
        });
    },

    toggleCraftedClicked: function(e) {
        var $block = $(this).closest('.block');
        var data = $block.data('block');

        data.hideCrafted = !data.hideCrafted;
        gt.core.redisplay($block);
        gt.settings.saveDirty();
    },

    toggleGrandCompanyClicked: function(e) {
        var $block = $(this).closest('.block');
        var data = $block.data('block');

        data.hideGC = !data.hideGC;
        gt.core.redisplay($block);
        gt.settings.saveDirty();
    }
};