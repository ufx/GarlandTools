gt = {
    filePath: '../files/',
    serverPath: '',
    grandCompanies: { "1": "Maelstrom", "2": "Twin Adders", "3": "Immortal Flames" },

    location: {
        index: null
    },

    formatPatch: function(p) {
        if (!p)
            return "??";

        return p == parseInt(p) ? p.toFixed(1) : p;
    }
};

gt.model = {
    name: function(partial) {
        return partial.n;
    },

    partial: function(module, id) {
        var value = module.partialIndex[id];
        if (value)
            return module.getPartialViewModel(value);

        // Fall back to main index and non-partial views.
        if (module.index) {
            value = module.index[id];

            if (value)
                return module.getViewModel(value);
        }

        console.error("Can't find source in partial index", module.type, id);
        return null;
    },

    partialList: function(module, sourceList, transform) {
        if (!sourceList)
            return null;

        // Some ids may not appear in the map object, so they're skipped.
        // Empty results are treated as null due to existance tests in templates.

        var result = [];
        for (var i = 0; i < sourceList.length; i++) {
            var source = sourceList[i];
            var id = source.id ? source.id : source;
            var view = null;
            var value = null;

            // Prefer the partial index...
            if (module.partialIndex) {
                value = module.partialIndex[id];
                if (value)
                    view = module.getPartialViewModel(value);
            }

            // ... but fall back to the main index if needed.
            if (!value) {
                value = module.index[id];
                if (!value) {
                    console.error("Can't find source in index", module.type, id);
                    continue;
                }
                view = module.getViewModel(value);
            }

            result.push(transform ? transform(view, source) : view);
        }

        return result.length ? result : null;
    },

    availableView: function(block) {
        var module = gt[block.type];
        if (!module) {
            console.error('Invalid module for viewModel', block);
            return null;
        }

        // Prefer full view models, but fall back to partials.
        var getViewModel = module.getViewModel || module.getPartialViewModel;
        var index = module.index || module.partialIndex;

        var value = index[block.id];
        if (!value) {
            console.error('Invalid value for viewModel', block);
            return null;
        }

        return getViewModel(value, block);
    }
};

