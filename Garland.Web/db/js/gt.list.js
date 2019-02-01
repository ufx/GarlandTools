gt.list = {
    sortCounter: 0,
    isInitialized: false,
    listItemTemplate: null,
    listHeaderTemplate: null,
    current: null,
    specialIcons: {
        DOL: 'DOL', GATHER: 'DOL', GATHERING: 'DOL', GATHERER: 'DOL',
        DOH: 'DOH', CRAFT: 'DOH', CRAFTING: 'DOH', CRAFTER: 'DOH',
    
        SCRIP: '../files/icons/item/11091.png', SCRIPS: '../files/icons/item/11091.png',
        'RED SCRIP': '../files/icons/item/7553.png', 'RED SCRIPS': '../files/icons/item/7553.png',
        'YELLOW SCRIP': '../files/icons/item/11091.png',
    
        EUREKA: '../files/icons/item/12032.png', RELIC: '../files/icons/item/12032.png',
    
        GLAMOUR: '../files/icons/item/11717.png', GLAM: '../files/icons/item/11717.png', FASHION: '../files/icons/item/11717.png',
    
        SPIRITBOND: 'images/Convert.png', SPIRITBONDING: 'images/Convert.png',
    
        VOYAGE: 'images/Voyage.png', VOYAGES: 'images/Voyage.png',
        AIRSHIP: 'images/Voyage.png', AIRSHIPS: 'images/Voyage.png',
        SUB: 'images/Voyage.png', SUBS: 'images/Voyage.png',
        SUBMARINE: 'images/Voyage.png', SUBMARINES: 'images/Voyage.png',
    
        HOUSE: 'images/House.png', HOUSING: 'images/House.png',
        MANSION: 'images/House.png', COTTAGE: 'images/House.png',
        APARTMENT: 'images/House.png',
        DECORATION: 'images/House.png', DECORATIONS: 'images/House.png',
        FURNISHING: 'images/House.png', FURNISHINGS: 'images/House.png',
    
        PATCH: 'LatestPatch',
        DAILY: '../files/icons/event/71222.png', DAILIES: '../files/icons/event/71222.png',
        QUEST: '../files/icons/event/71221.png', QUESTS: '../files/icons/event/71221.png',
        ORCHESTRION: '../files/icons/item/7977.png', ORCH: '../files/icons/item/7977.png',
        SATISFACTION: 'Satisfaction', DELIVERY: 'Satisfaction',
    },

    initialize: function(data) {
        gt.list.listItemTemplate = doT.template($('#list-item-template').text());
        gt.list.listHeaderTemplate = doT.template($('#list-header-template').text());

        gt.list.current = data.lists[data.current];
        gt.list.initializeIsotope();
        $('#new-list').click(gt.list.newListClicked);
        $('#clear-list').click(gt.list.clearListClicked);

        gt.list.initializeSpecialIcons();
    },

    initializeSpecialIcons: function() {
        // Add jobs.
        for (var i = 0; i < gt.jobs.length; i++) {
            var job = gt.jobs[i];
            var iconPath = '../files/icons/job/' + job.abbreviation + '.png';
            gt.list.specialIcons[job.abbreviation.toUpperCase()] = iconPath;
            gt.list.specialIcons[job.name.toUpperCase()] = iconPath;
        }
    },

    reinitialize: function() {
        // Reset initialization status, reload layout engine.
        if (gt.list.isInitialized) {
            gt.list.isInitialized = false;
            gt.isotope.destroy();
            $('#main .block, #pinned .block').remove();
            $('#main').css('min-height', '');
        }

        gt.list.redisplayLists();
        gt.list.initializeIsotope();

        // Show all the blocks.
        if (gt.list.current.length)
            gt.list.loadBatch(gt.list.current);
        else {
            gt.list.isInitialized = true;
            gt.display.minimap();
        }

        // If this is the user's only list, and it contains nothing, add some
        // browse blocks by default.
        var data = gt.settings.data;
        if (data && !data.welcome && !gt.list.current.length && _.keys(data.lists).length == 1)
            gt.core.loadWelcome(data);

        if (!gt.display.isTouchDevice)
            window.scrollTo(0, 0);
    },

    redisplayLists: function() {
        var data = gt.settings.data;
        var listData = data.listData && data.listData[data.current];

        // Render list items.
        var lists = data.lists;
        var $listItems = _.map(_.keys(lists), function(listName) {
            var view = gt.list.getViewModel(listName, lists[listName]);
            var $list = $(gt.list.listItemTemplate(view));
            $list.data('listname', listName);
            $list.click(gt.list.listClicked);
            gt.display.draggable($list);
            return $list;
        });
        $('#lists').empty().append($listItems);

        // Render header.
        var view = gt.list.getViewModel(data.current, gt.list.current);
        $('#list-header').empty().append(gt.list.listHeaderTemplate(view));

        // Bind events.
        $('#list-header .name').click(gt.list.listHeaderNameClicked);
        $('#list-header input').blur(gt.list.listHeaderInputBlurred);
        $('#delete-list').click(gt.list.deleteListClicked);
        $('#sort-alpha').click(gt.list.sortAlphaClicked);
        $('#share-list').click(gt.list.shareClicked);

        if (listData && listData.sort)
            $('#sort-alpha').addClass('active');
    },

    getViewModel: function(name, list) {
        // Exact match first.
        var nameKey = name.toUpperCase();
        var icon = gt.list.specialIcons[nameKey];
        if (!icon) {
            // Name parts next.
            var nameParts = nameKey.split(' ');
            icon = gt.list.specialIcons[_.find(nameParts, function(n) { return gt.list.specialIcons[n]; })];

            // Fallback to journal icon.
            if (!icon)
                icon = 'Journal';
        }

        if (icon.indexOf('/') == -1)
            icon = 'images/' + icon + '.png';

        var view = {
            name: name,
            displayName: he.encode(name),
            amount: list.length,
            icon: icon,
            current: list == gt.list.current
        };

        if (name == "Links")
            view.displayName = "&#9733;Links";

        return view;
    },

    loadBatch: function(blocks, activate) {
        var loaded = [];
        var loadComplete = function($block) {
            if (loaded.push($block) == blocks.length) {
                gt.isotope.updateSortData();
                gt.isotope.arrange();
                gt.display.minimap();

                gt.list.setMainContainerHeight(gt.isotope.filteredItems);
                gt.list.isInitialized = true;

                if (activate && $block) {
                    gt.core.setActiveBlock($block);
                    gt.isotope.layout();
                    gt.core.scrollToBlock($block);
                    gt.settings.saveDirty();
                }
            } else
                gt.isotope.arrange();
        };

        blocks = blocks.slice();
        blocks.reverse();
        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i];
            if (!block || !block.type)
                continue;

            // Skip loading blocks that already exist on this list.
            var blockData = gt.list.getBlockData(block.type, block.id);
            if (blockData && activate)
                continue;

            if (block.melds || block.contents) {
                // Push special data prior to load, but don't overwrite
                // existing data.
                if (!blockData) {
                    var newBlock = { type: block.type, id: block.id };
                    if (block.melds)
                        newBlock.melds = block.melds;
                    if (block.contents)
                        newBlock.blocks = block.contents;
                    gt.list.current.push(newBlock);
                }
            }

            if (gt.core.load(block.type, block.id, null, loadComplete) === false) {
                // Requested block may be invalid.  Push null to ensure
                // an otherwise proper initialization.
                loadComplete(null);

                // todo: Now remove block from the list entirely!
            }
        }
    },

    initializeIsotope: function() {
        var data = gt.settings.data;
        var listData = data.listData && data.listData[data.current];

        // Init layout engine
        var layoutOptions ={
            layoutMode: 'masonry',
            itemSelector: '.block',
            masonry: {
                gutter: 0,
                columnWidth: 398
            },
            getSortData: {
                counter: '[data-sort] parseInt',
                alpha: 'h1.name .name-handle'
            },
            sortBy: 'counter',
            sortAscending: false
        };

        if (listData && listData.sort) {
            layoutOptions.sortBy = listData.sort;
            layoutOptions.sortAscending = true;
        }

        if (gt.display.isTouchDevice)
            layoutOptions.transitionDuration = 0;

        gt.isotope = new Isotope('#main', layoutOptions);
    },

    place: function($after) {
        gt.list.sortCounter++;

        var placedSort;
        if ($after && $after.length)
            placedSort = parseInt($after.attr('data-sort'));
        else
            placedSort = gt.list.sortCounter;

        if (gt.isotope.filteredItems.length) {
            for (var i = 0; i < gt.isotope.filteredItems.length; i++) {
                var item = gt.isotope.filteredItems[i];
                if (item.sortData.counter >= placedSort)
                    $(item.element).attr('data-sort', item.sortData.counter + 1);
            }
        }

        return placedSort;
    },

    placeBefore: function($before) {
        for (var i = 0; i < gt.isotope.filteredItems.length; i++) {
            var item = gt.isotope.filteredItems[i];
            if (item.element == $before[0]) {
                if (i == 0)
                    return gt.list.place(null);
                else
                    return gt.list.place($(gt.isotope.filteredItems[i-1].element));
            }
        }

        // Fallback, should not reach this point.
        return ++gt.list.sortCounter;
    },

    blockSortingUpdated: function() {
        gt.isotope.updateSortData();
        gt.isotope.arrange();
        gt.display.minimap();

        // Recreate the list in place, with pinned blocks at the front.
        var blocks = gt.list.current;
        var pinned = _.filter(blocks, function(b) { return b.pin; });
        blocks.splice(0, blocks.length);
        gt.util.pushAll(pinned, blocks);

        // Re-push all items in the layout engine's sort order.
        for (var i = 0; i < gt.isotope.filteredItems.length; i++) {
            var item = gt.isotope.filteredItems[i];
            var block = $(item.element).data('block');
            if (block)
                blocks.push(block);
        }

        gt.settings.saveDirty();
    },

    getOrCreateList: function(name) {
        var lists = gt.settings.data.lists;
        var list = lists[name];
        if (list)
            return list;

        list = [];
        lists[name] = list;
        gt.list.redisplayLists();
        return list;
    },

    newListClicked: function(e) {
        gt.display.promptp("Name the new list:", null, function(name) {
            if (!name)
                return;
    
            gt.settings.data.lists[name] = [];
            gt.list.switchToList(name);
            gt.core.setHash(null);    
        });
    },

    deleteListClicked: function(e) {
        var listName = gt.settings.data.current;
        if (gt.settings.data.lists[listName].length && !confirm('Are you sure you want to delete the "' + listName + '" list?'))
            return;

        // Remove the list.
        delete gt.settings.data.lists[listName];

        if (gt.settings.data.listData)
          delete gt.settings.data.listData[listName];

        // Create a new default list if needed.
        var keys = _.keys(gt.settings.data.lists);
        if (keys.length == 0) {
            gt.settings.data.lists = { Default: [] };
            listName = 'Default';
        }
        else
            listName = keys[0];

        gt.list.switchToList(listName);
        gt.core.setHash(null);
    },

    sortAlphaClicked: function(e) {
        var listData = gt.list.getListData();
        if (!listData.sort) {
            listData.sort = 'alpha';
            gt.isotope.options.sortBy = 'alpha';
            gt.isotope.options.sortAscending = true;
            $(this).addClass('active');
        } else {
            delete listData.sort;
            gt.isotope.options.sortBy = 'counter';
            gt.isotope.options.sortAscending = false;
            $(this).removeClass('active');
        }

        gt.isotope.updateSortData();
        gt.isotope.arrange();

        gt.settings.saveDirty();
    },

    shareClicked: function(e) {
        var listName = gt.settings.data.current;
        if (listName == "Default" || listName == "Links") {
            gt.display.alertp("Please rename your list to share.");
            return;
        }
        
        var data = { method: 'list-share', name: listName, list: JSON.stringify(gt.list.current) };
        gt.util.api(data, function(result, error) {
            if (error)
                gt.display.alertp("Share error: " + error);
            else
                gt.display.alertp("Copy share link:<br>" + "https://garlandtools.org/db/#list/" + result.id);
        });
    },

    getListData: function() {
        var listName = gt.settings.data.current;

        if (!gt.settings.data.listData)
            gt.settings.data.listData = {};

        if (!gt.settings.data.listData[listName])
            gt.settings.data.listData[listName] = {};

        return gt.settings.data.listData[listName];
    },

    clearListClicked: function(e) {
        var listName = gt.settings.data.current;
        if (!confirm('Are you sure you want to clear the "' + listName + '"list?'))
            return;

        gt.list.current.splice(0, gt.list.current.length);
        gt.list.reinitialize();
        gt.settings.saveDirty();
        gt.core.setHash(null);
    },

    listClicked: function(e) {
        var $this = $(this);
        if ($this.hasClass('dragging'))
            return false; // No clicks while dragging.

        var listName = $this.data('listname');
        if (listName == gt.settings.data.current)
            return;

        gt.list.switchToList(listName);
        gt.core.setHash(null);
    },

    listHeaderNameClicked: function(e) {
        $('#list-header').addClass('editing');
        $('#list-header input').focus();
    },

    listHeaderInputBlurred: function(e) {
        $('#list-header').removeClass('editing');

        var data = gt.settings.data;
        var name = $(this).val();
        if (!name || name == data.current)
            return;

        if (data.lists[name]) {
            gt.display.alertp('That list already exists.');
            return;
        }

        if (data.listData && data.listData[data.current]) {
            data.listData[name] = data.listData[data.current];
            delete data.listData[data.current];
        }

        data.lists[name] = data.lists[data.current];
        delete data.lists[data.current];

        data.current = name;

        gt.list.redisplayLists();
        gt.settings.saveDirty();
    },

    switchToList: function(listName) {
        $('.active', '#lists').removeClass('active');

        var $listItems = $('#lists .list-item');
        for (var i = 0; i < $listItems.length; i++) {
            var $listItem = $($listItems[i]);
            if ($listItem.data('listname') == listName) {
                $listItem.addClass('active');
                break;
            }
        }

        gt.settings.data.current = listName;
        gt.list.current = gt.settings.data.lists[listName];

        $('#list-header input').val(listName);

        gt.list.reinitialize();
        gt.settings.saveClean();
    },

    findContainingList: function(query) {
        // Give precedence to the current list.
        if (gt.list.doesListMatch(query, gt.list.current))
            return gt.settings.data.current;

        // Try the other lists.
        var lists = gt.settings.data.lists;
        for (var listName in lists) {
            if (gt.list.doesListMatch(query, lists[listName]))
                return listName;
        }

        return null;
    },

    doesListMatch: function(query, list) {
        for (var i = 0; i < query.length; i++) {
            var q = query[i];
            var match = _.find(list, function(b) { return b.type == q.type && b.id == q.id; });
            if (!match)
                return false;
        }

        return true;
    },

    resized: function($block) {
        gt.core.setBlockSize($block);
        gt.list.layout();
    },

    layout: function() {
        if (gt.isotope)
            gt.isotope.layout();
    },

    addBlock: function(block) {
        gt.list.current.push(block);
        gt.list.redisplayLists();
    },

    removeBlock: function(block) {
        gt.list.removeBlockCore(block, gt.list.current);
    },

    removeBlockCore: function(block, blocks) {
        var index = blocks.indexOf(block);
        if (index == -1) {
            console.error("Can't find block to remove.", block);
            return;
        }

        blocks.splice(index, 1);
        gt.list.redisplayLists();
        gt.settings.saveDirty();
    },

    moveBlockTo: function($block, listName) {
        var toList = gt.settings.data.lists[listName];
        if (!toList) {
            gt.list.layout();
            console.error('Invalid block destination', listName);
            return;
        }

        var data = $block.data('block');
        if (gt.list.doesListMatch([{type: data.type, id: data.id}], toList)) {
            gt.list.layout();
            gt.display.alertp("List " + listName + " already contains " + data.type + "/" + data.id + ".");
            return;
        }

        toList.push(data);
        gt.list.removeBlock(data); // Implicitly saves
        gt.core.removeBlockCore($block, 0);
    },

    getBlockData: function(type, id) {
        return _.find(gt.list.current, function(b) { return b.type == type && b.id == id; });
    },

    setMainContainerHeight: function(filteredItems) {
        // Set minimum height to avoid jumpiness when blocks are removed.
        var height = _.max(_.map(filteredItems, function(i) { return i.position.y + i.size.outerHeight; }));
        $('#main').css('min-height', height);
    },

    loadSharedList: function(id) {
        var data = { method: 'list-read', id: id };
        gt.util.api(data, function(result, error) {
            if (error)
                gt.display.alertp("Error loading list: " + error);
            else if (gt.settings.data.lists[result.name])
                gt.display.alertp("The list '" + result.name + "' already exists.  Please delete and try again.");
            else {
                var newList = JSON.parse(result.list);
                if (newList) {
                    gt.core.setHash(null);
                    gt.settings.data.lists[result.name] = newList;
                    gt.settings.data.current = result.name;
                    gt.list.current = newList;
                    gt.settings.saveDirty();
                }
                else
                    gt.display.alertp("The list '" + result.name + "' could not be loaded.");
            }

            gt.list.reinitialize();
        });
    }
};