gt.core = {
    hashExpression: /#?(\w+)\/(.*)/,
    groupHashExpression: /(.+?)\{(.*)\}/,
    errorTemplate: null,
    isLive: window.location.hostname != 'localhost',
    //isLive: true,

    initialize: function() {
        try {
            if (!gt.core.isLive)
                gt.serverPath = 'http://test.garlandtools.org';

            if (window.Raven && gt.core.isLive) {
                window.Raven.config('https://b4e595358f314806a2bd3063f04fb1d7@sentry.io/172355', {
                    environment: gt.core.isLive ? 'prod' : 'dev'
                }).install();
            }

            // Sanity check for essential resources.
            if (!window._) {
                gt.core.writeErrorMessage("Required resources failed to load.  Please ensure they are not blocked.  There are no ads on Garland Tools.\nDiagnostic load info: underscore");
                return;
            }
            var modules = [gt.time, gt.patch, gt.map, gt.craft, gt.item, gt.npc, gt.fate, gt.mob,
                gt.node, gt.fishing, gt.instance, gt.quest, gt.achievement, gt.action, gt.leve,
                gt.group, gt.equip, gt.skywatcher, gt.note, gt.search, gt.browse, gt.list,
                gt.settings, gt.display, gt.venture, gt.util, window.doT, window.Isotope,
                window.$, window.he];
            if (!_.all(modules)) {
                var moduleLoadInfo = JSON.stringify(_.map(modules, function(m) { return m ? 1 : 0; }));
                gt.core.writeErrorMessage("Required resources failed to load.  Please ensure they are not blocked.  There are no ads on Garland Tools.\nDiagnostic load info: "  + moduleLoadInfo);
                return;
            }

            // Load core data, then kick off init of everything else.
            var url = gt.core.makeFetchUrl({ type: 'core', version: 3 }, 'data');
            $.getJSON(url).always(function(result, status) {
                if (result && status == 'success') {
                    gt.core.initializeCoreData(result);
                    gt.core.initializeCore();
                } else {
                    if (!gt.core.retryLoad())
                        gt.core.writeError(new Error(status + ": " + url));
                }
            });
        } catch (ex) {
            if (!gt.core.retryLoad())
                gt.core.writeError(ex);
        }
    },

    initializeCoreData: function(data) {
        gt.patch.current = data.patch.current;
        gt.patch.partialIndex = data.patch.partialIndex;
        gt.patch.categoryIndex = data.patch.categoryIndex;
        gt.xp = data.xp;
        gt.jobs = data.jobs;
        gt.jobCategories = data.jobCategories;
        gt.dyes = data.dyes;
        gt.node.bonusIndex = data.nodeBonusIndex;
        gt.location.index = data.locationIndex;
        gt.skywatcher.weatherIndex = data.skywatcher.weatherIndex;
        gt.skywatcher.weatherRateIndex = data.skywatcher.weatherRateIndex;
        gt.quest.genreIndex = data.questGenreIndex;
        gt.venture.index = data.ventureIndex;
        gt.action.categoryIndex = data.action.categoryIndex;
        gt.achievement.categoryIndex = data.achievementCategoryIndex;
        gt.item.categoryIndex = data.item.categoryIndex;
        gt.item.specialBonusIndex = data.item.specialBonusIndex;
        gt.item.seriesIndex = data.item.seriesIndex;
        gt.item.partialIndex = data.item.partialIndex;
        gt.item.ingredients = data.item.ingredients;
    },

    initializeCore: function() {
        try {
            var data = gt.settings.load();

            if ('ontouchstart' in window && !data.disableTouch) {
                if (window.FastClick)
                    window.FastClick(document.body);
                gt.display.downEvent = 'touchstart';
                gt.display.moveEvent = 'touchmove';
                gt.display.isTouchDevice = true;
                $('body').addClass('touch');
            }

            gt.core.blockTemplate = doT.template($('#block-template').text());
            gt.core.errorTemplate = doT.template($('#block-error-template').text());

            // Initialize sub-modules.
            gt.display.initialize(data);
            gt.time.initialize(data);
            gt.patch.initialize(data);
            gt.map.initialize(data);
            gt.craft.initialize(data);
            gt.item.initialize(data);
            gt.npc.initialize(data);
            gt.fate.initialize(data);
            gt.mob.initialize(data);
            gt.node.initialize(data);
            gt.fishing.initialize(data);
            gt.instance.initialize(data);
            gt.quest.initialize(data);
            gt.achievement.initialize(data);
            gt.action.initialize(data);
            gt.leve.initialize(data);
            gt.group.initialize(data);
            gt.equip.initialize(data);
            gt.skywatcher.initialize(data);
            gt.note.initialize(data);

            gt.search.initialize(data);
            gt.browse.initialize(data);
            gt.list.initialize(data);

            // Load the block hash.
            if (!gt.core.loadBlockFromHash(null, data))
                gt.list.reinitialize(data);

            // Events
            $(window).bind('hashchange', gt.core.loadBlockFromHash);
            $('.block-link', '#sidebar, #header').click(gt.core.blockLinkClicked);

            // Focus search.
            if (!gt.display.isTouchDevice)
                $('#search-input').focus();

            $('body').addClass('loaded');

            // Start the initial sync in a few seconds.
            if (gt.settings.data.syncEnabled)
                setTimeout(gt.settings.syncRead, gt.settings.initialSyncTime);
        } catch (ex) {
            if (!gt.core.retryLoad())
                gt.core.writeError(ex);
        }
    },

    retryLoad: function() {
        try {
            // Force a server refresh once a day if errors encountered.
            var lastRetry = localStorage.dbRetry ? new Date(parseInt(localStorage.dbRetry)) : null;
            var now = new Date();
            if (lastRetry) {
                var diffDays = (now - lastRetry) / (1000 * 60 * 60 * 24);
                if (diffDays < 1)
                    return false;
            }

            localStorage.dbRetry = now.getTime();
            window.location.reload(true);
            return true;
        } catch (ex) {
            // Ignore, fall back to error writing.
            console.error(ex);
        }

        return false;
    },

    writeError: function(ex) {
        gt.core.writeErrorMessage(ex.stack, ex.data);

        if (window.Raven && gt.core.isLive)
            window.Raven.captureException(ex);

        console.error(ex.stack);
    },

    writeErrorMessage: function(message, data) {
        $('#main')
            .empty()
            .append('<div>Oops!  Something went wrong.  Please copy the below message into a comment on <a href="/">the front page</a>.  Or, you can <a href="/error.html">clear everything</a>.</div>')
            .append('<div><pre>' + message + '</pre></div>');

        if (data)
            $('#main').append('<div><pre>' + data + '</pre></div>');
    },

    activate: function(type, id, $from, done) {
        gt.core.load(type, id, $from, function($block) {
            gt.core.setActiveBlock($block);
            gt.list.blockSortingUpdated();

            if (done)
                done($block);
        });
    },

    load: function(type, id, $from, done) {
        // Kick off with some error checking.
        if (type == 'core' || type == 'settings' || type == 'search' || type == 'list') {
            console.error('Naughty link', type, id);
            return false;
        }

        // Make blocks more visible if they're already present.
        var $existing = $('.' + type + '.block[data-id="' + id + '"]');
        if ($existing.length) {
            if ($from) {
                $existing.attr('data-sort', gt.list.place($from));
                gt.list.blockSortingUpdated();
                gt.core.scrollToBlock($existing);
            }
            done($existing);
            return true;
        }

        var currentList = gt.list.current;
        var isListInitialized = gt.list.isInitialized;
        var blockData = gt.list.getBlockData(type, id);
        if (!blockData) {
            blockData = { type: type, id: id };
            gt.list.addBlock(blockData);
        }

        // Obtain a sort value for the new block.
        var sort = gt.list.place($from);

        // Callback for some deferred loads.
        var finalizeBlock = function($block, view) {
            // Quit if the list switched while fetching this block.
            // Common condition loading into a link from another larger list.
            if (gt.list.current != currentList || !view) {
                console.log('Skipping block finalize.', type, id);
                return;
            }

            $block.attr('data-sort', sort);
            var activate = gt.core.addBlock($block, $from, blockData, view);
            if (activate) // Should never be false for list batches.
                done($block);
        };

        return gt.core.loadCore(blockData, finalizeBlock);
    },

    loadCore: function(blockData, blockLoaded) {
        var module = gt[blockData.type];
        if (!module) {
            console.error('Invalid module', blockData.type, blockData.id);
            return false;
        }

        if (module.version)
            return gt.core.loadCoreLazy(blockData, module, blockLoaded);

        var obj = blockData.id;
        if (module.index) {
            obj = module.index[blockData.id];
            if (!obj) {
                console.error('Invalid link', blockData.type, blockData.id);
                return false;
            }
        }

        gt.core.render(obj, blockData, module, blockLoaded);
        return true;
    },

    loadCoreLazy: function(blockData, module, blockLoaded) {
        var obj = module.index[blockData.id];
        if (obj) {
            // Object is cached and valid, render.
            gt.core.render(obj, blockData, module, blockLoaded);
            return true;
        }

        // Object doesn't exist.  Lazy load.
        gt.core.fetch(module, [blockData.id], function(results) {
            // Check again if it's already loaded.
            var $existing = $('.block.' + blockData.type + '[data-id="' + blockData.id + '"]');
            if ($existing.length)
                blockLoaded($existing, null);
            else {
                obj = results[0].error ? results[0] : results[0][blockData.type];
                gt.core.render(obj, blockData, module, blockLoaded);
            }
        });
        return true;
    },

    render: function(obj, blockData, module, blockLoaded) {
        if (window.Raven && gt.core.isLive) {
            window.Raven.captureBreadcrumb({
                message: 'Rendering block #' + blockData.type + '/' + blockData.id,
                category: 'render',
                data: blockData
            });
        }

        try {
            var view = (obj && obj.error) ? obj : module.getViewModel(obj, blockData);
            var $block = $(gt.core.blockTemplate(view));
            blockLoaded($block, view);
        } catch (ex) {
            if (!gt.core.retryLoad()) {
                if (window.Raven && gt.core.isLive)
                    window.Raven.captureException(ex);

                console.error(ex);
                var errorView = gt.core.createErrorView(blockData.type, blockData.id, ex);
                var $block = $(gt.core.blockTemplate(errorView));
                blockLoaded($block, errorView);
            }
        }
    },

    createErrorView: function(type, id, exception) {
        return {
            type: type,
            id: id,
            blockClass: 'noexpand',
            exception: exception,
            template: gt.core.errorTemplate,
            name: "Error",
            error: true
        };
    },

    fetch: function(module, ids, done) {
        var $body = $('body');
        $body.addClass('wait');

        var fetched = [];
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var url = gt.core.makeFetchUrl(module, ids[i]);
            $.getJSON(url).always(function(result, status) {
                if (!result || result.error)
                    status = 'error';

                if (status == 'success') {
                    module.cache(result, id);
                    _.each(result.partials, function(p) {
                        var cacheModule = gt[p.type];
                        if (cacheModule.partialIndex)
                            cacheModule.partialIndex[p.id] = p.obj;
                    });
                } else if (status == 'error') {
                    // Typically for 404s.  Usually logged by the browser.
                    result = gt.core.createErrorView(module.type || module.pluralName, id, { message: 'Invalid link ' + url });
                } else {
                    // Send this error.
                    if (window.Raven && gt.core.isLive)
                        window.Raven.captureException(new Error(status + ": " + url));
                    result = gt.core.createErrorView(module.type || module.pluralName, id, { message: status });
                }

                if (fetched.push(result) == ids.length) {
                    $body.removeClass('wait');
                    done(fetched);
                }
            });
        }
    },

    makeFetchUrl: function(module, id) {
        if (!gt.core.isLive && module.version)
            return gt.serverPath + '/api/get.php?id=' + id + '&type=' + module.type + '&lang=' + gt.settings.data.lang  + '&version=' + module.version + '&test=1';

        return 'doc/' + module.type + '/' + gt.settings.data.lang + '/' + module.version + '/' + id + '.json';
    },

    redisplay: function($block) {
        var blockData = $block.data('block');
        if (!blockData) {
            console.error("Block data missing for redisplay.  Block went away?");
            return null;
        }

        var $mainContent = $('.content.main', $block);
        var contentScrollTop = $mainContent.length ? $mainContent[0].scrollTop : 0;

        var $replacement = null;
        var replacementView = null;
        var blockLoaded = function($newBlock, view) {
            $replacement = $newBlock;
            replacementView = view;
        };

        try {
            gt.core.loadCore(blockData, blockLoaded);
        } catch (ex) {
            var desc = 'Block reload failed (' + blockData.type + ':' + blockData.id + ')';
            if (window.Raven && gt.core.isLive) {
                window.Raven.captureBreadcrumb({
                    message: 'Block reload failure',
                    category: 'error',
                    data: blockData
                });
            }
            throw new Error(desc + '\r\nmessage: ' + ex.message + '\r\ninner stack:\r\n' + ex.stack);
        }

        if (!$replacement) {
            console.error('Cache miss on redisplay?', blockData);
            return null;
        }

        $block.html($replacement.html());
        $block.data('view', replacementView);

        gt.core.initializeBlock($block, blockData, replacementView);
        gt.list.resized($block);

        if (contentScrollTop) {
            $mainContent = $('.content.main', $block);
            if ($mainContent.length)
                $mainContent[0].scrollTop = contentScrollTop;
        }

        return $replacement;
    },

    setActiveBlock: function($block) {
        $('.block.active').removeClass('active');
        $block.addClass('active');

        gt.core.setHash($block);
    },

    addBlock: function($block, $from, blockData, view) {
        $block.data('block', blockData);
        $block.data('view', view);

        // Check for an atomos drawing in new blocks.
        if (!$block.hasClass('tool') && $from) {
            var $atomosGroup = $('.group.atomos-active:first');
            if ($atomosGroup.length && $atomosGroup[0] != $from[0]) {
                gt.group.insertGroup($block, $atomosGroup);
                return false;
            }
        }

        // Handle pinned blocks.
        if (blockData.pin) {
            $('#pinned').prepend($block);
            gt.core.initializeBlock($block, blockData, view);
            return true;
        }

        // Add the block as normal.
        if (gt.list.isInitialized)
            gt.isotope.once('arrangeComplete', gt.list.setMainContainerHeight);

        $('#main').append($block);

        gt.core.initializeBlock($block, blockData, view);
        gt.core.setBlockSize($block);
        gt.core.setHeaderSize($block);
        gt.isotope.appended($block);
        return true;
    },

    setHeaderSize: function($block) {
        var $header = $('.block-title h1', $block);
        var headerElement = $header[0];
        if (!headerElement) {
            console.error("No header found for block!");
            return;
        }

        var fontSize = 16;
        while (headerElement.scrollHeight > headerElement.offsetHeight && fontSize >= 10) {
            fontSize--;
            $header.css('font-size', fontSize + 'px');
        }
    },

    setBlockSize: function($block) {
        $block.removeClass('small medium large xlarge');

        var step = 243;
        var height = $block[0].scrollHeight;
        var size = Math.ceil(height / step);

        switch (size) {
            case 1: $block.addClass('small'); break;
            case 2: $block.addClass('medium'); break;
            case 3: $block.addClass('large'); break;
            default: $block.addClass('xlarge'); break;
        }
    },

    calcStepCss: function() {
        var step = 243;
        var margin = 9;
        var title = 70;
        var border = 1;

        var sizes = [];
        for (var i = 1; i <= 4; i++) {
            var height = i * step;
            height += (i - 1) * margin;
            height -= title + border * 2;
            sizes.push(height);
        }

        var rules = [];
        rules.push('.block.small .content.main { height: ' + sizes[0] + 'px; }');
        rules.push('.block.medium .content.main { height: ' + sizes[1] + 'px; }');
        rules.push('.block.large .content.main { height: ' + sizes[2] + 'px; }');
        rules.push('.block.xlarge .content.main { height: ' + sizes[3] + 'px; overflow-y: auto; overflow-x: hidden; }');
        console.log(rules.join("\n"));
    },
    
    initializeBlock: function($block, blockData, view) {
        var bindEvents = gt[blockData.type].bindEvents;
        if (!view.error && bindEvents)
            bindEvents($block, blockData, view);

        if (blockData.heightUnlocked)
            $block.addClass('height-unlocked');

        $('.block-title .close-button', $block).click(gt.core.closeButtonClicked);
        $('.block-title .settings-button', $block).click(gt.core.settingsButtonClicked);
        $('.settings .unlock-height-link', $block).click(gt.core.unlockHeightLinkClicked);
        $('.block-link', $block).click(gt.core.blockLinkClicked);

        if (gt.display.isTouchDevice)
            $('> h1', $block).click(gt.core.headerClicked);

        gt.map.setup($block);
        gt.display.collapsible($block);
        gt.display.pages($block);
        gt.display.draggable($block);
        gt.display.omniscroll($block);
    },

    removeBlockCore: function($block, isPinned) {
        if ($block.is('.active'))
            gt.core.setHash(null);

        if (isPinned)
            $block.remove();
        else {
            gt.isotope.remove($block);
            gt.isotope.layout();
            gt.display.minimap();
        }
    },

    closeButtonClicked: function(e) {
        var $block = $(this).closest('.block');
        var data = $block.data('block');
        if (!data) {
            console.error("Invalid block to close.");
            return false;
        }
        
        gt.list.removeBlock(data);
        gt.core.removeBlockCore($block, data.pin);

        return false;
    },

    settingsButtonClicked: function(e) {
        e.stopPropagation();

        var $block = $(this).closest('.block');
        $block.toggleClass('settings-open');

        return false;
    },

    unlockHeightLinkClicked: function(e) {
        e.stopPropagation();

        var $block = $(this).closest('.block');
        var blockData = $block.data('block');
        if (blockData.heightUnlocked) {
            delete blockData.heightUnlocked;
            $block.removeClass('height-unlocked');
        }
        else {
            blockData.heightUnlocked = 1;
            $block.addClass('height-unlocked');
        }

        $block.removeClass('settings-open');

        gt.list.layout();
        gt.settings.saveDirty();

        return false;
    },

    blockLinkClicked: function(e) {
        e.stopPropagation();

        var $this = $(this);
        var id = $this.data('id');
        var type = $this.data('type');

        var $block = $this.closest('.block');
        gt.core.activate(type, id, $block);
    },

    getCurrentBlockInfo: function() {
        return _.map(gt.isotope.filteredItems, function(b) {
            var $b = $(b.element);
            var id = $b.data('id');
            var blockType = $b.data('type');
            return { type: blockType, id: id, obj: gt[blockType].index[id], $block: $b };
        });
    },

    scrollToBlock: function($block) {
        var item = gt.isotope.getItem($block[0]);
        if (item) {
            gt.lastItem = item;
            var $sidebar = $('#sidebar');
            var y = item.position.y - 30;
            var sidebarPosition = getComputedStyle($sidebar[0]).position;
            if (sidebarPosition == 'static')
                y += $sidebar.height(); // Adjust for single-column lengths.
            window.scrollTo(item.position.x, y);
        }
    },

    pin: function($block) {
        var data = $block.data('block');
        data.pin = 1;
        gt.core.removeBlockCore($block, false);

        $block.attr('style', '');
        $block.addClass('pinned');
        $('#pinned').prepend($block);

        gt.settings.saveDirty();
    },

    parseHashQuery: function(parts) {
        var query = [];
        for (var i = 0; i < parts.length; i++) {
            var tokens = gt.core.hashExpression.exec(parts[i]);
            if (tokens && tokens[1] && tokens[2]) {
                var queryData = { type: tokens[1], id: decodeURIComponent(tokens[2]) };
                query.push(queryData);

                if (queryData.type == 'group') {
                    var groupTokens = gt.core.groupHashExpression.exec(tokens[2]);
                    if (!groupTokens) {
                        query.pop();
                        console.error('Skipping bad group', tokens[2]);
                        continue;
                    }
                    queryData.id = decodeURIComponent(groupTokens[1]);
                    queryData.contents = gt.core.parseHashQuery(groupTokens[2].split('|'));
                    continue;
                }

                var idTokens = queryData.id.split(/\+|\^/);
                if (!idTokens.length)
                    continue;

                var originalString = queryData.id;
                queryData.id = idTokens[0];

                var offset = queryData.id.length;
                for (var ii = 1; ii < idTokens.length; ii++) {
                    var remainingToken = idTokens[ii];
                    var separator = originalString[offset];

                    var value = parseInt(remainingToken) || 0;
                    if (value) {
                        if (separator == '+')
                            queryData.amount = value;
                        else if (separator == '^') {
                            var materia = gt.item.partialIndex[value];
                            if (materia && materia.materia) {
                                if (!queryData.melds)
                                    queryData.melds = [];

                                queryData.melds.push(value);
                            }
                        }
                    }

                    offset += 1 + remainingToken.length;
                }
            }
        }
        return query;
    },

    loadBlockFromHash: function(e, data) {
        if (!location.hash)
            return false;

        var hash;
        try {
            hash = decodeURI(location.hash);
        } catch (ex) {
            gt.display.alertp("There was an error decoding this link.");
            return false;
        }
        
        var query = gt.core.parseHashQuery(hash.split(','));

        if (query.length > 40) {
            gt.display.alertp("This link contains too many blocks (" + query.length + ")");
            return false;
        }

        if (query.length == 0)
            return false;

        // Handle search links.
        if (query[0].type == 'search') {
            $('#search-input').val(query[0].id);
            gt.search.execute();

            if (gt.settings.data.sidebar.collapse)
                gt.search.openSearchButtonClicked();

            return false;
        }

        // Handle shared lists.
        if (query[0].type == 'list') {
            gt.list.loadSharedList(query[0].id);
            return true;
        }

        // Check if the block is contained in another list.
        var listName = gt.list.findContainingList(query);
        if (!listName) {
            // Load this into the special Links list.
            listName = "Links";
        }

        // Switch to this list if necessary.
        var list = gt.list.getOrCreateList(listName);
        if (list != gt.list.current)
            gt.list.switchToList(listName);
        else if (!gt.list.isListInitialized && data)
            gt.list.reinitialize(data); // Trigger initial list load.

        // Load all these blocks.
        try {
            gt.list.loadBatch(query, true);
        } catch (ex) {
            console.error(ex);
            gt.display.alertp("There was an error loading this link.");
            return false;
        }
        return true;
    },

    createBlockDataHash: function(blockData) {
        var hash = blockData.type + '/' + blockData.id;

        if (blockData.amount > 1)
            hash += '+' + blockData.amount;

        if (blockData.type == 'item') {
            if (blockData.melds && blockData.melds.length) {
                var melds = blockData.melds.join('^');
                hash += '^' + melds;
            }
        } else if (blockData.type == 'group') {
            if (blockData.blocks.length > 40)
                return ''; // Too big.

            var contents = _.map(blockData.blocks, function(b) { return gt.core.createBlockDataHash(b); });
            hash += '{' + contents.join('|') + '}';
        }

        return hash;
    },

    setHash: function($block) {
        var hash = '';
        if ($block) {
            var blockData = $block.data('block');
            if (!blockData)
                return;
            hash = gt.core.createBlockDataHash(blockData);
        }

        if (location.hash != hash) {
            try {
                history.replaceState({}, '', '#' + (hash ? hash : ''));
            } catch (ex) {
                // Ignore.  Not supported by <= IE9.
            }
        }
    },

    loadWelcome: function(data) {
        data.welcome = 1;
        gt.list.loadBatch([
            {type: 'patch', id: gt.patch.current}
        ]);
    },

    headerClicked: function(e) {
        var $block = $(this).closest('.block');
        gt.core.setActiveBlock($block);
        gt.isotope.layout();
    },

    renameHeaderClicked: function(e) {
        e.stopPropagation(); // Prevents dragging

        var $target = $(e.target);
        var $block = $target.closest('.block');
        var data = $block.data('block');

        gt.display.promptp('Rename the ' + data.type + ':', data.id, function(name) {
            if (!name || name == data.id)
                return;

            if (name.indexOf("\"") != -1) {
                gt.display.alertp('Name can not contain ".  Please try again.');
                return;
            }

            if (gt.list.doesListMatch([{type: data.type, id: name}], gt.list.current)) {
                gt.display.alertp("A " + data.type + " with that name already exists.");
                return;
            }

            $block.attr('data-id', name);
            $target.text(name);
            data.id = name;

            gt.display.minimap();
            gt.core.setHash(null);
            gt.settings.saveDirty();
        });
    }
};
