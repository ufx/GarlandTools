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
    isLive: window.location.hostname != 'localhost' && window.location.hostname != 'test.garlandtools.org',
    //isLive: true,

    initialize: function() {
        try {
            if (!gt.core.isLive)
                gt.serverPath = 'http://test.garlandtools.org';

            if (window.Sentry && gt.core.isLive) {
                Sentry.init({
                    dsn: 'https://b4e595358f314806a2bd3063f04fb1d7@sentry.io/172355',
                    environment: gt.core.isLive ? 'prod' : 'dev'
                 });
            }

            // Sanity check for essential resources.
            if (!window._) {
                gt.core.writeErrorMessage("Required resources failed to load.  Please ensure they are not blocked.  There are no ads on Garland Tools.\nDiagnostic load info: underscore");
                return;
            }
            var modules = [gt.time, gt.patch, gt.map, gt.craft, gt.item, gt.npc, gt.fate, gt.mob,
                gt.node, gt.fishing, gt.instance, gt.quest, gt.achievement, gt.action, gt.status, gt.leve,
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

        // todo: remove this check.
        if (data.materiaJoinRates)
            gt.item.materiaJoinRates = data.materiaJoinRates;
    },

    initializeCore: function() {
        try {
            var data = gt.settings.load();
            if (gt.core.ensureNormalizedUrl(data))
                return; // href is changing, don't do anything else.

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
            gt.status.initialize(data);
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

        if (window.Sentry && gt.core.isLive)
            window.Sentry.captureException(ex);

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
            gt.core.setActiveBlock($block, false);
            gt.list.blockSortingUpdated();

            if (done)
                done($block);
        });

        if (type == 'item' && gt.settings.data.isearchOnActivate) {
            var itemPartial = gt.item.partialIndex[id];
            if (itemPartial)
                gt.item.isearchCopy(itemPartial.n);
        }
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
        if (window.Sentry && gt.core.isLive) {
            window.Sentry.addBreadcrumb({
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
                if (window.Sentry && gt.core.isLive)
                    window.Sentry.captureException(ex);

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
                    if (window.Sentry && gt.core.isLive)
                        window.Sentry.captureException(new Error(status + ": " + url));
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
            if (window.Sentry && gt.core.isLive) {
                window.Sentry.addBreadcrumb({
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

    setActiveBlock: function($block, inUserEvent) {
        $('.block.active').removeClass('active');
        $block.addClass('active');

        gt.core.setHash($block);

        if (inUserEvent && gt.settings.data.isearchOnActivate) {
            var view = $block.data('view');
            if (view && view.type == 'item')
                gt.item.isearchCopy(view.name);
        }
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

        return encodeURI(hash);
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
        gt.core.setActiveBlock($block, true);
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
    },
    
    ensureNormalizedUrl: function(data) {
        if (!data.normalizeUrl || !gt.core.isLive)
            return false;

        var baseUrl = "https://garlandtools.org";
        if (window.location.origin.indexOf(baseUrl) == 0)
            return false;

        window.location.href = baseUrl + window.location.pathname + window.location.hash;
        return true;
    }
};
gt.util = {
    abbrCache: {},

    pascalCase: function(str) {
        return str.replace(/(\w)(\w*)/g,
            function(g0,g1,g2) { return g1.toUpperCase() + g2.toLowerCase(); });
    },

    zeroPad: function(num, digits) {
        return ("00000000" + num).slice(-digits);
    },

    repeat: function(str, times) {
        var result = "";
        for (var i = 0; i < times; i++)
            result += str;
        return result;
    },

    stars: function(stars) {
        return stars ? (' ' + gt.util.repeat('&#x2605', stars)) : '';
    },

    abbr2: function(str) {
        var parts = str.trim().replace('(', '').split(' ');
        var a = parts[0].length ? parts[0][0] : '';
        if (parts.length == 1)
            return a;
        var b = parts[1].length ? parts[1][0] : '';
        return a + b;
    },

    abbr: function(str) {
        if (!str)
            return '';

        if (gt.util.abbrCache[str])
            return gt.util.abbrCache[str];

        var parts = str.replace('(', '').split(' ');
        var result = _.map(parts, function(p) { return p[0]; }).join('');
        gt.util.abbrCache[str] = result;
        return result;      
    },

    pushAll: function(src, dest) {
        for (var i = 0; i < src.length; i++)
            dest.push(src[i]);
        return dest;
    },

    sum: function(arr, selector) {
        return _.reduce(arr, function(m, i) { return m + selector(i); }, 0);
    },

    average: function(arr, selector) {
        return gt.util.sum(arr, selector) / arr.length;
    },

    plural: function(str, arr) {
        return str + ((arr.length > 1) ? 's' : '');
    },

    pluralNum: function(str, num) {
        return str + ((num > 1) ? 's' : '');
    },

    floor2: function(num) {
        return Math.floor(num * 100) / 100;;
    },

    round2: function(num) {
        return Math.round(num * 100) / 100;
    },

    round1: function(num) {
        return Math.round(num * 10) / 10;
    },

    uint: function(num) {
        return (num << 32) >>> 0;
    },

    sanitize: function(str) {
        return str.replace(/[\s'\?\(\)\.\:/\!"<>\\\+&,]/g, '');
    },

    check: function($checkbox, val) {
        $checkbox.prop('checked', val ? true : false);
    },

    distance: function(x, y, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x, 2) + Math.pow(y2 - y, 2));
    },

    showNotification: function(title, options) {
        try {
            var n = new window.Notification(title, options);
            setTimeout(function() {
                try {
                    n.close();
                } catch (ex) {
                    // Ignore authorization errors, probably from the notification disappearing already.
                }
            }, 45 * 1000);
        } catch (ex) {
            // Ignore illegal constructor errors.
        }
    },

    post: function(url, data, callback) {
        $.post(gt.serverPath + url, data, function(result) {
            if (!result)
                callback(null, "No result.");
            else if (result.error)
                callback(null, result.error);
            else
                callback(result);
        }, "json");
    },

    api: function(data, callback) {
        gt.util.post("/api.php", data, callback);
    },

    mapByIndex: function(map, indexes) {
        var result = [];
        for (var i = 0; i < indexes.length; i++) {
            var entry = map[indexes[i]];
            if (entry)
                result.push(entry);
        }
        return result.length ? result : null;
    },

    // HTML escaping from mustache.js
    htmlEntityMap: {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    },
      
    escapeHtml: function(string) {
        return String(string).replace(/[&<>"'`=\/]/g, function (s) {
            return gt.util.htmlEntityMap[s];
        });
    },

    makeId: function(len) {
        var keyspace = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var values = crypto.getRandomValues(new Uint8Array(len));
        return Array.from(values, function(i) { return keyspace.charAt(i % keyspace.length); }).join('');
    }
};

// Natural Sort algorithm for Javascript - Version 0.7 - Released under MIT license
// Author: Jim Palmer (based on chunking idea from Dave Koelle)
// https://github.com/overset/javascript-natural-sort
function naturalSort (a, b) {
    var re = /(^-?[0-9]+(\.?[0-9]*)[df]?e?[0-9]?$|^0x[0-9a-f]+$|[0-9]+)/gi,
        sre = /(^[ ]*|[ ]*$)/g,
        dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/,
        hre = /^0x[0-9a-f]+$/i,
        ore = /^0/,
        i = function(s) { return naturalSort.insensitive && (''+s).toLowerCase() || ''+s },
        // convert all to strings strip whitespace
        x = i(a).replace(sre, '') || '',
        y = i(b).replace(sre, '') || '',
        // chunk/tokenize
        xN = x.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
        yN = y.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
        // numeric, hex or date detection
        xD = parseInt(x.match(hre)) || (xN.length != 1 && x.match(dre) && Date.parse(x)),
        yD = parseInt(y.match(hre)) || xD && y.match(dre) && Date.parse(y) || null,
        oFxNcL, oFyNcL;
    // first try and sort Hex codes or Dates
    if (yD)
        if ( xD < yD ) return -1;
        else if ( xD > yD ) return 1;
    // natural sorting through split numeric strings and default strings
    for(var cLoc=0, numS=Math.max(xN.length, yN.length); cLoc < numS; cLoc++) {
        // find floats not starting with '0', string or 0 if not defined (Clint Priest)
        oFxNcL = !(xN[cLoc] || '').match(ore) && parseFloat(xN[cLoc]) || xN[cLoc] || 0;
        oFyNcL = !(yN[cLoc] || '').match(ore) && parseFloat(yN[cLoc]) || yN[cLoc] || 0;
        // handle numeric vs string comparison - number < string - (Kyle Adams)
        if (isNaN(oFxNcL) !== isNaN(oFyNcL)) { return (isNaN(oFxNcL)) ? 1 : -1; }
        // rely on string comparison if different types - i.e. '02' < 2 != '02' < '2'
        else if (typeof oFxNcL !== typeof oFyNcL) {
            oFxNcL += '';
            oFyNcL += '';
        }
        if (oFxNcL < oFyNcL) return -1;
        if (oFxNcL > oFyNcL) return 1;
    }
    return 0;
}
gt.patch = {
    current: null,
    pluralName: 'Patches',
    type: 'patch',
    index: {},
    partialIndex: {},
    categoryIndex: {},
    version: 2,
    browse: [
        { type: 'group', prop: 'series' },
        { type: 'sort', prop: 'id' }
    ],
    majorPatchBrowse: [
        { type: 'group', prop: 'patch', combine: { none: 1 } },
        { type: 'group', prop: 'type', combine: { none: 1 } },
        { type: 'group', prop: 'category', combine: { header: 'none' } },
        { type: 'paginate' },
        { type: 'sort', prop: 'id' }
    ],

    initialize: function(data) {
        var current = gt.patch.partialIndex[gt.patch.current];

        if (!current) {
            console.error('Failed to find patch info', gt.patch.current, _.keys(gt.patch.partialIndex));
            return;
        }

        $('.title .patch-link')
            .attr('data-id', current.id)
            .html(current.name + '<br>' + 'Patch ' + current.id);
    },

    bindEvents: function($block, blockData, view) {
        gt.browse.bindEvents($block, blockData, view);
    },

    cache: function(data) {
        var majorPatch = { id: data.patch.id, name: data.patch.name, series: data.patch.series, data: [] };

        for (var patch in data.patch.patches) {
            var patchData = data.patch.patches[patch];
            for (var type in patchData) {
                var typeData = patchData[type];
                var module = gt[type];
                if (!module)
                    continue;

                for (var i = 0; i < typeData.length; i++) {
                    var obj = typeData[i];
                    if (module.partialIndex)
                        module.partialIndex[obj.i] = obj;

                    var entry = { id: obj.i, type: type, patch: patch };
                    if (type == 'item' && obj.g !== undefined)
                        entry.category = gt.patch.categoryIndex[obj.g];
                    majorPatch.data.push(entry);
                }
            }
        }

        gt.patch.index[data.patch.id] = majorPatch;
    },

    getViewModel: function(obj, data) {
        obj = gt.patch.index[obj.id]; // Swap with processed version.

        var fillData = gt.patch.fillPatchGroups(obj);

        var view = {
            id: obj.id,
            type: 'patch',
            name: '[' + obj.id + '] ' + obj.name,
            template: gt.browse.blockTemplate,
            blockClass: 'tool browse expand-right',
            subheader: obj.series + ' Patch',
            tool: 1,
            settings: 1,

            headerIcon: '../files/patch/' + obj.id + '.png',
            list: 'group',
            menu: 'root',
            depth: 1,
            groupMap: fillData.groupMap,
            entries: fillData.entries,
            count: gt.util.sum(fillData.entries, function(e) { return e.count; }),
            icon: fillData.entries[0].icon,
            browseIcon: fillData.entries[0].browseIcon || fillData.entries[0].icon
        };

        return view;
    },

    fillPatchGroups: function(obj) {
        var groupMap = {};  
        var rootEntries = gt.browse.groupCategory(_.values(obj.data), gt.patch.majorPatchBrowse, 0, 'root', groupMap);

        var processEntry = function(e, index, getViewModel, categoryFunc) {
            var processedEntries = [];

            // Find module info.
            if (e.prop == 'type') {
                var module = gt[e.value];
                var category = module.browse[module.browse.length - 1];
                categoryFunc = category.func || function(o) { return o[category.prop]; };
                index = module.partialIndex || module.index;
                getViewModel = module.getPartialViewModel || module.getViewModel;

                e.header = module.pluralName;
            }

            if (e.list == 'sort') {
                for (var i = 0; i < e.entries.length; i++) {
                    var partial = index[e.entries[i].id];
                    if (partial)
                        processedEntries.push(getViewModel(partial));
                }
            } else {
                for (var i = 0; i < e.entries.length; i++) {
                    var processed = processEntry(e.entries[i], index, getViewModel, categoryFunc);
                    if (processed)
                        processedEntries.push(processed);
                }
            }

            if (processedEntries.length) {
                e.entries = processedEntries;
                e.count = processedEntries[0].count ? gt.util.sum(processedEntries, function(e) { return e.count; }) : processedEntries.length;
                e.icon = processedEntries[0].icon;
                e.browseIcon = processedEntries[0].browseIcon || e.icon;
                return e;
            }

            // Some patch data exists for untracked data.  Filter it out.
            return null;
        };

        var processedRoot = [];
        for (var i = 0; i < rootEntries.length; i++) {
            var entry = processEntry(rootEntries[i]);
            if (entry)
                processedRoot.push(entry);
        }

        return { entries: processedRoot, groupMap: groupMap };
    },

    getPartialViewModel: function(partial) {
        var view = {
            id: partial.id,
            type: 'patch',
            name: '[' + partial.id + '] ' + partial.name,
            series: partial.series,
            icon: 'images/LatestPatch.png'
        };

        return view;
    }
};
gt.browse = {
    blockTemplate: null,
    groupTemplate: null,
    listTemplate: null,
    index: { patch: 'patch' },
    version: 2,
    type: 'browse',

    initialize: function(data) {
        gt.browse.blockTemplate = doT.template($('#block-browse-template').text());
        gt.browse.groupTemplate = doT.template($('#group-browse-template').text());
        gt.browse.listTemplate = doT.template($('#list-browse-template').text());

        // Backbone.js & Underscore.js Natural Sorting
        // @author Kevin Jantzer <https://gist.github.com/kjantzer/7027717>
        // @since 2013-10-17
        _.mixin({
            sortByNatural: function(obj, value, context) {
                var iterator = _.isFunction(value) ? value : function(obj){ return obj[value]; };
                return _.pluck(_.map(obj, function(value, index, list) {
                return {
                    value: value,
                    index: index,
                    criteria: iterator.call(context, value, index, list)
                };
                }).sort(function(left, right) {
                var a = left.criteria;
                var b = right.criteria;
                return naturalSort(a, b);
                }), 'value');
            }
        });
    },

    cache: function(data, id) {
        var partialIndex = gt[id].partialIndex;
        _.each(data.browse, function(p) { partialIndex[p.i] = p; });

        gt.browse.index[id] = id;
    },

    bindEvents: function($block, blockData, view) {
        // These groups contain so many entries it's best to lazy-load them
        // when clicked.
        $block.bind('page-loaded', function(e) {
            var group = view.groupMap[e.page];
            if (group.loaded)
                return; // Do nothing.
            group.loaded = 1;

            var $page = $('.' + e.page, e.target);
            $page.append(gt.browse.listTemplate(group));
            gt.list.layout();

            $('.block-link', $page).click(gt.core.blockLinkClicked);
        });
    },

    getViewModel: function(unused, data) {
        var module = gt[data.id];
        if (!module || !module.browse)
            throw new Error('Invalid browse module: ' + data.id);

        var index = module.partialIndex;
        var getViewModel = module.getPartialViewModel || module.getViewModel;
        var values = _.values(index);
        var models = _.map(values, getViewModel);
        var groupMap = {};
        var entries = gt.browse.groupCategory(models, module.browse, 0, 'root', groupMap);

        var view = {
            id: data.id,
            type: 'browse',
            name: module.pluralName,
            template: gt.browse.blockTemplate,
            blockClass: 'tool expand-right',
            subheader: 'Browse Tool',
            tool: 1,
            settings: 1,

            list: module.browse[0].type,
            menu: 'root',
            depth: 1,
            groupMap: groupMap,
            entries: entries,
            count: gt.util.sum(entries, function(e) { return e.count; }),
            icon: entries[0].icon,
            browseIcon: entries[0].browseIcon || entries[0].icon
        };

        return view;
    },

    groupCategory: function(list, categories, categoryIndex, path, groupMap) {
        var category = categories[categoryIndex];
        var categoryFunc = category.func || function(e) { return e[category.prop]; };
        if (category.type == 'sort') {
            // Cap off the group with a sort.  Natural sort is too slow.
            var result = _.sortBy(list, categoryFunc);
            return category.reverse ? result.reverse() : result;
        }
        var iconFunc = category.iconFunc || function(k, e) { return e.browseIcon || e.icon; };

        var groupObject;
        if (category.type == 'paginate')
            groupObject = gt.browse.paginate(list);
        else // Group list at this level.
            groupObject = _.groupBy(list, categoryFunc);

        // Probably a mistake in the browse definition, exit.
        var nextCategoryIndex = categoryIndex + 1;
        if (nextCategoryIndex >= categories.length) {
            console.error('Browse category overrun.  Must terminate with sort.');
            return [];
        }

        // Process group and setup subgroups if applicable.
        var group = [];
        for (var key in groupObject) {
            var newPath = path + '-' + gt.util.sanitize(key);
            var entries = gt.browse.groupCategory(groupObject[key], categories, nextCategoryIndex, newPath, groupMap);
            var firstEntry = entries[0];
            var nextCategory = categories[nextCategoryIndex];
            var sub = {
                list: nextCategory.type,
                prop: category.prop,
                menu: newPath,
                header: key,
                value: key,
                depth: nextCategoryIndex,
                entries: entries,
                count: firstEntry.count ? gt.util.sum(entries, function(e) { return e.count; }) : entries.length,
                icon: firstEntry.icon,
                browseIcon: iconFunc(key, firstEntry)
            };
            group.push(sub);

            // If the group only contains one entry, combine!
            if (entries.length == 1 && sub.list != 'sort' && sub.list != 'header' && !(nextCategory.combine && nextCategory.combine.none)) {
                sub.list = firstEntry.list;
                if (firstEntry.header && firstEntry.header != sub.header && (nextCategory.combine && nextCategory.combine.header != 'none')) {
                    if (firstEntry.header.indexOf(sub.header) == 0)
                        sub.header = firstEntry.header;
                    else
                        sub.header += ', ' + firstEntry.header;
                }
                sub.entries = firstEntry.entries;
            }

            // Map these entries.
            groupMap[newPath] = sub;
        }

        // Lots of numbers, needs natural sort.
        var sortedGroup = _.sortByNatural(group, function(e) { return e.header; });
        return category.reverse ? sortedGroup.reverse() : sortedGroup;
    },

    paginate: function(list) {
        var pageSize = 100;

        var pages = {};
        for (var i = 0; i < list.length; i++) {
            var page = parseInt(i / pageSize) + 1;
            if (!pages[page])
                pages[page] = [];
            pages[page].push(list[i]);
        }

        var group = {};
        for (var page in pages) {
            var start = (pageSize * (page - 1)) + 1;
            var end = Math.min(pageSize * page, list.length);
            group[start + " - " + end] = pages[page];
        }

        return group;
    },

    // Common transforms for grouping and sorting.

    transformLevelRange: function(view) {
        return gt.browse.transformLevelRangeCore(view.lvl, 5);
    },

    transformLevelRangeCore: function(lvl, step) {
        if (!step)
            step = 5;

        // Transform into level ranges e.g. 1-4, 5-9, 10-14, etc.
        var low = Math.floor(lvl / step) * step;
        var high = low + step - 1;
        return 'Level ' + Math.max(1, low) + '-' + high;
    },

    transformLevel: function(view) {
        return 'Level ' + view.lvl;
    },

    transformLevelAndName: function(view) {
        return gt.util.zeroPad(view.lvl, 2) + view.name;
    }
};
gt.time = {
    epochTimeFactor: 20.571428571428573, // 60 * 24 Eorzean minutes (one day) per 70 real-world minutes.
    millisecondsPerEorzeaMinute: (2 + 11/12) * 1000,
    millisecondsPerDay: 24 * 60 * 60 * 1000,
    moons: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'],
    hours: {hour: '2-digit'},
    hoursMinutes: {hour: '2-digit', minute: '2-digit'},
    hoursMinutesUTC: {hour: '2-digit', minute: '2-digit', timeZone: 'UTC'},
    hoursMinutesSeconds: {hour: '2-digit', minute: '2-digit', second: '2-digit'},
    monthDay: {month: 'numeric', day: 'numeric'},
    blockTemplate: null,
    timeUpdateKey: null,
    timerUpdateKey: null,
    is24Hour: false,
    languageCode: "en-US",

    initialize: function(settings) {
        gt.time.blockTemplate = doT.template($('#block-time-template').text());

        try {
            var sample = (new Date()).toLocaleTimeString(navigator.language);
            if (sample.indexOf('M') == -1)
                gt.time.is24Hour = true;

            gt.time.languageCode = navigator.language;
        } catch (ex) {
            console.error("Time formatting failure.  Defaulting to en-US.  navigator.language: ", navigator.language, ex);
            // Sometimes the language here doesn't work.  Fall back to en-US.
        }

        if (settings.eorzeaTimeInTitle)
            gt.time.ensureTimeUpdate();       
    },

    getViewModel: function(id, data) {
        gt.time.ensureTimeUpdate();

        var eTime = gt.time.eCurrentTime();
        var phase = gt.time.moonPhase(eTime);

        return {
            id: id,
            type: 'time',
            name: 'Eorzea Time',
            template: gt.time.blockTemplate,
            blockClass: 'tool noexpand',
            icon: '../files/icons/moon/' + phase.moon + '.png',
            subheader: 'Time Tool',
            tool: 1,

            initialTime: gt.time.formatTime(eTime, gt.time.hoursMinutesUTC),
            initialPeriod: gt.time.getTimePeriod(eTime),
            moon: phase.moon,
            moonPercent: phase.percent
        };
    },

    getTimePeriod: function(eTime) {
        var hours = eTime.getUTCHours();
        if (hours < 6)
            return 'night';
        else if (hours < 12)
            return 'morning';
        else if (hours < 18)
            return 'day';
        else
            return 'dusk';
    },

    ensureTimeUpdate: function() {
        if (gt.time.timeUpdateKey)
            return;

        gt.time.timeUpdateKey = setInterval(gt.time.timeUpdate, gt.time.millisecondsPerEorzeaMinute);
    },

    timeUpdate: function() {
        var $blocks = $('.time.block');
        if (!gt.settings.data.eorzeaTimeInTitle && !$blocks.length)
            return;

        var eTime = gt.time.eCurrentTime();
        var time = gt.time.formatTime(eTime, gt.time.hoursMinutesUTC);

        if (gt.settings.data.eorzeaTimeInTitle)
            $('title').text(time + ' Garland Tools Database');

        if (!$blocks.length)
            return;

        var period = gt.time.getTimePeriod(eTime);

        $('.current-time', $blocks).text(time);

        var $period = $('.time-period', $blocks);
        if (!$period.hasClass(period)) {
            $('.time-period', $blocks).removeClass('night day dusk morning').addClass(period);

            var phase = gt.time.moonPhase(eTime);
            $('.moon, .title-icon', $blocks)
                .attr('src', '../files/icons/moon/' + phase.moon + '.png')
                .attr('title', phase.moon + ", " + phase.percent + "%");
        }

        if (eTime.getUTCMinutes() == 0)
            gt.display.minimap();
    },

    now: function() {
        var date = new Date();
        if (gt.time.timeOffset)
            date.setTime(date.getTime() + gt.time.timeOffset);
        return date;
    },

    localToEorzea: function(date) {
        return new Date(date.getTime() * gt.time.epochTimeFactor);
    },

    eorzeaToLocal: function(date) {
        return new Date(date.getTime() / gt.time.epochTimeFactor);
    },

    eCurrentTime: function() {
        return gt.time.localToEorzea(new Date());
    },

    formatTime: function(date, options) {
        try {
            return date.toLocaleTimeString(gt.time.languageCode, options || gt.time.hoursMinutesSeconds);
        } catch (ex) {
            // Chrome has an undefined timezone problem with some
            // configurations.  Fall back to date.toLocaleTimeString() with no
            // args.  Probably breaks some formatting.
            return date.toLocaleTimeString();
        }
    },

    formatDateTime: function(date) {
        if (!date)
            return '(error)';
        
        return date.toLocaleDateString(gt.time.languageCode, gt.time.monthDay) + ' ' + gt.time.formatTime(date);
    },

    formatEorzeaHour: function(eDate) {
        return gt.util.zeroPad(eDate.getUTCHours(), 2);
    },

    formatHours: function(hour) {
        if (gt.time.is24Hour)
            return hour;

        if (hour == 0)
            hour = 24;

        return ((hour - 1) % 12 + 1) + ' ' + (hour > 11 && hour < 24 ? 'PM' : 'AM');
    },

    getPercentTimeDifference: function(start, end) {
        var start = start.getTime();
        var end = end.getTime();
        var now = (gt.time.now()).getTime();
        return ((now - start) / (end - start)) * 100;
    },

    formatCountdown: function(end) {
        var remainingSeconds = (end.getTime() - (new Date()).getTime()) / 1000;
        if (remainingSeconds <= 0)
            return '0:00';

        var hours = Math.floor(remainingSeconds / 3600);
        var minutes = Math.floor((remainingSeconds % 3600) / 60);
        var seconds = Math.floor((remainingSeconds % 3600) % 60);

        if (hours)
            return hours + ':' + gt.util.zeroPad(minutes, 2) + ':' + gt.util.zeroPad(seconds, 2);
        else
            return minutes + ':' + gt.util.zeroPad(seconds, 2);
    },

    moonPhase: function(eDate) {
        var daysIntoCycle = gt.time.daysIntoLunarCycle(eDate);
        // 16 days until new or full moon.
        var percent = Math.round(((daysIntoCycle % 16) / 16) * 100);
        // 4 days per moon.
        var index = Math.floor(daysIntoCycle / 4);
        return { moon: gt.time.moons[index], percent: percent };
    },

    daysIntoLunarCycle: function(eDate) {
        // Moon is visible starting around 6pm.  Change phase around noon when
        // it can't be seen.
        return ((eDate.getTime() / (1000 * 60 * 60 * 24)) + .5) % 32;
    },

    nextMoonPhase: function(eDate, moon, interCycleHourOffset) {
        var daysIntoCycle = gt.skywatcher.daysIntoLunarCycle(eDate);
        var daysNeeded = moon * 4;

        var offsetDays = (daysNeeded - daysIntoCycle) + (interCycleHourOffset / 24);

        // Use next month if this time is in the past.
        if (offsetDays <= 0)
            offsetDays += 32;

        var ticks = eDate.getTime() + (offsetDays * gt.time.millisecondsPerDay);
        return new Date(ticks);
    },

    progress: function(current, timer) {
        var period = timer.period;

        // Start from a position of dormancy.
        var progress = {
            start: period.lastExpire,
            end: period.active,
            change: period.active,
            percent: null,
            time: null,
            countdown: null
        };

        var minutesDiff = (period.active.getTime() - current.getTime()) / 60000;
        if (minutesDiff > 0 && minutesDiff <= 5) {
            // Active within 5 minutes.
            progress.state = 'spawning';
            progress.time = gt.time.formatTime(gt.time.removeOffset(progress.change));
        } else if (minutesDiff < 0 && minutesDiff > -period.mUp) {
            // Active for {mUp} minutes.
            progress.state = 'active';
            progress.start  = period.expire;
            progress.end = period.active;
            progress.change = period.expire;
            progress.time = gt.time.formatTime(gt.time.removeOffset(period.expire));
        } else {
            // Dormant until 5 minutes before the next spawn.
            var spawning = new Date(period.active);
            spawning.setUTCMinutes(spawning.getUTCMinutes() - 5);
            progress.state = 'dormant';
            progress.change = spawning;

            if (minutesDiff >= 1440)
                progress.time = gt.time.formatDateTime(gt.time.removeOffset(period.active));
            else
                progress.time = gt.time.formatTime(gt.time.removeOffset(period.active));
        }

        progress.text = timer.availabilityStateText[progress.state];
        progress.percent = gt.time.getPercentTimeDifference(progress.start, progress.end);
        progress.countdown = gt.time.formatCountdown(progress.start > progress.end ? progress.start : progress.end);

        return progress;
    },

    update: function() {
        var now = gt.time.now();
        var update = false;

        var $timers = $('.block.timer');
        for (var i = 0; i < $timers.length; i++) {
            var $timer = $($timers[i]);
            var view = $timer.data('view');
            var timer = view.timer;

            // Update progress
            if (now > timer.progress.change) {
                timer.next(now);
                timer.progress = gt.time.progress(now, timer);

                $('.progress', $timer).removeClass('spawning active dormant').addClass(timer.progress.state);
            }

            // Update the progress bar.
            timer.progress.percent = gt.time.getPercentTimeDifference(timer.progress.start, timer.progress.end);
            $('.progress', $timer).css('width', timer.progress.percent + '%');

            // Update the remaining time.
            timer.progress.countdown = gt.time.formatCountdown(timer.progress.start > timer.progress.end ? timer.progress.start : timer.progress.end);
            $('.spawn-text', $timer).text(timer.availabilityStateText[timer.progress.state]);
            $('.spawn-time', $timer).text(timer.progress.time);
            $('.spawn-countdown', $timer).text(timer.progress.countdown);

            // Play an alarm if spawning node is a favorite.
            var data = $timer.data('block');
            if (!data || !data.alarms)
                continue;

            if (timer.progress.state == 'spawning') {
                var notify = false;
                if (timer.progress.countdown == '2:00') {
                    gt.display.playWarningAlarm();
                    notify = true;
                } else if (timer.progress.countdown == '0:01') {
                    gt.display.playAvailableAlarm();
                    notify = true;
                }

                if (notify && gt.settings.data.notifications && window.Notification && window.Notification.permission == "granted")
                    timer.notify();
            }
        }
    },

    removeOffset: function(offsetDate) {
        if (!gt.time.timeOffset)
            return offsetDate;

        var date = new Date(offsetDate);
        date.setTime(date.getTime() - gt.time.timeOffset);
        return date;
    },

    ensureTimerUpdate: function() {
        if (!gt.time.timerUpdateKey)
            gt.time.timerUpdateKey = setInterval(gt.time.update, 1000);
    }
};
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
    // TODO: materiaJoinRates comes from core data, only here temporarily until old cache is removed.
    materiaJoinRates: {"nq":[[90,48,28,16],[82,44,26,16],[70,38,22,14],[58,32,20,12],[17,10,7,5],[17,0,0,0],[17,10,7,5],[17,0,0,0],[100,100,100,100],[100,100,100,100]],"hq":[[80,40,20,10],[72,36,18,10],[60,30,16,8],[48,24,12,6],[12,6,3,2],[12,0,0,0],[12,6,3,2],[12,0,0,0],[100,100,100,100],[100,100,100,100]]},
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
            jobs: item.jobCategories,
            furniture: item.furniture
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

        // Gardening
        if (item.grow)
            view.gardening = _.union(view.gardening, gt.model.partialList(gt.item, item.grow, function(v) { v.right = 'Grows'; return v; }));

        if (item.seeds)
            view.gardening = _.union(view.gardening, gt.model.partialList(gt.item, item.seeds, function(v) { v.right = 'Seed'; return v; }));

        // Craft source
        if (view.ingredient_of) {
            var set = new gt.craft.set("transient", []);
            var step = new gt.craft.step(item.id, item, false, false, set);
            step.setSource(set);

            view.craftSource = step.sourceView;

            // Little hack to stop ventures from showing as clickable.
            if (step.sourceType != 'venture')
                view.craftSourceType = step.sourceType;
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
            || view.sell_price || view.supplyReward || (!view.unlistable && !view.untradeable) || view.reducesTo
            || view.gardening);

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
                        meld.nqRate = gt.item.materiaJoinRates.nq[materia.tier * 4 + ii - item.sockets];
                        meld.hqRate = gt.item.materiaJoinRates.hq[materia.tier * 4 + ii - item.sockets];
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
                var materiaItem = gt.item.partialIndex[id];
                var materia = materiaItem.materia;
                var rateStart = materia.tier * 4;
                var cumulativeJoinRate = gt.util.sum(gt.item.materiaJoinRates.hq.slice(rateStart, rateStart + 4), function(i) { return i; });
                var sortKey = gt.util.zeroPad(cumulativeJoinRate, 5) + "-" + gt.util.zeroPad(99 - materia.tier, 2) + "-" + materiaItem.n;
                return sortKey;
            });
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
            var materiaItems = _.filter(_.values(gt.item.partialIndex), function(i) { return i.materia && i.materia.value; });
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
        if (n)
            return n;
        if (name)
            return name.replace('Resistance', 'Res.');
        return "Error";
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
        var gcTrade = gt.item.findTrade(item.tradeShops, function(tradeItem, type) {
            return type == 'currency' && (tradeItem.id == 20 || tradeItem.id == 21 || tradeItem.id == 22);
        });
        
        if (gcTrade)
            return gcTrade;

        // Prefer nq listings.
        var nqTrade = gt.item.findTrade(item.tradeShops, function(tradeItem, type) {
            return type == 'reward' && tradeItem.id == item.id && !tradeItem.hq
        });

        if (nqTrade)
            return nqTrade;

        // Fallback to the first listed trade.
        return item.tradeShops[0].listings[0];
    },

    findTrade: function(tradeList, predicate) {
        for (var i = 0; i < tradeList.length; i++) {
            var shop = tradeList[i];
            for (var ii = 0; ii < shop.listings.length; ii++) {
                var listing = shop.listings[ii];
                for (var iii = 0; iii < listing.item.length; iii++) {
                    if (predicate(listing.item[iii], 'reward'))
                        return listing;
                }
                for (var iii = 0; iii < listing.currency.length; iii++) {
                    if (predicate(listing.currency[iii], 'currency'))
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
        var modelPrefix = view.minion ? 'minion' : view.mount ? 'mount' : view.furniture ? 'furniture' : view.slot;
        var modelKeys = _.map(view.models, function(m) { return modelPrefix + '/' + m; });
        var url = '3d/viewer.html?id=' + modelKeys.join('+');
        var html = '<iframe class="model-viewer" src="' + url + '"></iframe>';
        $page.empty().append($(html));
    },

    isearchCopy: function(itemName) {
        if (!navigator.clipboard)
            return;

        var isearch = '/isearch "' + itemName + '"';
        var promise = navigator.clipboard.writeText(isearch);
        if (promise) {
            promise.catch(function(err) {
                console.error('Clipboard write error', err);
            });
        }
    }
};
gt.npc = {
    pluralName: 'NPCs',
    type: 'npc',
    blockTemplate: null,
    tradeEntryTemplate: null,
    index: {},
    partialIndex: {},
    version: 2,
    browse: [
        { type: 'group', prop: 'region' },
        { type: 'group', prop: 'location' },
        { type: 'sort', prop: 'name' }
    ],
    availabilityStateText: { 'active': 'Available until', 'dormant': 'Available at', 'spawning': 'Available at' },

    initialize: function(data) {
        gt.npc.blockTemplate = doT.template($('#block-npc-template').text());
        gt.npc.tradeEntryTemplate = doT.template($('#trade-entry-template').text());
    },

    cache: function(data) {
        gt.npc.index[data.npc.id] = data.npc;
    },

    bindEvents: function($block, data, view) {
        if (view.timer) {
            gt.display.notifications($block, data);
            gt.time.ensureTimerUpdate();
        }
    },

    getTradeViewModel: function(entry) {
        var transform = function(v, entryItem) {
            v.obj = entryItem;
            v.amount = entryItem.amount;
            v.hq = entryItem.hq;
            v.collectability = entryItem.collectability;
            return v;
        };

        return {
            item: gt.model.partialList(gt.item, entry.item, transform),
            currency: gt.model.partialList(gt.item, entry.currency, transform)
        };
    },

    getPartialViewModel: function (partial) {
        if (!partial) {
            console.error("Invalid NPC partial, ignoring.");
            return null;
        }

        var view = {
            id: partial.i,
            type: 'npc',
            name: partial.n,
            sourceName: partial.n,
            longSourceName: partial.n,
            icon: gt.npc.getPartialIcon(partial),
            byline: partial.t,
            obj: partial
        };

        var location = partial.l ? gt.location.index[partial.l] : null;
        if (location) {
            view.location = location.name;
            view.byline = (view.byline ? view.byline + ', ' : '') + view.location;
            view.sourceName = view.name + ", " + gt.util.abbr(view.location);
            view.longSourceName = view.name + ", " + view.location;

            if (location.parentId)
                view.region = gt.location.index[location.parentId].name;
            else
                view.region = 'Other';
        }
        else {
            view.location = '';
            view.region = '';
        }

        return view;
    },

    getViewModel: function(npc, data) {
        var view = {
            id: npc.id,
            type: 'npc',
            name: npc.name,
            patch: gt.formatPatch(npc.patch),
            template: gt.npc.blockTemplate,
            icon: gt.npc.getIcon(npc),
            subheader: 'NPC',
            settings: 1,

            title: npc.title,
            obj: npc,
            appearance: npc.appearance
        };

        view.byline = view.title;

        if (npc.zoneid) {
            var location = gt.location.index[npc.zoneid];
            if (location) {
                view.fullLocation = view.location = location.name;
                if (npc.coords) {
                    view.fullLocation += ' (' + Math.round(npc.coords[0]) + ', ' + Math.round(npc.coords[1]) + ')';
                    view.map = gt.map.getViewModel({ location: location, coords: npc.coords, approx: npc.approx, icon: view.icon });
                }
            }
        }

        if (npc.areaid) {
            var area = gt.location.index[npc.areaid];
            if (area)
                view.area = area.name;
        }

        if (data) {
            var altParts = [];

            // Shops
            if (npc.shops) {
                for (var i = 0; i < npc.shops.length; i++) {
                    var shop = npc.shops[i];
                    if (shop.trade) {
                        var entries = _.map(shop.entries, gt.npc.getTradeViewModel);
                        if (!view.trades)
                            view.trades = [];
                        view.trades.push({ name: shop.name, entries: entries });
                    } else {
                        if (!view.shops)
                            view.shops = [];

                        var items = gt.model.partialList(gt.item, shop.entries);
                        items = _.sortBy(items, function(i) { return i.name; });
                        view.shops.push({ name: shop.name, items: items });
                    }
                }
            }

            if (npc.alts) {
                view.alts = gt.model.partialList(gt.npc, npc.alts, function(v, id) {
                    var alt = v.obj;
                    var altDesc = [];
                    if (alt.s)
                        altDesc.push(alt.s + ' ' + gt.util.pluralNum('shop', alt.s));
                    if (alt.q)
                        altDesc.push(alt.q + ' ' + gt.util.pluralNum('quest', alt.q));
                    if (alt.k)
                        altDesc.push(alt.k + ' ' + gt.util.pluralNum('dialogue', alt.k));

                    if (!altDesc.length)
                        altDesc.push("Other");

                    v.desc = altDesc.join(', ');
                    v.isCurrent = alt.i == npc.id;
                    v.location = v.location || '???';
                    return v;
                });
            }

            if (npc.quests)
                view.quests = gt.model.partialList(gt.quest, npc.quests);

            if (npc.talk) {
                view.talk = _.map(npc.talk, function(t) {
                    var result = { lines: t.lines };
                    if (t.questid)
                        result.quest = gt.model.partial(gt.quest, t.questid);
                    return result;
                });
            }

            if (npc.tripletriad) {
                view.tripletriad = $.extend({}, npc.tripletriad);
                view.tripletriad.cards = gt.model.partialList(gt.item, npc.tripletriad.cards);
                if (npc.tripletriad.rewards)
                    view.tripletriad.rewards = gt.model.partialList(gt.item, npc.tripletriad.rewards);

                if (view.tripletriad.start && view.tripletriad.end) {
                    view.audio = 1;
                    view.timer = new gt.npc.timer(new Date(), view);
                    view.blockClass = 'timer';
                }
            }

            if (npc.equipment) {
                view.equip = [];
                for (var i = 0; i < npc.equipment.length; i++) {
                    var entry = npc.equipment[i];
                    view.equip.push({
                        item: entry.id ? gt.model.partial(gt.item, entry.id) : null,
                        uncertainty: entry.uncertainty,
                        dye: entry.dye ? gt.dyes[entry.dye] : null,
                        slot: gt.item.equipSlotNames[entry.slot],
                        model: entry.model
                    });
                }
            }
        }

        return view;
    },

    getPartialIcon: function(partial) {
        if (partial.s) {
            if (partial.r)
                return 'images/marker/Trader.png'
            else
                return 'images/marker/Shop.png';
        }

        if (partial.q)
            return 'images/marker/Quest.png';

        if (partial.k)
            return 'images/Journal.png';

        return 'images/marker/UnknownNpc.png';
    },

    getIcon: function(npc) {
        if (npc.shops) {
            if (npc.trade)
                return 'images/marker/Trader.png'
            else
                return 'images/marker/Shop.png';
        }

        if (npc.quests)
            return 'images/marker/Quest.png';

        if (npc.talk)
            return 'images/Journal.png';

        if (npc.appearance && npc.appearance.hairStyle)
            return '../files/icons/customize/' + npc.appearance.hairStyle + '.png';
        
        return 'images/marker/UnknownNpc.png';
    },

    resolveCraftSource: function(step, id) {
        if (id == -1)
            id = 0;

        if (!id) {
            // Prefer Material Supplier (1008837) and (1005633) to other vendors.
            if (_.contains(step.item.vendors, 1008837))
                id = 1008837;
            else if (_.contains(step.item.vendors, 1005633))
                id = 1005633;
        }

        step.sourceType = 'npc';
        step.sourceView = gt.model.partial(gt.npc, id || step.item.vendors[0]);
        step.price = { currency: 1, cost: step.item.price, totalCost: step.item.price, yield: 1 }; // 1 is the id of gil.
        step.setCategory(['Gil Vendor', 'Vendor']);
    }
};

gt.npc.timer = function(now, npc) {
    // For triple triad.

    var eNow = gt.time.localToEorzea(now);
    var hUp = (24 + npc.tripletriad.end - npc.tripletriad.start) % 24;

    var active = new Date(eNow);
    active.setUTCMinutes(0);
    active.setUTCSeconds(0);
    active.setUTCHours(npc.tripletriad.start);

    var expire = new Date(active);
    expire.setUTCHours(npc.tripletriad.start + hUp);

    var lastExpire = new Date(expire);
    lastExpire.setUTCDate(lastExpire.getUTCDate() - 1);

    this.type = 'npc';
    this.view = npc;
    this.availabilityStateText = gt.npc.availabilityStateText;
    this.period = {
        active: gt.time.eorzeaToLocal(active),
        expire: gt.time.eorzeaToLocal(expire),
        lastExpire: gt.time.eorzeaToLocal(lastExpire),
        mUp: hUp * 60
    };
    this.next(now);
    this.progress = gt.time.progress(now, this);
};

gt.npc.timer.prototype.next = function(now) {
    if (this.period && this.period.expire > now)
        return false; // No period changes if this one hasn't expired yet.

    var expire = gt.time.localToEorzea(this.period.expire);
    expire.setUTCDate(expire.getUTCDate() + 1);

    var active = gt.time.localToEorzea(this.period.active);
    active.setUTCDate(active.getUTCDate() + 1);

    this.period.lastExpire = this.period.expire;
    this.period.expire = gt.time.eorzeaToLocal(expire);
    this.period.active = gt.time.eorzeaToLocal(active);
};

gt.npc.timer.prototype.notify = function() {
    gt.util.showNotification(this.view.name, {
        icon: 'images/marker/TripleTriad.png',
        body: this.view.fullLocation || "Available for Triple Triad",
        tag: this.view.id
    });
};
gt.mob = {
    pluralName: 'Mobs',
    type: 'mob',
    blockTemplate: null,
    index: {},
    partialIndex: {},
    version: 2,
    browse: null,

    initialize: function(data) {
        gt.mob.blockTemplate = doT.template($('#block-mob-template').text());
        gt.mob.browse = [
            { type: 'group', func: function(m) {
                if (m.lvl == '??')
                    return 'Level ' + m.lvl;
                else
                    return gt.browse.transformLevelRangeCore(Number(m.lvl.split(' - ')[0]), 5);
            } },
            { type: 'group', prop: 'region' },
            { type: 'header', prop: 'location' },
            { type: 'sort', func: gt.browse.transformLevelAndName }
        ];
    },

    cache: function(data) {
        gt.mob.index[data.mob.id] = data.mob;
    },

    getViewModel: function(mob, data) {
        var view = {
            id: mob.id,
            type: 'mob',
            name: mob.name,
            template: gt.mob.blockTemplate,
            icon: 'images/Mob.png',
            subheader: 'Level ' + mob.lvl + ' Mob',
            settings: 1,
            obj: mob,

            lvl: mob.lvl,
            quest: mob.quest
        };

        if (mob.instance) {
            var instance = gt.model.partial(gt.instance, mob.instance);
            view.location = instance.name;
            view.sourceName = view.name + ', ' + gt.util.abbr(instance.name);
            view.longSourceName = view.name + ', ' + instance.name;
            view.location_type = 'instance';
            view.location_id = instance.id;
            view.byline = view.location;
            view.region = 'Instance';
        } else {
            var location = gt.location.index[mob.zoneid];
            view.sourceName = view.name;
            view.longSourceName = view.name;
            view.byline = 'Lv. ' + view.lvl;
            if (location) {
                view.location = location.name;
                view.sourceName += ', ' + gt.util.abbr(location.name);
                view.longSourceName += ', ' + location.name;
                view.location_type = 'location';
                view.location_id = mob.zoneid;
                view.byline += ', ' + view.location;

                if (location.parentId)
                    view.region = gt.location.index[location.parentId].name;
                else
                    view.region = 'Instance';

                if (mob.coords)
                    view.map = gt.map.getViewModel({ location: location, coords: mob.coords, icon: view.icon });
            }
        }

        if (data) {
            if (mob.drops && mob.drops.length) {
                view.drops = gt.model.partialList(gt.item, mob.drops);
                view.drops = _.sortBy(view.drops, function(i) { return i.name; });
                view.item_text = 'Drops ' + view.drops.length + ' item' + (view.drops.length > 1 ? 's' : '');
            }

            if (mob.currency)
                view.currency = _.map(mob.currency, function(c) { return { item: gt.model.partial(gt.item, c.id), amount: c.amount }; });

            view.hasInfo = view.drops || view.currency || view.location_type == 'instance';
        }

        return view;
    },

    getPartialViewModel: function(partial) {
        var view = {
            id: partial.i,
            icon: 'images/Mob.png',
            name: gt.model.name(partial),
            type: 'mob',
            lvl: partial.l
        };

        if (partial.t) {
            view.byline = partial.t;
            view.location = partial.t;
            view.region = 'Instance';
            view.sourceName = view.name + ', ' + gt.util.abbr(partial.t);
            view.longSourceName = view.name + ', ' + partial.t;
        } else {
            var location = gt.location.index[partial.z];
            view.byline = 'Lv. ' + partial.l;
            view.sourceName = view.name;
            view.longSourceName = view.name;
            if (location) {
                view.byline += ', ' + location.name;
                view.location = location.name;
                view.region = location.parentId ? gt.location.index[location.parentId].name : 'Instance';
                view.sourceName += ', ' + gt.util.abbr(location.name);
                view.longSourceName += ', ' + location.name;
            }
        }

        return view;
    },

    resolveCraftSource: function(step, id) {
        var mob = id ? gt.model.partial(gt.mob, id) : null;
        if (!mob) {
            var list = gt.model.partialList(gt.mob, step.item.drops);
            if (!list)
                return;
            
            mob = _.sortBy(list, function(m) { return (m.quest ? 'zzz' : '') + m.name; })[0];
        }

        step.sourceType = 'mob';
        step.sourceView = mob;
        step.setCategory(['Mob', 'Other']);
    }
};
gt.node = {
    pluralName: 'Gathering Nodes',
    type: 'node',   
    blockTemplate: null,
    index: {},
    partialIndex: {},
    version: 2,
    bonusIndex: null,
    limitedNodeUpdateKey: null,
    types: ['Mineral Deposit', 'Rocky Outcropping', 'Mature Tree', 'Lush Vegetation', 'Spearfishing', 'Spearfishing'],
    jobAbbreviations: ['MIN', 'MIN', 'BTN', 'BTN', 'FSH', 'FSH'],
    browse: [
        { type: 'icon-list', prop: 'job' },
        { type: 'group', prop: 'region' },
        { type: 'header', prop: 'location' },
        { type: 'sort', func: gt.browse.transformLevelAndName }
    ],

    initialize: function(data) {
        gt.node.blockTemplate = doT.template($('#block-node-template').text());
    },

    cache: function(data) {
        gt.node.index[data.node.id] = data.node;
    },

    bindEvents: function($block, data, view) {
        if (!view.time)
            return;

        gt.display.notifications($block, data);

        if (!gt.node.limitedNodeUpdateKey)
            gt.node.limitedNodeUpdateKey = setInterval(gt.node.limitedNodeUpdate, 1000);
    },

    getViewModel: function(node, data) {
        if (!node) {
            console.error('Invalid node for view model.', data);
            return null;
        }

        var view = {
            id: node.id,
            type: 'node',
            name: node.name,
            patch: gt.formatPatch(node.patch),
            template: gt.node.blockTemplate,
            blockClass: node.time ? 'limited' : '',
            settings: 1,

            lvl: node.lvl,
            job: gt.node.jobAbbreviations[node.type],
            category: gt.node.types[node.type],
            limited: node.time ? 1 : 0,
            stars: node.stars,
            time: node.time,
            uptime: node.uptime,
            zone: gt.location.index[node.zoneid] || { name: 'Unknown' },
            coords: node.coords,
            obj: node
        };

        var typePrefix = '';

        view.icon = 'images/node/' + view.category + '.png';
        if (node.limitType) {
            typePrefix = node.limitType + ' ';
            view.icon = 'images/node/' + view.category + " Limited" + '.png';
        }
        view.subheader = "Level " + node.lvl + gt.util.stars(node.stars) + ' ' + typePrefix + view.category;

        view.byline = 'Lv. ' + view.lvl + gt.util.stars(view.stars) + ' ' + typePrefix + view.category;
        view.category = typePrefix + view.category;

        if (node.bonus)
            view.bonus = _.filter(_.map(node.bonus, function(b) { return gt.node.bonusIndex[b]; }));

        view.sourceName = gt.util.abbr(view.zone.name) + ', Lv. ' + view.lvl;
        view.longSourceName = view.zone.name + ', Lv. ' + view.lvl;
        view.location = view.zone.name;
        var region = gt.location.index[view.zone.parentId];
        if (region)
            view.region = region.name;

        if (data) {
            if (node.coords) {
                view.map = gt.map.getViewModel({
                    location: view.zone, coords: node.coords, radius: node.radius, approx: node.radius ? 0 : 1,
                    icon: view.icon
                });
            }

            view.items = gt.model.partialList(gt.item, node.items, function(v, i) {
                v.node_slot = i.slot;
                if (i.reduceId)
                    v.reduce = gt.model.partial(gt.item, i.reduceId);
                return v;
            });

            if (node.time)
                view.items = _.sortBy(view.items, function(i) { return i.node_slot || i.name; });
            else
                view.items = _.sortBy(view.items, function(i) { return i.name; });

            if (node.time) {
                view.audio = 1;
                view.timeText = _.map(node.time, gt.time.formatHours).join(', ');

                var info = gt.node.getSpawnInfo(view);
                view.nextSpawn = info.nextSpawn;
                view.spawnText = info.text;
                view.spawnState = info.state;
                view.progressStart = info.progressStart;
                view.progressEnd = info.progressEnd;
                view.initialProgressPercent = gt.time.getPercentTimeDifference(view.progressStart, view.progressEnd);
                view.initialSpawnRemaining = gt.node.checkSpawnRemainingTime(view, data);
            }

            if (node.unlockId)
                view.unlock = gt.model.partial(gt.item, node.unlockId);
        }

        return view;
    },

    getPartialViewModel: function(partial) {
        var name = gt.model.name(partial);
        var category = gt.node.types[partial.t];
        var iconName = category;
        if (partial.lt){
            iconName += " Limited";
        }
        var typePrefix = partial.lt ? (partial.lt + ' ') : '';
        var zone = gt.location.index[partial.z] || { name: 'Unknown' };
        var region = gt.location.index[zone.parentId];

        return {
            id: partial.i,
            type: 'node',
            name: name,
            sourceName: gt.util.abbr(zone.name) + ', Lv. ' + partial.l,
            longSourceName: name + ', ' + zone.name + ', Lv. ' + partial.l,
            byline: 'Lv. ' + partial.l + gt.util.stars(partial.s) + ' ' + typePrefix + category,
            icon: 'images/node/' + iconName + '.png',
            job: gt.node.jobAbbreviations[partial.t],
            zone: zone,
            location: zone.name,
            lvl: partial.l,
            region: region ? region.name : 'Unknown',
            limited: partial.ti ? 1 : 0,
            stars: partial.s,
            category: category
        };
    },

    resolveCraftSource: function(step, id) {
        var view = gt.model.partial(gt.node, id || step.item.nodes[0]);
        if (view) {
            step.sourceType = 'node';
            step.sourceView = view;
        }
        step.setCategory(['Gathering']);
    },

    limitedNodeUpdate: function() {
        var $blocks = $('.block.node.limited');
        if (!$blocks.length) {
            clearInterval(gt.node.limitedNodeUpdateKey);
            gt.node.limitedNodeUpdateKey = null;
            return;
        }

        var now = new Date();
        var epoch = now.getTime();

        _.each($blocks, function(block) {
            var $block = $(block);
            var $progress = $('.progress', $block);
            var view = $block.data('view');
            var data = $block.data('block');

            // Update spawn text
            var nextChange = $block.data('next-spawn-change');
            if (!nextChange || epoch >= nextChange) {
                var info = gt.node.getSpawnInfo(view);
                view.nextSpawn = info.nextSpawn;
                view.spawnState = info.state;
                view.progressStart = info.progressStart;
                view.progressEnd = info.progressEnd;

                $('.spawn-info', $block).text(info.text);
                $progress.removeClass('spawning active').addClass(info.state);
                $block.data('next-spawn-change', info.change.getTime() + 1001);
            }

            // Update the progress bar.
            var percent = gt.time.getPercentTimeDifference(view.progressStart, view.progressEnd);
            $progress.css('width', percent + '%');

            // Update the remaining time.
            $('.spawn-remaining', $block).text(gt.node.checkSpawnRemainingTime(view, data));
        });
    },

    checkSpawnRemainingTime: function(view, data) {
        var countdown = gt.time.formatCountdown(view.progressStart > view.progressEnd ? view.progressStart : view.progressEnd);
        if (data && data.alarms && view.spawnState == 'spawning') {
            var notify = false;
            if (countdown == '2:00') {
                notify = true;
                gt.display.playWarningAlarm();
            } else if (countdown == '0:01') {
                notify = true;
                gt.display.playAvailableAlarm();
            }

            if (notify && gt.settings.data.notifications)
                gt.node.notifyNode(view);
        }
        return countdown;
    },

    getSpawnTimes: function(eStart, times, uptime) {
        var eSpawn = new Date(eStart);
        eSpawn.setUTCDate(eSpawn.getUTCDate() - 2);
        eSpawn.setUTCMinutes(0);
        eSpawn.setUTCHours(0);
        eSpawn.setUTCSeconds(0);

        var eSpawnPrevious, eExpirePrevious;
        while (true) {
            for (var i = 0; i < times.length; i++) {
                eSpawn.setUTCHours(times[i]);
                var eExpire = new Date(eSpawn);
                eExpire.setUTCMinutes(uptime);

                if (eExpire > eStart) {
                    return { eSpawn: eSpawnPrevious, eExpire: eExpirePrevious, eNextSpawn: eSpawn, eNextExpire: eExpire  };
                } else {
                    eSpawnPrevious = new Date(eSpawn);
                    eExpirePrevious = new Date(eExpire);
                }
            }

            eSpawn.setUTCHours(0);
            eSpawn.setUTCDate(eSpawn.getUTCDate() + 1);
        }
    },

    getSpawnInfo: function(view) {
        var lCurrent = new Date();
        var eCurrent = gt.time.localToEorzea(lCurrent);

        // Calculate the current spawn, expiration, and record the next spawn time.
        var times = gt.node.getSpawnTimes(eCurrent, view.time, view.uptime);
        times.lNextSpawn = gt.time.eorzeaToLocal(times.eNextSpawn);
        times.lExpire = gt.time.eorzeaToLocal(times.eExpire);

        // Figure out the current state of the node.
        var info = { nextSpawn: times.lNextSpawn, progressStart: times.lExpire, progressEnd: times.lNextSpawn };
        var eorzeaMinutesDifference = (times.eNextSpawn.getTime() - eCurrent.getTime()) / 60000;

        if (eorzeaMinutesDifference > 0 && eorzeaMinutesDifference <= 120) {
            // Spawns within 2 hours.
            info.text = "Spawns at " + gt.time.formatTime(times.lNextSpawn);
            info.state = 'spawning';
            info.change = times.lNextSpawn;
        } else if (eorzeaMinutesDifference < 0 && eorzeaMinutesDifference > -view.uptime) {
            // Active for {uptime} minutes.
            var lNextExpire = gt.time.eorzeaToLocal(times.eNextExpire);
            info.text = "Active until " + gt.time.formatTime(lNextExpire);
            info.state = "active";
            info.change = lNextExpire;
            info.progressStart = lNextExpire;
            info.progressEnd = times.lNextSpawn;
        }  else {
            // Dormant until 2 hours before the next spawn.
            var eSpawning = new Date(times.eNextSpawn);
            eSpawning.setUTCHours(eSpawning.getUTCHours() - 2);

            info.text = "Spawns at " + gt.time.formatTime(times.lNextSpawn);
            info.state = 'dormant';
            info.change = gt.time.eorzeaToLocal(eSpawning);
        }

        return info;
    },

    sort: function(b) {
        if (b.type != 'node')
            return 'zzz ' + b.obj.name;

        var view = b.$block.data('view');

        if (!b.obj.limited)
            return 'azz ' + view.location + ' ' + view.lvl;

        var prefix = (view.spawnState == 'active') ? 'aaa ' : 'aaz ';
        return prefix + view.nextSpawn.getTime() + ' ' + view.location + ' ' + view.lvl;
    },

    notifyNode: function(view, data) {
        if (!window.Notification || window.Notification.permission != "granted")
            return;

        var stars = view.stars ? (' ' + gt.util.repeat('*', view.stars)) : '';
        var title = 'Lv. ' + view.lvl + stars + ' ' + view.name;
        var spawn = gt.time.formatTime(view.nextSpawn);
        var items = _.map(view.items, function(i) { return (i.node_slot ? '[' + i.node_slot + '] ' : '') + i.name; });
        gt.util.showNotification(title, {
            icon: view.items[0].icon,
            body: view.location + ' ' + spawn + '\r\n' + items.join(', '),
            tag: view.id
        });
    }
};

gt.fishing = {
    pluralName: 'Fishing Spots',
    type: 'fishing',
    blockTemplate: null,
    index: {},
    version: 2,
    partialIndex: {},
    categories: ['Ocean Fishing', 'Freshwater Fishing', 'Dunefishing', 'Skyfishing', 'Cloudfishing', 'Hellfishing', 'Aetherfishing', 'Saltfishing'],
    browse: [
        { type: 'group', prop: 'region' },
        { type: 'group', prop: 'location' },
        { type: 'sort', func: gt.browse.transformLevelAndName }
    ],

    initialize: function(data) {
        gt.fishing.blockTemplate = doT.template($('#block-fishing-template').text());
    },

    cache: function(data) {
        gt.fishing.index[data.fishing.id] = data.fishing;
    },

    getViewModel: function(spot, data) {
        var view = {
            obj: spot,
            id: spot.id,
            type: 'fishing',
            name: spot.name,
            patch: gt.formatPatch(spot.patch),
            template: gt.fishing.blockTemplate,
            blockClass: 'node',
            icon: 'images/job/FSH.png',
            settings: 1,

            lvl: spot.lvl,
            zone: spot.zoneid ? gt.location.index[spot.zoneid] : null,
            category: gt.fishing.categories[spot.category],
            browseIcon: 'images/job/FSH.png'
        };

        var zoneName = view.zone ? view.zone.name : "The Diadem";

        // Location and source
        view.sourceName = gt.util.abbr(zoneName) + ', Lv. ' + view.lvl;
        view.longSourceName = zoneName + ', Lv. ' + view.lvl;
        view.location = zoneName;
        var region = view.zone ? gt.location.index[view.zone.parentId] : null;
        if (region)
            view.region = region.name;
        else
            view.region = "Unknown";

        if (data) {
            view.items = gt.model.partialList(gt.item, spot.items, function(v, i) { return { item: v, lvl: i.lvl }; });

            if (view.zone) {
                view.map = gt.map.getViewModel({
                    location: view.zone, coords: [spot.x, spot.y], radius: spot.radius, approx: spot.approx,
                    icon: 'images/job/FSH.png', iconfilter: 'sepia(100%)'
                });
            }
        }

        view.subheader = 'Level ' + view.lvl + ' ' + view.category;
        view.byline = view.subheader;

        return view;
    },

    getPartialViewModel: function(partial) {
        var name = gt.model.name(partial);
        var zone = partial.z ? gt.location.index[partial.z] : null;
        var zoneName = zone ? zone.name : "The Diadem";
        var region = zone ? gt.location.index[zone.parentId] : null;

        return {
            id: partial.i,
            type: 'fishing',
            name: name,
            sourceName: gt.util.abbr(zoneName) + ', Lv. ' + partial.l,
            longSourceName: zoneName + ', Lv. ' + partial.l,
            byline: 'Level ' + partial.l + ' ' + gt.fishing.categories[partial.c],
            region: region ? region.name : "Unknown",
            location: zoneName,
            icon: 'images/job/FSH.png',
            lvl: partial.l
        };
    },

    resolveCraftSource: function(step, id) {
        step.sourceType = 'fishing';
        step.sourceView = gt.model.partial(gt.fishing, id || step.item.fishingSpots[0]);
        step.setCategory(['Fishing', 'Gathering']);
    }
};
gt.instance = {
    pluralName: 'Instances',
    type: 'instance',
    blockTemplate: null,
    index: {},
    partialIndex: {},
    version: 2,
    browse: [
        { type: 'icon-list', prop: 'category' },
        { type: 'group', reverse: 1, func: function(i)  { return gt.browse.transformLevelRangeCore(i.min_lvl, 10); } },
        { type: 'sort', reverse: 1, func: function(i) { return i.min_lvl + '-' + gt.util.zeroPad(i.min_ilvl || 0, 3); } }
    ],

    initialize: function(data) {
        gt.instance.blockTemplate = doT.template($('#block-instance-template').text());
    },

    cache: function(data) {
        gt.instance.index[data.instance.id] = data.instance;
    },

    getViewModel: function(instance, data) {
        var view = {
            obj: instance,
            id: instance.id,
            type: 'instance',
            name: instance.name,
            patch: gt.formatPatch(instance.patch),
            template: gt.instance.blockTemplate,
            settings: 1,
            icon: '../files/icons/instance/type/' + instance.categoryIcon + '.png',

            min_ilvl: instance.min_ilvl,
            desc: instance.description ? instance.description.replace('\n', '<br><br>') : '',
            time: instance.time,
            category: instance.category,
            healer: instance.healer,
            melee: instance.melee,
            tank: instance.tank,
            ranged: instance.ranged,
            dps: (instance.ranged || 0) + (instance.melee || 0)
        };

        view.sourceName = gt.util.abbr(instance.name);
        view.longSourceName = instance.name;

        view.requirements = gt.instance.getInstanceRequirements(instance);
        view.byline = view.requirements;
        view.subheader = "Level " + instance.min_lvl + ' ' + view.category;

        if (instance.fullIcon)
            view.fullIcon = '../files/icons/instance/' + instance.fullIcon + '.png';

        if (data) {
            var currencyTransform = function(c) { return { item: gt.model.partial(gt.item, c.id), amount: c.amount }; };

            if (instance.fights) {
                view.fights = _.map(instance.fights, function(f) {
                    var fightView = {
                        type: f.type,
                        coffer: f.coffer ? gt.instance.getCofferViewModel(f.coffer) : null,
                        mobs: f.mobs ? gt.model.partialList(gt.mob, f.mobs) : null,
                        currency: f.currency ? _.map(f.currency, currencyTransform) : null
                    };

                    if (fightView.mobs) {
                        fightView.header = fightView.mobs[0];
                        fightView.mobs = fightView.mobs.length > 1 ? fightView.mobs.splice(1, fightView.mobs.length) : null;
                    }

                    return fightView;
                });
            }

            if (instance.coffers)
                view.coffers = _.map(instance.coffers, gt.instance.getCofferViewModel);

            if (instance.rewards)
                view.rewards = gt.model.partialList(gt.item, instance.rewards);

            if (instance.currency)
                view.currency = _.map(instance.currency, currencyTransform);

            if (instance.unlockedByQuest)
                view.unlockedByQuest = gt.model.partial(gt.quest, instance.unlockedByQuest);

            if (instance.requiredForQuest)
                view.requiredForQuest = gt.model.partialList(gt.quest, instance.requiredForQuest);
        }

        return view;
    },

    getCofferViewModel: function(coffer) {
        return {
            items: _.sortBy(gt.model.partialList(gt.item, coffer.items), function(i) { return i.name; }),
            coords: coffer.coords
        };
    },

    getInstanceRequirements: function(i) {
        var parts = [];
        parts.push('Lv. ' + i.min_lvl);
        if (i.max_lvl && i.max_lvl != i.min_lvl)
            parts.push(' - ' + i.max_lvl);

        if (i.min_ilvl) {
             parts.push(', iLv. ' + i.min_ilvl);

             if (i.max_ilvl && i.max_ilvl != i.min_ilvl)
                parts.push(' - ' + i.max_ilvl);
        }
        else if (i.max_ilvl)
            parts.push(', iLv. 0 - ' + i.max_ilvl);
        return parts.join('');
    },

    resolveCraftSource: function(step, id) {
        step.sourceType = 'instance';
        step.sourceView = gt.model.partial(gt.instance, id || step.item.instances[0]);
        step.setCategory(['Instance', 'Other']);
    },

    getPartialViewModel: function(partial) {
        if (!partial) {
            console.error('Invalid instance partial for view model.');
            return null;
        }

        var name = gt.model.name(partial);

        return {
            id: partial.i,
            type: 'instance',
            name: name,
            sourceName: gt.util.abbr(name),
            longSourceName: name,
            category: partial.t,
            byline: gt.instance.getInstanceRequirements(partial),
            icon: '../files/icons/instance/type/' + partial.c + '.png',
            min_lvl: partial.min_lvl
        };
    }
};
gt.search = {
    resultTemplate: null,
    page: 0,
    maxResults: 100,
    url: '/api/search.php',
    cachedQueries: [],
    resultIndex: { quest: { }, leve: { }, action: { }, achievement: { }, instance: { }, fate: { }, npc: { }, mob: { }, item: { }, fishing: { }, node: { }, status: { } },
    activeQuery: null,
    serverSearchId: 0,

    initialize: function(data) {
        if (!gt.core.isLive)
            gt.search.url = gt.serverPath + gt.search.url;

        gt.search.resultTemplate = doT.template($('#search-result-template').text());

        $('#filter-item-equippable').append(gt.equip.jobSelectTemplate({}));

        var itemCategories = _.sortBy(_.values(gt.item.categoryIndex), function(c) { return c.name; });
        $('#filter-item-category').append(_.map(itemCategories, function(c) { return $('<option value="' + c.id + '">' + c.name + '</option>'); }));

        if (data.filtersOpen)
            $('#search-filters-button, #search-filters-page').addClass('active');

        if (data.filters)
            gt.search.loadFilters(data.filters);

        if (data.search)
            $('#search-input').val(data.search);

        if (data.search || data.filters.activeSearch)
            gt.search.execute(null, true);
        else
            $('#search-section').addClass('inactive');

        // Bind events
        $('#filter-item-level-min').change(gt.search.filterItemLevelMinChanged);
        $('#filter-item-level-max').change(gt.search.filterItemLevelMaxChanged);
        $('#filter-item-craftable').change(gt.search.filterItemCraftableChanged);
        $('#filter-item-desynthable').change(gt.search.filterItemDesynthableChanged);
        $('#filter-item-rarity').change(gt.search.filterItemRarityChanged);
        $('#filter-item-equippable').change(gt.search.filterItemEquippableChanged);
        $('#filter-item-category').change(gt.search.filterItemCategoryChanged);

        $('#search-input')
            .bind('input', gt.search.execute)
            .bind('keydown', gt.search.keyDown);

        $('.search-previous').click(gt.search.searchPreviousClicked);
        $('.search-next').click(gt.search.searchNextClicked);
        $('#clear-filters').click(gt.search.clearFiltersClicked);
        $('#open-search-button').click(gt.search.openSearchButtonClicked);
        $('#search-filters-button').click(gt.search.searchFiltersClicked);
    },

    loadFilters: function(filters) {
        gt.util.check($('#filter-item-craftable'), filters.craftable);
        gt.util.check($('#filter-item-desynthable'), filters.desynthable);

        $('#filter-item-level-min').val(filters.ilvlMin);
        $('#filter-item-level-max').val(filters.ilvlMax);
        $('#filter-item-rarity').val(filters.rarity);
        $('#filter-item-equippable').val(filters.equippable);
        $('#filter-item-category').val(filters.category);
    },

    findMatchesCore: function(query) {
        var filters = query.filters;

        // Search items first, then other sets.
        var allItems = _.values(gt.search.resultIndex.item);
        for (var i = 0; i < allItems.length; i++) {
            var item = allItems[i];
            if (filters.ilvlMin && item.l < filters.ilvlMin)
                continue;

            if (filters.ilvlMax && item.l > filters.ilvlMax)
                continue;

            if (filters.craftable && !item.f)
                continue;

            if (filters.desynthable && !item.d)
                continue;

            if (filters.rarity && item.r != filters.rarity)
                continue;

            if (filters.category && item.t != filters.category)
                continue;

            if (query.jobCategories && !_.contains(query.jobCategories, item.j))
                continue;

            gt.search.ensureSearchProperties(item, item.n);
            var data = { obj: item, name: item.n, id: item.i, type: 'item' };
            if (query.match(data))
                return;
        }

        // When these item filters are specified, only search items.
        if (filters.ilvlMin || filters.ilvlMax || filters.craftable || filters.desynthable || filters.rarity || filters.category || query.jobCategories)
            return;

        // Server types.
        for (var type in gt.search.resultIndex) {
            if (type == 'item')
                continue; // Handled above.

            var index = gt.search.resultIndex[type];
            var set = _.values(index);
            for (var i = 0; i < set.length; i++) {
                var obj = set[i];
                // fixme: concat titles for npcs
                // todo: remove obj.name check [11/??]
                // Some data has a name in English but no other language.
                var name = obj.name || obj.n || "";
                gt.search.ensureSearchProperties(obj, name);
                var data = { obj: obj, name: name, id: obj.i, type: type };
                if (query.match(data))
                    return;
            }
        }
    },

    ensureSearchProperties: function(obj, name) {
        if (obj.search)
            return;

        obj.search = name.toLowerCase();
        obj.search += ' ' + obj.search.replace(/[\-()']|<SoftHyphen\/>/gi, "");
        obj.searchWords = obj.search.split(/[ \-()]/);
    },

    findMatchesLocal: function(query) {
        var offset = gt.search.page * gt.search.maxResults;
        var maxSet = (1 + gt.search.page) * gt.search.maxResults;
        var bestMatches = [];
        var allMatches = [];

        if (query.name) {
            var inputParts = _.filter(query.name.split(' '), function(i) { return i != ''; });

            query.match = function(data) {
                // First check the whole string.
                var index = data.obj.search.indexOf(query.name);
                if (index == 0 && bestMatches.length < maxSet)
                    bestMatches.push(data);
                else {
                    // Next check each part for a match.
                    var allPartsMatch = _.all(inputParts, function(iword) {
                        return _.any(data.obj.searchWords, function(sword) { return sword.indexOf(iword) == 0; });
                    });
                    if (allPartsMatch)
                        allMatches.push(data);

                    if (bestMatches.length == maxSet)
                        return true;
                }

                return false;
            };
        } else {
            query.match = function(data) {
                // Attempts to short-circuit here are wrong, because there
                // isn't a search string to generates best matches from, and
                // we need the full set for sorting.
                allMatches.push(data);
                return false;
            }
        }

        gt.search.findMatchesCore(query);

        // Determine the best results to return.
        var result = _.sortBy(bestMatches, function(o) { return o.obj.search; });
        if (result.length < maxSet) {
            allMatches = _.sortBy(allMatches, function(o) { return o.obj.search; });
            while (result.length < maxSet) {
                var obj = allMatches.shift();
                if (!obj)
                    break;

                result.push(obj);
            }
        }

        if (offset)
            result = result.slice(offset);
        result = _.map(result, gt.search.getViewModel);
        gt.search.completeSearch({ total: allMatches.length + result.length, result: result });
    },

    findMatchesServer: function(query) {
        query.id = ++gt.search.serverSearchId;

        // If the query is a subset of a previous search, do local search instead.
        if (gt.search.isQueryCached(query)) {
            gt.search.activeQuery = query;
            gt.search.findMatchesLocal(query);
            return;
        }

        var url = gt.search.createSearchQueryUrl(query);
        $.getJSON(url, function(result) {
            // Error checking.
            if (!result) {
                console.error('No search result.');
                return;
            }

            if (result.error) {
                console.error('Search error: ' + result.error);
                return;
            }

            // Always cache the query result.
            query.results = result.length;
            query.filters = $.extend({}, query.filters);
            gt.search.cachedQueries.push(query);

            for (var i = 0; i < result.length; i++) {
                var value = result[i];

                // Store results in a separate index used for local searches.
                var resultObjects = gt.search.resultIndex[value.type];
                if (resultObjects)
                    resultObjects[value.id] = value.obj;
            }

            // Toss results when a query with a larger ID is active.
            if (gt.search.activeQuery && gt.search.activeQuery.id > query.id)
                return;

            // Display results.
            gt.search.activeQuery = query;
            var models = _.map(result, gt.search.getViewModel);
            gt.search.completeSearch({ total: models.length, result: models });
       });
    },

    isQueryCached: function(query) {
        for (var i = 0; i < gt.search.cachedQueries.length; i++) {
            var cachedQuery = gt.search.cachedQueries[i];

            // A query is not a cache match when...

            // Filters differ.
            if (!_.isEqual(query.filters, cachedQuery.filters))
                continue;

            if (!_.isEqual(query.jobCategories, cachedQuery.jobCategories))
                continue;

            // Pages differ.
            if (query.page != cachedQuery.page)
                continue;

            if (cachedQuery.results < gt.search.maxResults) {
                // There can be no more results and this query is not a prefix match.
                if (query.name.indexOf(cachedQuery.name) != 0)
                    continue;
            } else if (query.name != cachedQuery.name) {
                // This query does not exactly match the cached query text.
                continue;
            }

            return true;
        }

        return false;
    },

    isQueryEquivalent: function(query1, query2) {
        return _.isEqual(query1.filters, query2.filters) && query1.name == query2.name && query1.page == query2.page;
    },

    execute: function(e, isInitializing) {
        var query = gt.search.createSearchQuery();

        if (!isInitializing)
            gt.settings.saveDirty({ search: query.name });

        // If the search is functionally identical to the current query, abort.
        // Usually this means the user typed a trailing space.
        if (gt.search.activeQuery && gt.search.isQueryEquivalent(gt.search.activeQuery, query))
            return;

        // Reset page if we came from an interaction event.
        if (e) 
            gt.search.page = 0;

        // Disable search controls if search is blank.
        if (!query.filters.activeSearch && (!query.name.length || query.name.length < 3)) {
            $('#search-section').addClass('inactive');
            $('.search-list-page, .search-icons-page', '.search-page').empty();
            $('#search-previous, #search-next').removeClass('show');
            return;
        }

        // Display loading graphic.
        $('#search-section')
            .removeClass('inactive')
            .addClass('loading');

        // Find matches
        query.name = query.name.toLowerCase();
        gt.search.findMatchesServer(query);
    },

    completeSearch: function(matches) {
        // Stats
        if (matches.total == 0)
            $('#search-results-count').text('No results');
        else if (matches.total == 1)
            $('#search-results-count').text('1 result');
        else
            $('#search-results-count').text(matches.result.length + ' results, page ' + (gt.search.page + 1));
        
        // Don't have an accurate total page count.  Only show when a multiple of max results.
        $('.search-next').toggleClass('show', matches.result.length > 0 && matches.result.length % gt.search.maxResults == 0);
        $('.search-previous').toggleClass('show', gt.search.page > 0);

        // Display matches
        $('#search-section').removeClass('loading');

        $('.search-list-page, .search-icons-page', '.search-page')
            .empty()
            .append(_.map(_.filter(matches.result), gt.search.resultTemplate))
            .append('<div class="clear"></div>');

        $('.block-link', '.search-page').click(gt.core.blockLinkClicked);
    },

    createSearchQuery: function() {
        var input = $('#search-input').val() || "";

        var query = {
            filters: $.extend({}, gt.settings.data.filters),
            name: input.trim(),
            match: null,
            page: gt.search.page
        };

        if (query.filters.equippable) {
            var matchingCategories = _.filter(_.values(gt.jobCategories), function(c) { return _.contains(c.jobs, query.filters.equippable); });
            query.jobCategories = _.map(matchingCategories, function(c) { return c.id; });
        }

        return query;
    },

    createSearchQueryUrl: function(query) {
        var parts = [];

        if (query.name)
            parts.push('text=' + encodeURIComponent(query.name));

        parts.push('lang=' + gt.settings.data.lang);

        if (query.page)
            parts.push('page=' + query.page);

        var filters = query.filters;

        if (filters.ilvlMin)
            parts.push('ilvlMin=' + filters.ilvlMin);
        if (filters.ilvlMax)
            parts.push('ilvlMax=' + filters.ilvlMax);
        if (filters.pvp)
            parts.push('pvp=1');
        if (filters.craftable)
            parts.push('craftable=1');
        if (filters.desynthable)
            parts.push('desynthable=1');
        if (filters.rarity)
            parts.push('rarity=' + filters.rarity);
        if (filters.category)
            parts.push('itemCategory=' + filters.category);
        if (query.jobCategories)
            parts.push('jobCategories=' + query.jobCategories.join(','));

        return gt.search.url + '?' + parts.join('&');
    },

    keyDown: function(e) {
        // Detect the enter key, and open the first matched result.
        if (e.which == 13) {
            $('.search-list-page .search-result:first', '.search-page').trigger('click');
            return;
        }
    },

    clearFiltersClicked: function(e) {
        gt.settings.data.filters = $.extend({}, gt.settings.defaultSearchFilters);
        gt.search.loadFilters(gt.settings.data.filters);
        gt.search.execute(e);
        gt.settings.saveDirty();
    },

    filterItemLevelMaxChanged: function(e) {
        var val = Number($(this).val());
        gt.settings.data.filters.ilvlMax = val ? val : 0;
        gt.search.updateFilters(e);
    },

    filterItemLevelMinChanged: function(e) {
        var val = Number($(this).val());
        gt.settings.data.filters.ilvlMin = val ? val : 0;
        gt.search.updateFilters(e);
    },

    filterItemCraftableChanged: function(e) {
        gt.settings.data.filters.craftable = $(this).is(':checked');
        gt.search.updateFilters(e);
    },

    filterItemDesynthableChanged: function(e) {
        gt.settings.data.filters.desynthable = $(this).is(':checked');
        gt.search.updateFilters(e);
    },

    filterItemPvpChanged: function(e) {
        gt.settings.data.filters.pvp = $(this).is(':checked');
        gt.search.updateFilters(e);
    },

    filterItemRarityChanged: function(e) {
        gt.settings.data.filters.rarity = Number($(this).val());
        gt.search.updateFilters(e);
    },

    filterItemEquippableChanged: function(e) {
        gt.settings.data.filters.equippable = Number($(this).val());
        gt.search.updateFilters(e);
    },

    filterItemCategoryChanged: function(e) {
        gt.settings.data.filters.category = Number($(this).val());
        gt.search.updateFilters(e);
    },

    updateFilters: function(e) {
        var filters = gt.settings.data.filters;
        filters.activeSearch = filters.ilvlMin || filters.ilvlMax || filters.craftable || filters.desynthable || filters.rarity || filters.equippable || filters.category;
        gt.search.execute(e);
        gt.settings.saveDirty();
    },

    getViewModel: function(searchResult) {
        var module = gt[searchResult.type];
        return module ? module.getPartialViewModel(searchResult.obj) : null;
    },

    openSearchButtonClicked: function(e) {
        var $section = $('#search-section').detach();

        var opened = function() {
            $('#search-input').focus().select();
        };

        var dismissed = function() {
            $section.detach();
            $('#sidebar-search-container').append($section);
        };

        gt.display.popover($section, 'position-sidebar', opened, dismissed);
    },

    searchFiltersClicked: function(e) {
        var $page = $('#search-filters-page');
        if ($page.hasClass('active')) {
            $page.removeClass('active');
            $(this).removeClass('active');
            gt.settings.data.filtersOpen = 0;
        }
        else {
            $page.addClass('active');
            $(this).addClass('active');
            gt.settings.data.filtersOpen = 1;
        }

        gt.settings.saveClean();
    },

    searchNextClicked: function(e) {
        gt.search.page++;
        gt.search.execute();
        return false;
    },

    searchPreviousClicked: function(e) {
        gt.search.page = Math.max(0, gt.search.page - 1);
        gt.search.execute();
        return false;
    }
};
gt.settings = {
    languageFlagsExpanded: false,
    dirty: false,
    syncTime: 120 * 1000,
    initialSyncTime: 1 * 1000,
    syncDirtyTime: 20 * 1000,
    syncKey: null,

    defaultSearchFilters:  {
        ilvlMin: 0, ilvlMax: 0,
        craftable: 0, desynthable: 0,
        pvp: 0, rarity: 0,
        equippable: 0, category: 0,

        activeSearch: 0
    },

    data: {
        account: null,
        syncModified: null,
        syncEnabled: 0,
        search: null,
        filtersOpen: 0,
        globalSearch: { activePage: '_none', 'filters-menu': { activePage: '_none' } },
        header: { activePage: '_none' },
        current: 'Default',
        lists: { Default: [] },
        path: '',
        items: { },
        craftDepth: 10,
        shorterNames: 1,
        alarmVolume: 50,
        alarmTone: 'alarm1',
        notifications: 1,
        welcome: 0,
        filters: null,
        lang: 'en',
        listHeaderCollapsed: false,
        disableTouch: false,
        colorblind: 0,
        sortMelds: 0,
        unlockHeights: 0,
        craftCategories: { Vendor: 1, Other: 1 },
        minerVentures: 0,
        botanyVentures: 0,
        fisherVentures: 0,
        combatVentures: 0,
        preferGathering: 0,
        preferCrafting: 0,
        isearchOnActivate: 0
    },

    getItem: function(id) {
        return gt.settings.data.items[id] || {};
    },

    setItem: function(id, item) {
        if (_.keys(item).length)
            gt.settings.data.items[id] = item;
        else
            delete gt.settings.data.items[id];
        gt.settings.saveDirty();
    },

    saveClean: function(changes) {
        gt.settings.saveCore(changes, false);
    },

    saveDirty: function(changes) {
        gt.settings.saveCore(changes, true);
        console.log('*** Saved dirty change');
    },

    saveCore: function(changes, markDirty) {
        if (changes)
            gt.settings.data = $.extend(gt.settings.data, changes);

        try {
            localStorage.dbSettings = JSON.stringify(gt.settings.data);

            if (markDirty && gt.settings.data.syncEnabled) {
                gt.settings.dirty = true;
                $('body').addClass('dirty');

                gt.settings.startSync(gt.settings.syncDirtyTime);
            }
        } catch (ex) {
            // Ignore.  Can be caused by users blocking access to localStorage, and private browsing modes.
        }
    },

    load: function() {
        var data = null;
        try {
            if (localStorage.dbSettings)
                data = JSON.parse(localStorage.dbSettings);
        } catch (ex) {
            // Ignore.  Can be caused by users blocking access to localStorage, and private browsing modes.
        }

        if (data)
            gt.settings.data = data;
        else
            data = gt.settings.data;

        if (!data.lists)
            data.lists = { Default: [] };

        if (!data.current || !data.lists[data.current]) {
            data.current = _.keys(data.lists)[0];
            if (!data.current || !data.lists[data.current]) {
                data.current = "Default";
                data.lists = { Default: [] };
            }
        }

        if (!data.items)
            data.items = { };

        if (!data.sidebar)
            data.sidebar = { activePage: '_none' };

        if (!data.globalSearch)
            data.globalSearch = { activePage: '_none', 'filters-menu': { activePage: '_none' } };

        if (!data.header)
            data.header = { activePage: '_none' };

        if (!data.craftDepth)
            data.craftDepth = 5;

        if (data.shorterNames === undefined)
            data.shorterNames = 1;

        if (data.alarmVolume === undefined)
            data.alarmVolume = 50;

        if (data.alarmTone === undefined)
            data.alarmTone = 'alarm1';

        if (data.notifications === undefined)
            data.notifications = 1;

        if (!data.filters) // Applied here for new settings too.
            data.filters = $.extend({}, gt.settings.defaultSearchFilters);

        if (!data.lang)
            data.lang = 'en';
            
        if (!data.craftCategories)
            data.craftCategories = { Vendor: 1, Other: 1 };

        gt.settings.bindEvents(data);

        return data;
    },

    // Events

    bindEvents: function(data) {
        $('#craft-depth-setting')
            .val(data.craftDepth)
            .change(gt.settings.craftDepthChanged);

        $('#shorter-names-setting')
            .prop('checked', data.shorterNames)
            .change(gt.settings.shorterNamesChanged);

        $('#alarm-volume')
            .val(data.alarmVolume)
            .change(gt.settings.alarmVolumeChanged);

        $('#warning-tone')
            .val(data.alarmTone)
            .change(gt.settings.alarmToneChanged);

        $('#available-tone')
            .val(data.availableTone)
            .change(gt.settings.availableToneChanged);

        $('#desktop-notifications')
            .prop('checked', data.notifications)
            .change(gt.settings.desktopNotificationsChanged);

        $('#eorzea-time-in-title')
            .prop('checked', data.eorzeaTimeInTitle)
            .change(gt.settings.eorzeaTimeInTitleChanged);

        $('#disable-touch')
            .prop('checked', data.disableTouch)
            .change(gt.settings.disableTouchChanged);

        $('#colorblind-setting')
            .prop('checked', data.colorblind)
            .change(gt.settings.colorblindChanged);

        $('#sort-melds')
            .prop('checked', data.sortMelds)
            .change(gt.settings.sortMeldsChanged);

        $('#unlock-heights')
            .prop('checked', data.unlockHeights)
            .change(gt.settings.unlockHeightsChanged);

        $('#prefer-miner-ventures-setting')
            .prop('checked', data.minerVentures)
            .change(gt.settings.preferMinerVenturesChanged);

        $('#prefer-botany-ventures-setting')
            .prop('checked', data.botanyVentures)
            .change(gt.settings.preferBotanyVenturesChanged);

        $('#prefer-fisher-ventures-setting')
            .prop('checked', data.fisherVentures)
            .change(gt.settings.preferFisherVenturesChanged);

        $('#prefer-combat-ventures-setting')
            .prop('checked', data.combatVentures)
            .change(gt.settings.preferCombatVenturesChanged);

        $('#prefer-gathering')
            .prop('checked', data.preferGathering)
            .change(gt.settings.preferGarheringChanged);

        $('#prefer-crafting')
            .prop('checked', data.preferCrafting)
            .change(gt.settings.preferCraftingChanged);

        $('#isearch-on-activate')
            .prop('checked', data.isearchOnActivate)
            .change(gt.settings.isearchOnActivateChanged);

        if (data.colorblind)
            $('body').addClass('colorblind');

        if (data.unlockHeights)
            $('body').addClass('unlock-heights');

        if (!data.shorterNames)
            $('body').addClass('long-names');

        $('.language-flag').click(gt.settings.languageFlagClicked);
        $('.language-flag.' + data.lang).addClass('visible');
        
        $('.settings-page .craft-category')
            .change(gt.settings.craftCategoryChanged);

        var checkboxesByCategory = _.indexBy($('.settings-page .craft-category'), function(c) { return $(c).data('category'); });
        for (var key in data.craftCategories) {
            var checkbox = checkboxesByCategory[key];
            if (checkbox)
                $(checkbox).prop('checked', 1);
        }

        $('#account-key')
            .val(data.account)
            .change(gt.settings.accountKeyChanged);

        if (gt.settings.syncTime)
            $('#last-sync-time').text(data.syncModified);

        $('.sync-page').toggleClass('enabled', data.syncEnabled ? true : false);
        $('#upload-sync').click(gt.settings.uploadSyncClicked);
        $('#download-sync').click(gt.settings.downloadSyncClicked);
        $('#stop-sync').click(gt.settings.stopSyncClicked);
    },

    unlockHeightsChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ unlockHeights: value ? 1 : 0 });
        $('body').toggleClass('unlock-heights', value);
        gt.list.layout();
    },

    shorterNamesChanged: function(e) {
        var value = $(this).is(':checked');
        $('body').toggleClass('long-names', !value);
        gt.settings.saveDirty({ shorterNames: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    craftDepthChanged: function(e) {
        var value = $(this).val();
        gt.settings.saveDirty({ craftDepth: parseInt(value) });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    alarmVolumeChanged: function(e) {
        var value = $(this).val();
        gt.settings.saveDirty({ alarmVolume: parseInt(value) });
        gt.display.playAnyTone();
    },

    alarmToneChanged: function(e) {
        var value = $(this).val();
        gt.settings.saveDirty({ alarmTone: value });
        gt.display.playWarningAlarm();
    },

    availableToneChanged: function(e) {
        var value = $(this).val();
        gt.settings.saveDirty({ availableTone: value });
        gt.display.playAvailableAlarm();
    },

    desktopNotificationsChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ notifications: value ? 1 : 0 });
    },

    eorzeaTimeInTitleChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ eorzeaTimeInTitle: value ? 1 : 0 });

        if (value)
            gt.time.ensureTimeUpdate();
        else
            $('title').text('Garland Tools Database');
    },

    disableTouchChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ disableTouch: value ? 1 : 0 });

        window.location.reload(true);
    },

    colorblindChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ colorblind: value ? 1 : 0 });

        $('body').toggleClass('colorblind', value);
    },

    sortMeldsChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ sortMelds: value ? 1 : 0 });
    },

    languageFlagClicked: function(e) {
        if (gt.settings.languageFlagsExpanded) {
            gt.settings.data.lang = $(this).data('lang');
            gt.settings.saveDirty();
            window.location.reload();
        } else
            $('.language-flag').addClass('visible');

        gt.settings.languageFlagsExpanded = !gt.settings.languageFlagsExpanded;
    },

    craftCategoryChanged: function(e) {
        var $this = $(this);
        var value = $this.is(':checked');
        var category = $this.data('category');
        
        var craftCategories = gt.settings.data.craftCategories;
        if (craftCategories[category])
            delete craftCategories[category];
        else
            craftCategories[category] = 1;

        gt.settings.saveDirty();
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    preferMinerVenturesChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ minerVentures: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    preferBotanyVenturesChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ botanyVentures: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    preferFisherVenturesChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ fisherVentures: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    preferCombatVenturesChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ combatVentures: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    preferGarheringChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ preferGathering: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    preferCraftingChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ preferCrafting: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    isearchOnActivateChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ isearchOnActivate: value ? 1 : 0 });
    },

    redisplayMatchingBlocks: function(selector) {
        var $matches = $(selector).closest('.block');
        for (var i = 0; i < $matches.length; i++) {
            var $block = $($matches[i]);
            gt.core.redisplay($block);
        }
    },

    accountKeyChanged: function(e) {
        var value = $(this).val();
        gt.settings.saveClean({ account: value });
    },

    downloadSyncClicked: function(e) {
        $('.sync-page').addClass('enabled');
        gt.settings.saveClean({ syncEnabled: 1 });
        gt.settings.dirty = false;
        gt.settings.syncRead();
    },

    uploadSyncClicked: function(e) {
        if (!gt.settings.data.account) {
            // Create an account key.
            gt.settings.saveClean({ account: gt.util.makeId(10) });
            $('#account-key').val(gt.settings.data.account);
        } else if (gt.settings.data.account.length != 10) {
            gt.display.alertp('Account Key must be 10 characters or blank.');
            return;
        }
        
        $('.sync-page').addClass('enabled');
        gt.settings.saveClean({ syncEnabled: 1 });
        gt.settings.dirty = true;
        gt.settings.syncWrite();
    },

    stopSyncClicked: function(e) {
        if (gt.settings.syncKey) {
            clearTimeout(gt.settings.syncKey);
            gt.settings.syncKey = null;
        }

        gt.settings.saveClean({ syncEnabled: 0 });
        $('.sync-page').removeClass('enabled');
    },

    startSync: function(time) {
        if (gt.settings.syncKey)
            clearTimeout(gt.settings.syncKey);
        
        gt.settings.syncKey = setTimeout(gt.settings.sync, time);
    },

    sync: function() {
        if (gt.settings.dirty)
            gt.settings.syncWrite();
        else
            gt.settings.syncRead();
    },

    syncWrite: function() {
        if (!gt.settings.hasValidAccount())
            return;

        var writeData = {
            method: 'write',
            id: 'sync-db',
            account: gt.settings.data.account,
            value: localStorage.dbSettings
        };

        // Clear dirty flag before I/O, in case more work happens
        // during call.
        gt.settings.dirty = false;
        $('body').removeClass('dirty');
        gt.util.post('/api/storage.php', writeData, function(result, error) {
            if (error) {
                gt.display.alertp("Sync write failed: " + error);
                return;
            }

            gt.settings.saveClean({ syncModified: result.modified });
            $('#last-sync-time').text(result.modified);
            gt.settings.startSync(gt.settings.syncTime);
        });
    },

    syncRead: function() {
        if (!gt.settings.hasValidAccount())
            return;

        var readData = {
            method: 'read',
            id: 'sync-db',
            account: gt.settings.data.account,
            modified: gt.settings.data.syncModified || '1900-01-01'
        };

        function onSyncReadResult(result) {
            var oldList = gt.settings.data.current;

            var newData = JSON.parse(result.value);
            newData.syncModified = result.modified;
            console.log('New sync data received', result.modified);
            $('#last-sync-time').text(result.modified);

            gt.settings.data = newData;

            // Preserve the last list this device was on.
            gt.list.current = newData.lists[oldList];
            if (gt.list.current) {
                newData.current = oldList;
                gt.list.reinitialize();
            }
            else {
                // Last list doesn't exist anymore.
                // Switch to the current list in settings.
                gt.list.switchToList(newData.current);
            }

            localStorage.dbSettings = JSON.stringify(newData);
        }

        gt.util.post('/api/storage.php', readData, function(result) {
            try {
                if (result.status == 'ok')
                    onSyncReadResult(result);

                gt.settings.startSync(gt.settings.syncTime);
            } catch (ex) {
                console.error(ex);
                console.error('Sync read error.', result);
            }
        });
    },

    hasValidAccount: function() {
        var data = gt.settings.data;
        return data.account && data.account.length == 10;
    }
};
gt.display = {
    current: null,
    nearest: null,
    findFunc: null,
    offsetX: 0,
    offsetY: 0,
    containerOffsetX: 0,
    containerOffsetY: 0,
    isTouchDevice: false,
    downEvent: 'mousedown',
    moveEvent: 'mousemove',
    touchStartX: 0,
    touchStartY: 0,

    minimapSettingsDefault: { maxColumns: 5, maxPages: 3, maxRows: 3 },
    minimapSettingsCollapsed: { maxColumns: 2, maxPages: 1, maxRows: 6 },
    minimapSettings: null,

    initialize: function(data) {
        gt.display.minimapSettings = gt.display.minimapSettingsDefault;

        var $searchSection = $('#search-section');
        $searchSection.data('block', data.globalSearch);
        gt.display.pages($searchSection);

        var $header = $('#header');
        $header.data('block', data.header);
        gt.display.pages($header);

        $('#toggle-sidebar').click(gt.display.toggleSidebarCollapse);
        if (gt.settings.data.sidebar.collapse)
            gt.display.collapseSidebar();
    },

    // Sidebar Collapsing

    toggleSidebarCollapse: function(e) {
        if (gt.settings.data.sidebar.collapse) {
            gt.display.openSidebar(e, $(this));
            gt.settings.data.sidebar.collapse = 0;
        }
        else {
            gt.display.collapseSidebar();
            gt.settings.data.sidebar.collapse = 1;
        }

        gt.list.layout();
        gt.display.minimap();
        gt.settings.saveClean();
    },

    collapseSidebar: function() {
        gt.display.minimapSettings = gt.display.minimapSettingsCollapsed;

        $('body').addClass('sidebar-collapsed');
    },

    openSidebar: function(e, $this) {
        gt.display.minimapSettings = gt.display.minimapSettingsDefault;

        $('body').removeClass('sidebar-collapsed');

        if ($this) {
            var pageName = $this.data('page');
            if (pageName) 
                gt.settings.data.sidebar.activePage = pageName;
        }
    },

    // Paging

    pages: function($container) {
        var $menus = $('.menu', $container);
        if (!$menus.length)
            return;

        var blockData = $container.data('block');
        for (var i = 0; i < $menus.length; i++) {
            var $menu = $($menus[i]);
            var menuData = gt.display.getMenuData($menu, blockData);

            // Find the active button.
            var $buttons = $('> .button[data-page], > .menu-ext > .button[data-page]', $menu);
            if (!$buttons.length)
                continue;

            var shouldOpenDefaultPage = !$menu.hasClass('nodefault') && ($menu.hasClass('noclose') || !gt.display.isTouchDevice || $buttons.length == 1);

            var activeButton = null;
            if (menuData.activePage != '_none') {
                var $matches = $buttons.filter('[data-page=' + menuData.activePage + ']'); 

                if ($matches.length)
                    activeButton = $matches[0];
                else if (shouldOpenDefaultPage)
                    activeButton = $buttons[0];
            }

            if (!activeButton)
                $container.addClass('menu-closed');

            // Set page visibility, configure events.
            gt.display.menuPageCheck($buttons, $container, activeButton);
            $buttons.click(gt.display.menuButtonClicked);

            $container.addClass('menu-initialized');
        }
    },

    getMenuData: function($menu, blockData) {
        var name = $menu.data('menu-name');
        if (!name)
            return blockData;

        if (blockData[name])
            return blockData[name];

        return blockData[name] = {};
    },

    menuButtonClicked: function(e) {
        var $this = $(this);
        var $menu = $this.closest('.menu');
        var $container = $menu.closest('.block, #header, #search-section');
        var blockData = $container.data('block');

        if (!blockData) {
            console.error('No block data found for element');
            return;
        }

        var menuData = gt.display.getMenuData($menu, blockData);
        if (!menuData) {
            console.error('No menu data found for element.', blockData);
            return;
        }

        var activeButton = null;
        if ($this.hasClass('active') && (!$menu.hasClass('noclose') || gt.display.isTouchDevice)) {
            menuData.activePage = '_none';
            $container.addClass('menu-closed');
        }
        else {
            activeButton = this;
            menuData.activePage = $this.data('page');
            $container.removeClass('menu-closed');
        }

        gt.display.menuPageCheck($('> .button, > .menu-ext > .button[data-page]', $menu), $container, activeButton);

        gt.list.resized($container);
        gt.settings.saveClean();
    },

    menuPageCheck: function($buttons, $container, activeButton) {
        for (var i = 0; i < $buttons.length; i++) {
            var button = $buttons[i];
            var $button = $(button);

            var pageName = $button.data('page');
            var $page = $('.' + pageName, $container);
            if (button == activeButton) {
                $button.addClass('active');
                $page.addClass('active');
                $container.trigger({type: 'page-loaded', page: pageName});
            } else {
                $page.removeClass('active');
                $button.removeClass('active');
            }
        }
    },

    // Omniscroll

    omniscroll: function ($container) {
        $('.omniscroll', $container).bind('wheel', gt.display.omniscrollWheel);
    },

    omniscrollWheel: function(e) {
        e.stopPropagation();

        var delta = gt.display.normalizeWheelDelta(e.originalEvent.deltaY);

        var element = $(e.target).closest('.omniscroll')[0];
        element.scrollLeft += (delta / 2);

        return false;
    },

    // Collapsing

    collapsible: function($container) {
        var $collapsibleAreas = $('.collapsible', $container);
        var blockData = $container.data('block');

        for (var i = 0; i < $collapsibleAreas.length; i++) {
            var $collapsibleArea = $($collapsibleAreas[i]);
            var isDefaultVisible = !$collapsibleArea.hasClass('collapsed');
            var headerName = $collapsibleArea.data('headername');
            var isVisible = blockData && blockData.headers ? blockData.headers[headerName] : undefined;
            if (isVisible === undefined)
                isVisible = isDefaultVisible;
            gt.display.toggleCollapseState($collapsibleArea, isVisible);
        }

        var $handle = $('h3, h2', $collapsibleAreas);
        $handle.click(gt.display.collapsibleClicked);
    },

    collapsibleClicked: function(e) {
        // Sometimes an input is inside the clickable area.  Don't perform
        // collapse toggles when it's clicked.
        if (e.target.tagName == "INPUT")
            return;

        var $collapsibleArea = $(this).parent();
        var $block = $collapsibleArea.closest('.block, #sidebar');

        var blockData = $block.data('block');
        if (!blockData.headers)
            blockData.headers = {};

        var headerName = $collapsibleArea.data('headername');
        var isVisible = blockData.headers[headerName];
        if (isVisible === undefined)
            isVisible = !$collapsibleArea.hasClass('collapsed');

        gt.display.toggleCollapseState($collapsibleArea, !isVisible);

        gt.list.resized($block);

        blockData.headers[headerName] = isVisible ? false : true;
        gt.settings.saveClean();
    },

    toggleCollapseState: function($collapsibleArea, isVisible) {
        $collapsibleArea.toggleClass('collapsed', !isVisible);
        $('.collapse-toggle', $collapsibleArea).toggle(isVisible);      
    },

    // Drag and drop

    draggable: function($element) {
        if (gt.display.isTouchDevice)
            return;

        $element.addClass('draggable');

        if ($element.hasClass('handle'))
            $element.bind(gt.display.downEvent, gt.display.draggableDown);
        else
            $('.handle', $element).bind(gt.display.downEvent, gt.display.draggableDown);
    },

    draggableDown: function(e) {
        // Don't try to drag when clicking buttons.
        if ($(e.target).hasClass('button'))
            return false;

        var pos = e.changedTouches ? e.changedTouches[0] : e;

        var $draggable = $(this).closest('.draggable');

        // Disable dragging pinned blocks.
        if ($draggable.closest('#pinned').length)
            return;

        var draggable = $draggable[0];

        // Record some useful offsets.
        gt.display.current = draggable;
        if ($draggable.css('position') == 'absolute') {
            gt.display.offsetX = pos.clientX - draggable.offsetLeft;
            gt.display.offsetY = pos.clientY - draggable.offsetTop;
        } else {
            // Relative
            gt.display.offsetX = pos.clientX;
            gt.display.offsetY = pos.clientY;

            // Reset position
            $draggable.css('top', 0).css('left', 0);
        }

        var $main = $('#main');
        gt.display.containerOffsetX = $main[0].offsetLeft;
        gt.display.containerOffsetY = $main[0].offsetTop;

        $draggable.addClass('dragging');

        gt.display.findFunc = gt.display.findBlockAtPoint;

        $('html')
            .bind('mouseup touchend', gt.display.draggableUp)
            .bind('mousemove touchmove', gt.display.draggableMove)
            .addClass('dragging');

        if ($draggable.hasClass('block'))
            gt.core.setActiveBlock($draggable, true);
    },

    draggableUp: function(e) {
        var pos = e.changedTouches ? e.changedTouches[0] : e;

        $('html')
            .unbind('mouseup')
            .unbind('touchend')
            .unbind('mousemove')
            .unbind('touchmove');

        function removeDragging() { $('.dragging').removeClass('dragging'); };
        $('.nearest').removeClass('nearest');

        var $current = $(gt.display.current);
        var $nearest = gt.display.nearest ? $(gt.display.nearest) : null;

        // Record distance moved.
        var preventClick = false;
        var distanceX = pos.clientX - gt.display.offsetX;
        var distanceY = pos.clientY - gt.display.offsetY;

        // Reset state.
        gt.display.current = null;
        gt.display.nearest = null;
        gt.display.offsetX = 0;
        gt.display.offsetY = 0;
        gt.display.containerOffsetX = 0;
        gt.display.containerOffsetY = 0;

        // Execute the drag target.
        if ($current.is('.block')) {
            if (!$nearest || $nearest[0] == $current[0]) {
                removeDragging();
                gt.list.layout();
                return true;
            }

            var underlyingElement = $current.data('element');
            if (underlyingElement)
                $current = $(underlyingElement);

            if ($nearest.is('#sidebar'))
                gt.core.pin($current);
            else if ($nearest.is('.list-item:not(".active")'))
                gt.list.moveBlockTo($current, $nearest.data('listname'));
            else if ($nearest.is('.group') && !$current.is('.tool'))
                gt.group.insertGroup($current, $nearest);
            else if ($nearest.is('.gearset') && $current.is('.item'))
                gt.gearset.insertItem($current, $nearest);
            else
                gt.display.reorderBlock($current, $nearest);
        } else if ($current.is('.list-item') && $nearest) {
            if ($nearest.is('.list-item')) {
                gt.display.reorderList($current, $nearest);
                preventClick = true;
            }
        }

        // Prevent clicks.
        if (preventClick || Math.abs(distanceX) > 15 || Math.abs(distanceY) > 15)
            setTimeout(removeDragging, 30);
        else
            removeDragging();
    },

    draggableMove: function(e) {
        if (!gt.display.current) 
            return;

        var pos = e.changedTouches ? e.changedTouches[0] : e;

        // Move the block to the cursor location.
        var y = pos.clientY - gt.display.offsetY;
        var x = pos.clientX - gt.display.offsetX;

        var $current = $(gt.display.current);
        $current
            .css('top', y)
            .css('left', x);

        var nearest = null;

        // Sidebar pinning: Anywhere over the sidebar.
        if (pos.clientX < gt.display.containerOffsetX && !$('body').hasClass('sidebar-collapsed')) {
            $('#pin-marker').css('height', $current.height());
            nearest = $('#sidebar')[0];
        }

        // Annotate the nearest element to provide feedback.
        if (!nearest)
            nearest = gt.display.findFunc(pos);

        if (nearest != gt.display.nearest) {
            if (gt.display.nearest) {
                var $old = $(gt.display.nearest);
                $old.removeClass('nearest');
                var mini = $old.data('mini');
                $(mini).removeClass('nearest');
            }

            if (nearest != gt.display.current) {
                gt.display.nearest = nearest;

                var $nearest = $(nearest);
                $nearest.addClass('nearest');
                var mini = $nearest.data('mini');
                $(mini).addClass('nearest');
            }
        }
    },

    reorderBlock: function($element, $nearest) {
        $element.attr('data-sort', gt.list.placeBefore($nearest));

        gt.list.blockSortingUpdated();
        gt.core.setActiveBlock($element, true);

        gt.display.minimap();
    },

    reorderList: function($element, $nearest) {
        var elementName = $element.data('listname');
        var nearestName = $nearest.data('listname');

        var lists = gt.settings.data.lists;
        var newLists = { };
        for (var key in lists) {
            if (key == elementName)
                continue;

            if (key == nearestName)
                newLists[elementName] = lists[elementName];

            newLists[key] = lists[key];
        }

        // Sanity check to ensure both lists have the same number of elements
        // before overwriting.
        if (_.keys(lists).length != _.keys(newLists).length) {
            console.error("List key mismatch after reorder, aborting.");
            return;
        }

        gt.settings.data.lists = newLists;
        gt.list.redisplayLists();
        gt.settings.saveDirty();
    },

    findBlockAtPoint: function(e) {
        var x = e.pageX;
        var y = e.pageY;

        // Check other lists.
        if (y < gt.display.containerOffsetY) {
            var under = gt.display.getElementUnderPoint(e);
            if (under) {
                var $under = $(under).closest('.drag-target');
                if ($under.length)
                    return $under[0];
            }

            return null;
        }

        // Check other blocks in this list.
        var items = gt.isotope.filteredItems;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var ix = item.position.x + gt.display.containerOffsetX;
            var iy = item.position.y + gt.display.containerOffsetY;

            if (x < ix || x > (ix + item.size.width))
                continue;

            if (y < iy || y > (iy + item.size.height))
                continue;

            return item.element;
        }

        return null;
    },

    getElementUnderPoint: function(e) {
        gt.display.current.style.visibility = 'hidden';
        var under = document.elementFromPoint(e.clientX, e.clientY);
        gt.display.current.style.visibility = 'visible';
        return under;
    },

    // Minimap

    minimap: function() {
        var settings = gt.display.minimapSettings;
        var row = 0;
        var column = 0;
        var page = 0;
        var pageRow = 0;
        var maxRows = settings.maxRows;
        var maxPages = settings.maxPages;
        var maxColumns = settings.maxColumns;
        var radius = 22;
        var spacer = 8;
        var maxRowHeight = 0;

        var miniblocks = [];
        var isotopeItems = gt.isotope.filteredItems;
        if (!isotopeItems)
            return;

        for (var i = 0; i < isotopeItems.length; i++) {
            var element = isotopeItems[i].element;
            var $block = $(element);
            var blockData = $block.data('block');
            var view = $block.data('view');
            if (!view || view.error)
                continue;

            var $e = $('<div class="minimap-block pointer handle circle ' + blockData.type + '"></div>');

            if (column >= maxColumns) {
                column = 0;
                row++;
                maxRowHeight = Math.min(maxRowHeight + 1, maxRows - 1);
            }

            if (row >= maxRows) {
                row = 0;
                page++;
            }

            if (page >= maxPages) {
                page = 0;
                pageRow++;
                maxRowHeight = 0;
            }

            var x = (page * maxColumns * radius) + (page * spacer) + (column * radius) + 2;
            var y = (pageRow * maxRows * radius) + (pageRow * spacer) + (row * radius) + 2;

            $e.css('left', x);
            $e.css('top', y);

            column++;

            $e.data('block', blockData);
            $e.data('element', element);
            $block.data('mini', $e[0]);
            $e.click(gt.display.minimapBlockClicked);

            var name = null;
            switch (blockData.type) {
                case 'item':
                case 'instance':
                case 'npc':
                case 'mob':
                case 'node':
                case 'fishing':
                case 'quest':
                case 'leve':
                case 'achievement':
                case 'action':
                case 'fate':
                case 'group':
                case 'skywatcher':
                case 'equip':
                case 'note':
                    $e.append('<img src="' + view.icon + '" width="' + radius + 'px">');
                    break;

                case 'status':
                    $e.append('<img src="' + view.icon + '" style="height: 22px; margin-left: 2px;">');
                    break;

                case 'browse':
                case 'patch':
                    $e.append('<img src="' + $block.data('view').browseIcon + '" width="' + (radius - 2) + '"px">');
                    break;

                case 'time':
                    $e.append('<span class="text">' + gt.time.eCurrentTime().getUTCHours() + '</span>');
                    break;

                case 'gearset':
                    $e.append('<img src="images/slot/Main Hand.png" width="' + (radius - 2) + '"px>');
                    break;
            }

            if (name)
                $e.append('<span class="text">' + gt.util.abbr2(name) + '</span>');

            miniblocks.push($e);
        }

        var numRows = (pageRow * maxRows) + maxRowHeight + 1;
        var height = (numRows * radius) + (spacer * (pageRow + 1));
        $('#minimap').empty().append(miniblocks).css('height', height);
    },

    minimapBlockClicked: function(e) {
        var block = $(this).data('block');
        var $existing = $('.' + block.type + '.block[data-id="' + block.id + '"]');
        if ($existing.length) {
            gt.core.scrollToBlock($existing);
            gt.core.setActiveBlock($existing, true);
        }
    },

    // Notifications

    notifications: function($block, blockData) {
        $('.notifications-button', $block)
            .toggleClass('active', blockData.alarms ? true : false)
            .click(gt.display.alarmNotificationsClicked);

        if (blockData.alarms && window.Notification && gt.settings.data.notifications)
            window.Notification.requestPermission();
    },

    alarmNotificationsClicked: function(e) {
        var $this = $(this);
        var $block = $this.closest('.block');
        var data = $block.data('block');

        $this.toggleClass('active');
        if ($this.hasClass('active')) {
            if (window.Notification && window.Notification.permission != "granted")
                window.Notification.requestPermission();

            data.alarms = 1;
            gt.display.playAnyTone();
        }
        else
            delete data.alarms;

        gt.settings.saveDirty();
    },

    playTone: function(tone) {
        if (!tone || tone == 'none')
            return;

        var alarm = $('#' + tone)[0];
        alarm.volume = gt.settings.data.alarmVolume / 100;
        var promise = alarm.play();
        if (promise) {
            promise.catch(function(err) {
                if (err && err.name == "NotAllowedError") {
                    gt.display.alertp("Error playing alarm because you haven't interacted with the page.<br>Dismiss this alert to reenable alarms.");
                    return;
                }

                gt.display.alertp("Error playing alarm: " + err);
            });
        }
    },

    playAnyTone: function() {
        if (gt.settings.data.alarmTone && gt.settings.data.alarmTone != 'none')
            gt.display.playWarningAlarm();
        else if (gt.settings.data.availableTone && gt.settings.data.availableTone != 'none')
            gt.display.playAvailableAlarm();
    },

    playWarningAlarm: function() {
        gt.display.playTone(gt.settings.data.alarmTone);
    },

    playAvailableAlarm: function() {
        gt.display.playTone(gt.settings.data.availableTone);
    },

    // Alternatives

    alternatives: function($block, blockData) {
        var $containers = $('.alternative-container', $block);
        if (!$containers.length)
            return;

        for (var i = 0; i < $containers.length; i++) {
            var $alts = $('.alternative', $containers[i]);
            if (!$alts.length)
                continue;

            // Show the first alternate per container, and hide the rest.
            $alts.hide();
            $($alts[0]).show();
            $alts.click(gt.display.alternativeClicked);
        }
    },

    alternativeClicked: function(e) {
        var $this = $(this);
        $this.hide();

        var $alts = $('.alternative', $this.closest('.alternative-container'));
        var showIndex = (_.indexOf($alts, this) + 1) % $alts.length;
        $($alts[showIndex]).show();

        gt.list.layout();
    },

    longtap: function($element, tapAction, longTapAction) {
        var threshold = 350;
        var startTime;

        $element.bind('touchstart', function(e) {
            startTime = new Date();
        });

        $element.bind('click', function(e) {
            e.stopImmediatePropagation();

            var now = new Date();
            if (now - startTime <= threshold)
                tapAction.apply(this, [e]);
            else
                longTapAction.apply(this, [e]);

            return false;
        });
    },

    normalizeWheelDelta: function(d) {
        var min = 50;

        if (d < 0 && d > -min)
            return -min;
        else if (d > 0 && d < min)
            return min;
        return d;
    },

    // Popovers

    popover: function($element, cssClass, opened, dismissed) {
        var $container = $('#popover-container');
        $container.addClass(cssClass);
        $container.empty().append($element);
        $container.show();

        var $dismiss = $('<div id="popover-dismiss"></div>');
        $('body').append($dismiss);

        $dismiss.click(function(e) {
            $container.hide();
            $container.removeClass(cssClass);
            $dismiss.remove();

            if (dismissed)
                dismissed();
        });

        $container[0].scrollTop = 0;

        if (opened)
            opened();

        return $container;
    },

    alertp: function(message) {
        var html = '<div id="popover-header">Alert</div><div>' + message + '</div><hr><div class="center"><input class="inline-block" type="button" value="OK" onclick="javascript:gt.display.promptCancel();"></div>';
        gt.display.popover($(html), 'position-center unrestricted');
    },

    promptCallback: null,
    promptp: function(message, value, callback) {
        message = gt.util.escapeHtml(message);
        value = value ? gt.util.escapeHtml(value) : "";
        var html = '<div id="popover-header">' + message + '</div><div><input id="prompt-value" type="text" value="' + value + '"> <input type="button" value="OK" onclick="javascript:gt.display.promptSubmit();"> <input type="button" value="Cancel" onclick="javascript:gt.display.promptCancel();"></div>';

        var opened = function() {
            $('#prompt-value').focus();
        };

        var dismissed = function() {
            // Clean this up just in case.
            gt.display.promptCallback = null;
            window.onkeydown = null;
        };

        window.onkeydown = gt.display.promptKeydown;

        gt.display.promptCallback = callback;
        gt.display.popover($(html), 'position-center', opened, dismissed);
    },

    promptKeydown: function(e) {
        if (e.keyCode == 27) {
            gt.display.promptCancel();
            return false;
        }

        if (e.keyCode == 13) {
            gt.display.promptSubmit();
            return false;
        }

        return true;
    },

    promptSubmit: function(e) {
        var callback = gt.display.promptCallback;
        gt.display.promptCallback = null;
        $('#popover-dismiss').click();

        if (callback) {
            var result = $('#prompt-value').val();
            callback(result);
        }
    },

    promptCancel: function(e) {
        var callback = gt.display.promptCallback;
        gt.display.promptCallback = null;
        $('#popover-dismiss').click();

        if (callback)
            callback(null);
    }
};
gt.list = {
    sortCounter: 0,
    isInitialized: false,
    listItemTemplate: null,
    listHeaderTemplate: null,
    current: null,
    specialIcons: {
        DOL: 'images/job/DOL.png', GATHER: 'images/job/DOL.png', GATHERING: 'images/job/DOL.png', GATHERER: 'images/job/DOL.png',
        DOH: 'images/job/DOH.png', CRAFT: 'images/job/DOH.png', CRAFTING: 'images/job/DOH.png', CRAFTER: 'images/job/DOH.png',
    
        SCRIP: 'images/marker/Rowena.png', SCRIPS: 'images/marker/Rowena.png',
        'RED SCRIP': '../files/icons/item/65031.png', 'RED SCRIPS': '../files/icons/item/65031.png',
        'YELLOW SCRIP': '../files/icons/item/65044.png',
    
        GLAMOUR: '../files/icons/item/28010.png', GLAM: '../files/icons/item/28010.png', FASHION: '../files/icons/item/28010.png',
    
        SPIRITBOND: 'images/item/Convert.png', SPIRITBONDING: 'images/item/Convert.png',
    
        VOYAGE: 'images/Voyage.png', VOYAGES: 'images/Voyage.png',
        AIRSHIP: 'images/Voyage.png', AIRSHIPS: 'images/Voyage.png',
        SUB: 'images/Voyage.png', SUBS: 'images/Voyage.png',
        SUBMARINE: 'images/Voyage.png', SUBMARINES: 'images/Voyage.png',
    
        HOUSE: 'images/marker/House.png', HOUSING: 'images/marker/House.png',
        MANSION: 'images/marker/House.png', COTTAGE: 'images/marker/House.png',
        APARTMENT: 'images/marker/House.png',
        DECORATION: 'images/marker/House.png', DECORATIONS: 'images/marker/House.png',
        FURNISHING: 'images/marker/House.png', FURNISHINGS: 'images/marker/House.png',
    
        PATCH: 'LatestPatch',
        DAILY: '../files/icons/event/71222.png', DAILIES: '../files/icons/event/71222.png',
        QUEST: '../files/icons/event/71221.png', QUESTS: '../files/icons/event/71221.png',
        ORCHESTRION: '../files/icons/item/25945.png', ORCH: '../files/icons/item/25945.png',
        SATISFACTION: 'images/marker/Satisfaction', DELIVERY: 'images/marker/Satisfaction',
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
gt.quest = {
    pluralName: 'Quests',
    type: 'quest',
    blockTemplate: null,
    linkTemplate: null,
    index: {},
    partialIndex: {},
    genreIndex: null,
    version: 2,
    browse: [
        { type: 'group', prop: 'section' },
        { type: 'group', prop: 'category' },
        { type: 'group', prop: 'genre' },
        { type: 'sort', prop: 'sort' }
    ],

    initialize: function(data) {
        gt.quest.blockTemplate = doT.template($('#block-quest-template').text());
        gt.quest.linkTemplate = doT.template($('#link-quest-template').text());
    },

    cache: function(data) {
        gt.quest.index[data.quest.id] = data.quest;
    },

    bindEvents: function($block, data) {
        gt.display.alternatives($block, data);
    },

    getViewModel: function(quest, data) {
        var view = {
            obj: quest,
            id: quest.id,
            type: 'quest',
            name: quest.name,
            patch: gt.formatPatch(quest.patch),
            template: gt.quest.blockTemplate,
            settings: 1,
            icon: '../files/icons/event/' + quest.eventIcon + '.png',
            
            genreIcon: gt.quest.getGenreIcon(quest.genre),
            interval: quest.interval ? gt.util.pascalCase(quest.interval) : null,
            issuer: quest.issuer ? gt.model.partial(gt.npc, quest.issuer) : null,
            beast: quest.beast,
            lvl: 1,
            objectives: quest.objectives,
            journal: quest.journal,
            location: quest.location
        };

        var genre = gt.quest.genreIndex[quest.genre];
        view.genre = genre.name || "Adventurer Quests";
        view.category = genre.category;
        view.section = genre.section;
        view.subheader = (view.interval ? (view.interval + ' ') : '') +  view.section;

        if (view.issuer)
            view.byline = view.issuer.name + ', ' + view.location;
        else
            view.byline = view.location;

        if (data) {
            if (quest.target)
                view.target = gt.model.partial(gt.npc, quest.target);

            if (quest.icon)
                view.fullIcon = '../files/icons/quest/' + quest.icon + '.png';

            if (quest.involved)
                view.involved = gt.model.partialList(gt.npc, quest.involved);

            if (quest.next)
                view.next = gt.model.partialList(gt.quest, quest.next);

            if (quest.usedItems)
                view.usedItems = gt.model.partialList(gt.item, quest.usedItems);

            if (quest.reward) {
                view.reward = {
                    xp: quest.reward.xp,
                    gil: quest.reward.gil,
                    emote: quest.reward.emote,
                    gcseal: quest.reward.gcseal,
                    reputation: quest.reward.reputation,
                    aetherCurrent: quest.reward.aetherCurrent
                };

                if (quest.reward.job)
                    view.reward.job = gt.jobs[quest.reward.job];

                if (quest.reward.instance)
                    view.reward.instance = gt.model.partial(gt.instance, quest.reward.instance);

                if (quest.reward.action)
                    view.reward.action = gt.model.partial(gt.action, quest.reward.action);

                if (quest.reward.items) {
                    var items = [];
                    var optional = [];
                    for (var i = 0; i < quest.reward.items.length; i++) {
                        var itemReward = quest.reward.items[i];
                        var item = gt.model.partial(gt.item, itemReward.id);
                        if (item)
                            (itemReward.one ? optional : items).push({ num: itemReward.num, item: item, hq: itemReward.hq });
                    }
                    view.reward.items = items;
                    if (optional.length)
                        view.reward.optional = optional;
                }
            }

            if (quest.reqs) {
                view.reqs = {
                    beastrank: quest.reqs.beastrank,
                    house: quest.reqs.house,
                    gcrank: quest.reqs.gcrank,
                    mount: quest.reqs.mount
                };

                if (quest.reqs.gc)
                    view.reqs.gc = gt.grandCompanies[quest.reqs.gc];

                if (quest.reqs.quests) {
                    view.reqs.quests = gt.model.partialList(gt.quest, quest.reqs.quests);
                    view.reqs.questsType = quest.reqs.questsType;
                }

                if (quest.reqs.instances)
                    view.reqs.instances = gt.model.partialList(gt.instance, quest.reqs.instances);

                if (quest.reqs.jobs) {
                    if (quest.reqs.jobs.length > 1) {
                        var jobs = [];
                        for (var i = 0; i < quest.reqs.jobs.length; i++) {
                            var jobRequirement = quest.reqs.jobs[i];
                            jobs.push('Lv. ' + jobRequirement.lvl + ' ' + gt.jobCategories[jobRequirement.id].name);
                        }
                        view.reqs.jobs = jobs.join(', ');
                    }
                    view.lvl = quest.reqs.jobs[0].lvl;
                }
            }

            view.dialogue = [];
            var lastName = null;
            for (var i = 0; i < quest.dialogue.length; i++) {
                var line = quest.dialogue[i];
                if (lastName != line.name)
                    view.dialogue.push({ type: 'speaker', text: line.name });
                view.dialogue.push({ type: 'dialogue-line', text: line.text });
                lastName = line.name;
            }

            if (quest.talk) {
                view.talk = [];
                for (var i = 0; i < quest.talk.length; i++) {
                    var talk = quest.talk[i];
                    var speakerNpc = gt.model.partial(gt.npc, talk.npcid);
                    if (!speakerNpc)
                        continue;
                    
                    view.talk.push({ type: 'speaker', npc: speakerNpc, text: talk.name });
                    for (var ii = 0; ii < talk.lines.length; ii++)
                        view.talk.push({ type: 'dialogue-line', text: talk.lines[ii] });
                }
            }
        }

        return view;
    },

    getPartialViewModel: function(partial) {
        var view = {
            id: partial.i,
            type: 'quest',
            name: gt.model.name(partial),
            icon: gt.quest.getQuestIcon(partial.g, partial.r, partial.f),
            location: partial.l,
            sort: partial.s
        };

        var genre = gt.quest.genreIndex[partial.g];
        view.genre = genre.name || "Adventurer Quests";
        view.category = genre.category;
        view.section = genre.section;
        view.byline = view.location;
        return view;
    },

    getQuestIcon: function(genreId, repeatable, unlocksFunction) {
        // Special icons.
        if (unlocksFunction && repeatable)
            return '../files/icons/event/71342.png';

        if (repeatable)
            return '../files/icons/event/71222.png';

        if (unlocksFunction)
            return '../files/icons/event/71341.png';

        // Fall back to genre icons.
        return gt.quest.getGenreIcon(genreId);
    },

    getGenreIcon: function(genreId) {
        var genre = gt.quest.genreIndex[genreId];
        if (genre && genre.icon)
            return '../files/icons/journal/' + genre.icon + '.png';

        // Fall back to a regular quest icon if needed.
        return '../files/icons/journal/61411.png';
    }
};
gt.achievement = {
    pluralName: 'Achievements',
    type: 'achievement',
    blockTemplate: null,
    index: {},
    partialIndex: {},
    categoryIndex: null,
    missingCategory: { kind: 'Unknown', name: 'Unknown' },
    version: 2,
    browse: [
        { type: 'group', func: function(a) { return a.category.kind; } },
        { type: 'group', func: function(a) { return a.category.name; } },
        { type: 'sort', prop: 'name' }
    ],

    initialize: function(data) {
        gt.achievement.blockTemplate = doT.template($('#block-achievement-template').text());
    },

    cache: function(data) {
        gt.achievement.index[data.achievement.id] = data.achievement;
    },

    getViewModel: function(achievement, data) {
        var view = {
            id: achievement.id,
            type: 'achievement',
            name: achievement.name,
            patch: gt.formatPatch(achievement.patch),
            template: gt.achievement.blockTemplate,
            settings: 1,
            icon: '../files/icons/achievement/' + achievement.icon + '.png',
            iconBorder: 1,

            obj: achievement,
            desc: achievement.description,
            category: gt.achievement.categoryIndex[achievement.category] || gt.achievement.missingCategory,
            points: achievement.points,
            title: achievement.title
        };

        if (achievement.item)
            view.item = gt.model.partial(gt.item, achievement.item);

        view.subheader = view.category.kind + ': ' + view.category.name + ' Achievement';

        // Rewards summary.
        var rewards = [];
        if (achievement.title)
            rewards.push(view.obj.title);
        if (achievement.item)
            rewards.push(view.item.name);
        if (rewards.length)
            view.byline = rewards.join(',');
        else
            view.byline = achievement.desc;

        return view;
    },

    getPartialViewModel: function(partial) {
        var name = gt.model.name(partial);

        return {
            id: partial.i,
            type: 'achievement',
            name: name,
            sourceName: name,
            category: gt.achievement.categoryIndex[partial.t] || gt.achievement.missingCategory,
            icon: '../files/icons/achievement/' + partial.c + '.png',
            byline: partial.b
        };
    }
};
gt.action = {
    index: {},
    partialIndex: {},
    categoryIndex: {},
    blockTemplate: null,
    pluralName: 'Actions',
    type: 'action',
    version: 2,
    browse: [
        { type: 'group', prop: 'jobCategory' },
        { type: 'group', prop: 'job' },
        { type: 'paginate' },
        { type: 'sort', prop: 'lvl' }
    ],

    initialize: function(data) {
        gt.action.blockTemplate = doT.template($('#block-action-template').text());
    },

    cache: function(data) {
        gt.action.index[data.action.id] = data.action;
    },

    bindEvents: function($block, data) {
        gt.display.alternatives($block, data);
    },

    getViewModel: function(action, data) {
        var category = gt.action.categoryIndex[action.category];
        var affinity = gt.jobCategories[action.affinity];

        var view = {
            id: action.id,
            type: 'action',
            name: action.name || "",
            patch: gt.formatPatch(action.patch),
            template: gt.action.blockTemplate,
            settings: 1,
            icon: '../files/icons/action/' + action.icon + '.png',
            iconBorder: 1,
            obj: action,
            
            desc: action.description || "",
            affinity: affinity ? affinity.name : "Other",
            category: category ? category.name : "Uncategorized",
            lvl: action.lvl,
            cost: action.cost,
            pet: action.pet
        };

        var job = gt.jobs[action.job] || { name: view.category, category: "Other" };

        view.job = job.name;
        view.jobCategory = job.category;

        view.byline = view.job + ' ' + view.category;
        if (view.lvl)
            view.byline = 'Lv. ' + action.lvl + ' ' + view.byline;
        view.subheader = view.job + (action.lvl ? (' Lv. ' + action.lvl) : '') + ' Action';

        if (!data)
            return view;

        // Range
        if (action.size)
            view.size = action.size + 'y';

        // Non-trait values
        if (view.category != 'Trait') {
            if (action.range == -1)
                view.range = 'Melee';
            else if (action.range !== undefined)
                view.range = action.range + 'y';

            view.cast = {
                name: 'Cast',
                prime: true,
                value: action.cast ? (action.cast / 1000) + 's' : 'Instant'
            };

            view.recast = {
                name: 'Recast',
                prime: true,
                value: action.recast ? (action.recast / 1000) + 's' : 'Instant'
            };
        }

        if (action.resource) {
            view.cost = {
                prime: true,
                name: action.resource + ' Cost',
                value: action.cost
            };

            if (action.resource == 'Status') {
                var status = gt.action.getStatusViewModel(action.cost);
                view.cost.status = '../files/icons/status/' + status.icon + '.png';
                view.cost.name = 'Status';
            }
        }

        // Combos
        if (action.comboFrom)
            view.comboFrom = gt.model.partial(gt.action, action.comboFrom);

        if (action.comboTo)
            view.comboTo = gt.model.partialList(gt.action, action.comboTo);

        // Status
        if (action.requiredStatus || action.gainedStatus) {
            view.status = [];
            if (action.requiredStatus)
                view.status.push(gt.action.getStatusViewModel(action.requiredStatus, 'required'));
            if (action.gainedStatus)
                view.status.push(gt.action.getStatusViewModel(action.gainedStatus, 'gained'));
        }

        // Traits
        var traits = _.union(action.traits, action.actions);
        if (traits.length)
            view.traits = gt.model.partialList(gt.action, traits);

        // Cooldown
        if (view.category == 'Weaponskill' || view.category == 'Ability' || view.category == 'Spell')
            view.gcd = action.gcd ? 'GCD' : 'Off GCD';

        return view;
    },

    getPartialViewModel: function(partial) {
        if (!partial)
            return null;

        var category = gt.action.categoryIndex[partial.t];

        var view = {
            id: partial.i,
            type: 'action',
            name: gt.model.name(partial) || "",
            icon: '../files/icons/action/' + partial.c + '.png',
            lvl: partial.l,
            category: category ? category.name : "Uncategorized"
        };

        var job = gt.jobs[partial.j] || { name: view.category, category: "Other" };
        view.job = job.name;
        view.jobCategory = job.category;

        if (job.name == view.category)
            view.byline = "Other " + view.category;
        else
            view.byline = job.name + ' ' + view.category;

        if (partial.l)
            view.byline = 'Lv. ' + partial.l + ' ' + view.byline;

        return view;
    },

    getStatusViewModel: function(status, relationship) {
        return {
            id: status.id,
            relationship: relationship,
            name: status.name,
            desc: status.desc,
            icon: '../files/icons/status/' + status.icon + '.png'
        };
    }
};
gt.status = {
    index: {},
    partialIndex: {},
    categoryIndex: { 1: 'Beneficial', 2: 'Detrimental' },
    blockTemplate: null,
    pluralName: 'Status Effects',
    type: 'Status',
    version: 2,
    browse: [
        { type: 'group', prop: 'category' },
        { type: 'paginate' },
        { type: 'sort', prop: 'id' }
    ],

    initialize: function(data) {
        gt.status.blockTemplate = doT.template($('#block-status-template').text());
    },

    cache: function(data) {
        gt.status.index[data.status.id] = data.status;
    },

    bindEvents: function($block, data) {
        gt.display.alternatives($block, data);
    },

    getViewModel: function(status, data) {
        var category = gt.status.categoryIndex[status.category];

        var view = {
            id: status.id,
            type: 'status',
            name: status.name || "",
            patch: gt.formatPatch(status.patch),
            template: gt.status.blockTemplate,
            settings: 1,
            icon: '../files/icons/status/' + status.icon + '.png',
            iconBorder: 0,
            obj: status,
            
            desc: status.description || "",
            category: category ? category : "Uncategorized",
            canDispel: status.canDispel
        };

        view.subheader = view.category + ' Status Effect';

        return view;
    },

    getPartialViewModel: function(partial) {
        if (!partial)
            return null;

        var category = gt.status.categoryIndex[partial.t];

        var view = {
            id: partial.i,
            type: 'status',
            name: gt.model.name(partial) || "",
            icon: '../files/icons/status/' + partial.c + '.png',
            category: category ? category : "Uncategorized"
        };

        view.byline = view.category;

        return view;
    },
};
gt.fate = {
    pluralName: 'Fates',
    type: 'fate',
    blockTemplate: null,
    index: {},
    partialIndex: {},
    version: 2,
    browse: [
        { type: 'group', func: gt.browse.transformLevelRange },
        { type: 'header', prop: 'location' },
        { type: 'sort', func: gt.browse.transformLevelAndName }
    ],

    initialize: function(data) {
        gt.fate.blockTemplate = doT.template($('#block-fate-template').text());
    },

    cache: function(data) {
        gt.fate.index[data.fate.id] = data.fate;
    },

    getViewModel: function(fate, data) {
        var view = {
            id: fate.id,
            type: 'fate',
            name: fate.name,
            patch: gt.formatPatch(fate.patch),
            template: gt.fate.blockTemplate,
            settings: 1,
            icon: '../files/icons/fate/' + fate.type + '.png',
            byline: 'Lv. ' + fate.lvl,
            obj: fate,
            
            description: fate.description,
            lvl: fate.lvl,
            maxlvl: fate.maxlvl,
            category: fate.type,
            location: '???',
            fullLocation: '???'
        };

        view.sourceName = view.name;

        if (fate.zoneid) {
            var location = gt.location.index[fate.zoneid];
            if (location) {
                view.fullLocation = view.location = location.name;
                if (fate.coords) {
                    view.fullLocation += ' (' + fate.coords[0] + ', ' + fate.coords[1] + ')';
                    view.map = gt.map.getViewModel({ location: location, coords: fate.coords, approx: 1, icon: view.icon });
                }

                view.byline = 'Lv. ' + fate.lvl + ', ' + location.name;
            }
        }

        var levelRange = fate.lvl == fate.maxlvl ? fate.lvl : (fate.lvl + "-" + fate.maxlvl);
        view.subheader = "Level " + levelRange + " " + fate.type + " FATE";

        if (data && fate.items)
            view.items = gt.model.partialList(gt.item, fate.items);

        return view;
    },

    resolveCraftSource: function(step, id) {
        step.sourceType = 'fate';
        step.sourceView = gt.model.partial(gt.fate, id || step.item.fates[0]);
        step.setCategory(['FATE', 'Other']);
    },

    getPartialViewModel: function(partial) {
        var zone = partial.z ? gt.location.index[partial.z] : null;
        var name = gt.model.name(partial);

        return {
            id: partial.i,
            type: 'fate',
            name: name,
            sourceName: name,
            location: zone ? zone.name : '???',
            icon: '../files/icons/fate/' + partial.t + '.png',
            byline: 'Lv. ' + partial.l + (zone ? (', ' + zone.name) : ''),
            lvl: partial.l
        };
    }
};
gt.leve = {
    pluralName: 'Leves',
    type: 'leve',
    index: {},
    partialIndex: {},
    rewardIndex: {},
    blockTemplate: null,
    version: 3,
    browse: [
        { type: 'icon-list', prop: 'jobCategory', iconFunc: function(k) { return '../files/icons/job/' + k + '.png'; } },
        { type: 'group', reverse: 1, func: function(l) { return gt.browse.transformLevelRangeCore(l.lvl, 10); } },
        { type: 'header', func: function(l) { return gt.browse.transformLevel(l) + ', ' + l.location; } },
        { type: 'sort', func: function(l) { return l.name; } }
    ],

    initialize: function(data) {
        gt.leve.blockTemplate = doT.template($('#block-leve-template').text());
    },

    cache: function(data) {
        gt.leve.index[data.leve.id] = data.leve;

        if (data.rewards)
            gt.leve.rewardIndex[data.rewards.id] = data.rewards;

        _.each(data.ingredients, function(i) { gt.item.ingredients[i.id] = i; });
    },

    bindEvents: function($block, data, view) {
        $('.new-group', $block).click(gt.leve.newGroupClicked);
    },

    getViewModel: function(leve, data) {
        var view = {
            id: leve.id,
            type: 'leve',
            name: leve.name,
            patch: gt.formatPatch(leve.patch),
            template: gt.leve.blockTemplate,
            leve: leve,
            subheader: 'Leve',
            settings: 1,
            obj: leve,

            areaIcon: '../files/icons/leve/area/' + leve.areaicon + '.png',
            plateIcon: '../files/icons/leve/plate/' + leve.plate + '.png',
            frameIcon: '../files/icons/leve/frame/' + leve.frame + '.png',
            sourceName: leve.name,
            desc: leve.description,
            icon: 'images/marker/Leve.png',
            jobCategory: gt.jobCategories[leve.jobCategory].name,
            lvl: leve.lvl,
            client: leve.client,
            xp: leve.xp ? leve.xp.toLocaleString() : undefined,
            gil: leve.gil ? leve.gil.toLocaleString() : undefined,
            repeats: leve.repeats,
            complexity: leve.complexity
        };

        view.location = gt.location.index[leve.areaid].name;
        view.byline = 'Lv. ' + leve.lvl + ', ' + view.location;
        view.subheader = "Level " + leve.lvl + " " + view.jobCategory + " Leve";

        if (leve.gc)
            view.gcIcon = 'images/region/flag/' + gt.grandCompanies[leve.gc] + '.png';

        if (data) {
            view.levemete = gt.model.partial(gt.npc, leve.levemete);

            if (leve.coords)
                view.coords = leve.coords;

            if (leve.zoneid)
                view.zone = gt.location.index[leve.zoneid];

            if (leve.rewards) {
                var rewards = gt.leve.rewardIndex[leve.rewards];
                view.rewards = [];
                for (var i = 0; i < rewards.entries.length; i++) {
                    var entry = rewards.entries[i];
                    view.rewards.push({
                        item: gt.model.partial(gt.item, entry.item),
                        rate: entry.rate,
                        amount: entry.amount,
                        hq: entry.hq
                    });
                }
            }

            if (leve.requires) {
                view.requires = [];
                for (var i = 0; i < leve.requires.length; i++) {
                    var r = leve.requires[i];
                    view.requires.push({ item: gt.model.partial(gt.item, r.item), amount: r.amount });
                }
            }

            if (leve.complexity) {
                view.xpPerComplexity = Math.round(leve.xp / view.complexity.nq);
                view.xpPerComplexityHq = Math.round(2 * leve.xp / view.complexity.hq);
            }

            var isDoH = _.find(gt.jobs, function(j) { return j.abbreviation == view.jobCategory && j.category == 'Disciple of the Hand' });
            if (isDoH)
                view.doh = true;
        }
        
        return view;
    },

    getPartialViewModel: function(partial) {
        var name = gt.model.name(partial);

        var view = {
            id: partial.i,
            type: 'leve',
            name: name,
            sourceName: name,
            jobCategory: gt.jobCategories[partial.j].name,
            lvl: partial.l,
            icon: 'images/marker/Leve.png'
        };

        var location = gt.location.index[partial.p];
        view.location = location ? location.name : "???";
        view.byline = 'Lv. ' + partial.l + ', ' + view.location;

        return view;
    },

    newGroupClicked: function(e) {
        var $block = $(this).closest('.block');
        var view = $block.data('view');
        gt.group.setup('Leve Calculator', $block, function(groupData) {
            var leveData = { type: 'leve', id: view.id };
            groupData.activePage = 'contents-page';
            groupData.headers = groupData.headers || { };
            groupData.headers['contents-' + view.id] = true;
            gt.group.insertGroupCore(leveData, groupData);
        });
    },

    resolveCraftSource: function(step, id) {
        step.sourceType = 'leve';
        step.sourceView = { id: id, type: 'leve', name: 'Leve', sourceName: 'Leve', icon: 'images/marker/Leve.png' };
        step.setCategory(['Leve', 'Other']);
    },
};
gt.venture = {
    index: null,
    type: 'venture',

    getViewModel: function(venture, data) {
        var view = {
            id: venture.id,
            type: 'venture',
            icon: '../files/icons/item/65049.png',
            lvl: venture.lvl,
            cost: venture.cost,
            minutes: venture.minutes,
            name: venture.name,
            ilvl: venture.ilvl,
            gathering: venture.gathering,
            amounts: venture.amounts,
            requireIcon: venture.gathering ? 'images/Gathering.png' : 'images/item/ilvl.png',
            requireList: venture.gathering ? venture.gathering : venture.ilvl,
            random: venture.random
        };

        var jobCategory = gt.jobCategories[venture.jobs];
        view.jobs = jobCategory.name;

        view.longSourceName = view.jobs + ", Lv. " + view.lvl;
        if (jobCategory.jobs.length > 1)
            view.sourceName = gt.util.abbr(view.jobs) + ", Lv. " + view.lvl;
        else
            view.sourceName = view.longSourceName;

        return view;
    },

    resolveCraftSource: function(step, id) {
        if (id) {
            gt.venture.resolveCraftSourceCore(step, gt.venture.index[id]);
            return true;
        }

        // This function only discovers sources when the user has marked
        // venture preferences.
        var settings = gt.settings.data;
        var itemVentures = step.item.ventures;

        for (var i = 0; i < itemVentures.length; i++) {
            var itemVentureId = itemVentures[i];
            var venture = gt.venture.index[itemVentureId];
            if (!venture)
                continue;
                
            if ((venture.jobs == 17 && settings.minerVentures) ||
                (venture.jobs == 18 && settings.botanyVentures) ||
                (venture.jobs == 19 && settings.fisherVentures) ||
                (venture.jobs == 34 && settings.combatVentures)) {
                gt.venture.resolveCraftSourceCore(step, venture);
                return true;
            }
        }

        // No preferred ventures found.
        return false;
    },

    resolveCraftSourceCore: function(step, venture) {
        step.sourceType = 'venture';
        step.sourceView = gt.venture.getViewModel(venture);
        step.setCategory(['Venture', 'Other']);
    }
};
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

        console.error('Invalid id for view model', data.id);
        return null;
    },

    getLevelingViewModel: function(job, data) {
        var view = {
            id: data.id,
            type: 'equip',
            name: 'Leveling ' + job.name,
            template: gt.equip.levelingTemplate,
            blockClass: 'early tool noexpand',
            icon: '../files/icons/job/' + job.abbreviation + '.png',
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
        var endLevel = Math.min(equipment.length, view.lvl + 4);

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
            icon: '../files/icons/job/' + job.abbreviation + '.png',
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
        var view = $block.data('view');

        data.lvl = parseInt($this.val());
        data.lvl = Math.min(Math.max(data.lvl, 3), view.maxLvl);

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
};gt.skywatcher = {
    type: 'skywatcher',
    blockTemplate: null,
    weatherIndex: null,
    weatherRateIndex: null,
    regions: [
        { icon: "images/region/La Noscea.png", name: "La Noscea", page: "LaNoscea", zones: [27, 30, 31, 32, 33, 34, 350, 358, 425] },
        { icon: "images/region/Black Shroud.png", name: "The Black Shroud", page: "TheBlackShroud", zones: [39, 54, 55, 56, 57, 426] },
        { icon: "images/region/Thanalan.png", name: "Thanalan", page: "Thanalan", zones: [51, 42, 43, 44, 45, 46, 427] },
        { icon: "images/region/Ishgard.png", name: "Ishgard and Surrounds", page: "Ishgard", zones: [62, 63, 2200, 2100, 2101, 2082, 2000, 2001, 2002, 1647] },
        { icon: "images/region/Gyr Abania.png", name: "Gyr Abania", page: "GyrAbania", zones: [2403, 2406, 2407, 2408] },
        { icon: "images/region/Kugane.png", name: "Far East", page: "FarEast", zones: [513, 2412, 2409, 2410, 2411, 3534, 3662] },
        { icon: "images/region/Ilsabard.png", name: "Ilsabard", page: "Ilsabard", zones: [3707, 3709, 3710, 2414, 2462, 2530, 2545] },
        { icon: "images/region/Norvrandt.png", name: "Norvrandt", page: "Norvrandt", zones: [516, 517, 2953, 2954, 2955, 2956, 2957, 2958], },
        { icon: "images/marker/Aetheryte.png", name: "Others", page: "Others", zones: [67, 3706, 3708, 3711, 3712, 3713] }
    ],
    weatherUpdateKey: null,
    lWeatherStart: null,
    lWeatherEnd: null,

    initialize: function(settings) {
        gt.skywatcher.blockTemplate = doT.template($('#block-skywatcher-template').text());
    },

    bindEvents: function($block, data, view) {
        $('.zone .icon', $block).click(gt.skywatcher.weatherClicked);
        gt.display.notifications($block, data);
    },

    getViewModel: function(id, data) {
        gt.skywatcher.ensureWeatherUpdate();

        var maxWeather = 15;
        var view = {
            id: id,
            type: 'skywatcher',
            name: 'Skywatcher',
            template: gt.skywatcher.blockTemplate,
            blockClass: 'tool noexpand',
            icon: 'images/marker/Skywatcher.png',
            subheader: 'Weather Forecast Tool',
            tool: 1,
            settings: 1,

            regions: [],
            localTimestamps: [],
            eorzeaTimestamps: []
        };

        // Show weather by region.
        var lStart = gt.skywatcher.lWeatherStart;
        var lEnd = gt.skywatcher.lWeatherEnd;
        var eStart = gt.time.localToEorzea(lStart);
        eStart.setUTCHours(eStart.getUTCHours() - 8); // Show the previous weather for transitions.

        view.initialChangeTime = gt.time.formatTime(lEnd, gt.time.hoursMinutes);
        view.initialProgressPercent = gt.time.getPercentTimeDifference(lStart, lEnd);
        view.initialTimeRemaining = gt.time.formatCountdown(lEnd);

        for (var ri = 0; ri < gt.skywatcher.regions.length; ri++) {
            var region = gt.skywatcher.regions[ri];
            var zones = region.zones;
            var regionView = { icon: region.icon, name: region.name, page: region.page, zones: [] };
            view.regions.push(regionView);

            for (var zi = 0; zi < zones.length; zi++) {
                var zone = gt.location.index[zones[zi]];
                if (!zone)
                    continue;
                var zoneView = { id: zone.id, weather: [] };
                zoneView.name = gt.skywatcher.getShortZoneName(zone.name);
                regionView.zones.push(zoneView);

                // Now fill in the zone weather
                gt.skywatcher.iterateWeather(eStart, zone, function(weather) {
                    zoneView.weather.push(weather);
                    return zoneView.weather.length >= maxWeather;
                });
            }
        }

        // Store timestamps.
        var eCurrent = new Date(eStart);
        for (var i = 0; i < maxWeather; i++) {
            view.localTimestamps.push(gt.time.formatTime(gt.time.eorzeaToLocal(eCurrent)));
            view.eorzeaTimestamps.push(gt.time.formatEorzeaHour(eCurrent));
            eCurrent.setUTCHours(eCurrent.getUTCHours() + 8);
        }

        // Calculate the next occurrence for favorites.
        if (data.favorites) {
            view.audio = 1;
            view.favorites = [];

            for (var i = 0; i < data.favorites.length; i++) {
                var favorite = data.favorites[i];
                var zone = gt.location.index[favorite.id];
                if (zone) {
                    var favoriteView = gt.skywatcher.getFavoriteView(zone, favorite.weather)
                    view.favorites.push(favoriteView);
                }
            }

            view.favorites = _.sortBy(view.favorites, function(f) { return f.lProgressEnd; });
        }

        return view;
    },

    getFavoriteView: function(zone, weather) {
        var eStart = gt.time.localToEorzea(gt.skywatcher.lWeatherStart);
        var eNow = gt.time.eCurrentTime();

        // First find the last time this zone had that weather.  It could be active now.
        var eCurrent = new Date(eStart);
        var lProgressStart = null;
        var type = null;
        while (true) {
            var lCurrent = gt.time.eorzeaToLocal(eCurrent);
            var currentWeather = gt.skywatcher.forecast(lCurrent, zone);
            if (currentWeather == weather) {
                eCurrent.setUTCHours(eCurrent.getUTCHours() + 8);
                if (eNow < eCurrent) {
                    // The weather is currently active.  Mark when it started.
                    type = 'active';
                    lProgressStart = lCurrent;
                } else  {
                    // The weather is over.  Mark when it ended.
                    type = 'dormant';
                    lProgressStart = gt.time.eorzeaToLocal(eCurrent);
                }

                break;
            }

            eCurrent.setUTCHours(eCurrent.getUTCHours() - 8);
        }

        // Now find when the weather starts again, or the active pattern ends.
        eCurrent = new Date(eStart);
        var lProgressEnd = null;
        while (true) {
            eCurrent.setUTCHours(eCurrent.getUTCHours() + 8);
            var lCurrent = gt.time.eorzeaToLocal(eCurrent);
            var currentWeather = gt.skywatcher.forecast(lCurrent, zone);
            var isTarget = currentWeather == weather;
            if ((isTarget && type == 'dormant') || (!isTarget && type == 'active')) {
                // The weather will now occur, or active weather has ended.
                lProgressEnd = lCurrent;
                break;
            }
        }

        var view = { zone: zone, weather: weather, type: type, lProgressStart: lProgressStart, lProgressEnd: lProgressEnd };
        view.name = gt.skywatcher.getShortZoneName(zone.name);
        view.initialChangeTime = gt.time.formatTime(lProgressEnd, gt.time.hoursMinutes) + ' (ET ' + gt.time.formatTime(gt.time.localToEorzea(lProgressEnd), gt.time.hoursMinutesUTC) + ')';
        view.initialProgressPercent = gt.time.getPercentTimeDifference(lProgressStart, lProgressEnd);
        view.initialTimeRemaining = gt.time.formatCountdown(lProgressEnd);
        return view;
    },

    forecast: function(lDate, loc) {
        var weatherRate = gt.skywatcher.weatherRateIndex[loc.weatherRate];
        if (!weatherRate) {
            console.error("No weather rates for zone", loc);
            return null;
        }

        var forecastTarget = gt.skywatcher.calculateForecastTarget(lDate);
        var rate = _.find(weatherRate.rates, function(r) { return forecastTarget < r.rate; });
        return gt.skywatcher.weatherIndex[rate.weather];
    },

    calculateForecastTarget: function(lDate) {
        // Thanks to Rogueadyn's SaintCoinach library for this calculation.

        var unixSeconds = parseInt(lDate.getTime() / 1000);
        // Get Eorzea hour for weather start
        var bell = unixSeconds / 175;

        // Do the magic 'cause for calculations 16:00 is 0, 00:00 is 8 and 08:00 is 16
        var increment = (bell + 8 - (bell % 8)) % 24;

        // Take Eorzea days since unix epoch
        var totalDays = unixSeconds / 4200;
        totalDays = (totalDays << 32) >>> 0; // uint

        // 0x64 = 100
        var calcBase = totalDays * 100 + increment;

        // 0xB = 11
        var step1 = ((calcBase << 11) ^ calcBase) >>> 0; // uint
        var step2 = ((step1 >>> 8) ^ step1) >>> 0; // uint

        // 0x64 = 100
        return step2 % 100;
    },

    getWeatherInterval: function(eDate) {
        var eWeather = new Date(eDate ? eDate : gt.time.eCurrentTime());
        eWeather.setUTCHours(parseInt(eWeather.getUTCHours() / 8) * 8);
        eWeather.setUTCMinutes(0);
        eWeather.setUTCSeconds(0);
        return eWeather;
    },

    ensureWeatherUpdate: function() {
        if (gt.skywatcher.weatherUpdateKey)
            return;

        var eStart = gt.skywatcher.getWeatherInterval();
        gt.skywatcher.lWeatherStart = gt.time.eorzeaToLocal(eStart);;

        var eEnd = new Date(eStart);
        eEnd.setUTCHours(eEnd.getUTCHours() + 8);
        gt.skywatcher.lWeatherEnd = gt.time.eorzeaToLocal(eEnd);

        gt.skywatcher.weatherUpdateKey = setInterval(gt.skywatcher.weatherUpdate, 1000);
    },
    
    weatherUpdate: function() {
        var $block = $('.skywatcher.block');
        if (!$block.length) {
            clearInterval(gt.skywatcher.weatherUpdateKey);
            gt.skywatcher.weatherUpdateKey = null;
            return;
        }

        var lChangeStart = gt.skywatcher.lWeatherStart;
        var lChangeEnd = gt.skywatcher.lWeatherEnd;

        var now = new Date();
        if (now > lChangeEnd) {
            // Rollover time!
            gt.skywatcher.lWeatherStart = lChangeEnd;

            var eEnd = gt.time.localToEorzea(lChangeEnd);
            eEnd.setUTCHours(eEnd.getUTCHours() + 8);
            gt.skywatcher.lWeatherEnd = gt.time.eorzeaToLocal(eEnd);

            gt.core.redisplay($block);
            return;
        }

        // Update change progress and countdown.
        var changePercent = gt.time.getPercentTimeDifference(lChangeStart, lChangeEnd);
        var changeCountdown = gt.time.formatCountdown(lChangeEnd);
        $('.weather-change .progress', $block).css('width', changePercent + '%');
        $('.weather-change .time-remaining', $block).text(changeCountdown);

        // Update favorites.
        var view = $block.data('view');
        if (!view || !view.favorites)
            return;

        var data = $block.data('block');

        for (var i = 0; i < view.favorites.length; i++) {
            var favorite = view.favorites[i];
            var $favorite = $('.favorite[data-zoneid=' + favorite.zone.id + '][data-weather="' + favorite.weather + '"]', $block);

            var percent = gt.time.getPercentTimeDifference(favorite.lProgressStart, favorite.lProgressEnd);
            var countdown = gt.time.formatCountdown(favorite.lProgressEnd);
            $('.time-remaining', $favorite).text(countdown);
            $('.progress', $favorite).css('width', percent + '%');

            if (data.alarms && favorite.type == 'dormant' && countdown == '2:00' && gt.settings.data.notifications) {
                gt.display.playWarningAlarm();
                gt.skywatcher.notifyWeather(favorite);
            }
        }
    },

    notifyWeather: function(favorite) {
        if (!window.Notification || window.Notification.permission != "granted")
            return;

        gt.util.showNotification(favorite.weather, {
            icon: '../files/icons/weather/' + favorite.weather + '.png',
            body: favorite.zone.name
        });
    },

    iterateWeather: function(eStart, zone, callback)  {
        var eCurrent = new Date(eStart);
        eCurrent.setUTCHours(eCurrent.getUTCHours() - 8);
        var transitionWeather = gt.skywatcher.forecast(gt.time.eorzeaToLocal(eCurrent), zone);
        for (var i = 0; i < 2000; i++) {
            eCurrent.setUTCHours(eCurrent.getUTCHours() + 8);
            var weather = gt.skywatcher.forecast(gt.time.eorzeaToLocal(eCurrent), zone);
            var result = callback(weather, transitionWeather, eCurrent);
            if (result)
                return result;

            transitionWeather = weather;
        }

        console.error('Infinite iteration detected', zone.name, eStart);
    },

    calculateWindow: function(lStart, options) {
        var zone = gt.location.index[options.zone];
        var eStart = lStart ? gt.time.localToEorzea(lStart) : gt.skywatcher.getWeatherInterval();
        eStart.setUTCHours(eStart.getUTCHours() + 8); // Advance by one iteration.

        var hourCheck = null;
        if (options.during) {
            if (options.during.start < options.during.end)
                hourCheck = function(h) { return h >= options.during.start && h < options.during.end; };
            else
                hourCheck = function(h) { return h >= options.during.start || h < options.during.end; };
        }

        var lResult = gt.skywatcher.iterateWeather(eStart, zone, function(weather, transitionWeather, eTime) {
            if (options.transition && !_.contains(options.transition, transitionWeather))
                return;

            if (options.weather && !_.contains(options.weather, weather))
                return;

            if (hourCheck) {
                var eCheckTime = new Date(eTime);
                var passes = false;
                // Check all the hours between the time this weather starts and the time it ends.
                for (var i = 0; i < 7; i++) {
                    var hour = eCheckTime.getUTCHours();
                    if (hourCheck(hour)) {
                        eTime = eCheckTime;
                        passes = true;
                        break;
                    }

                    eCheckTime.setUTCHours(hour + 1);
                }

                if (!passes)
                    return;
            }

            // All checks passed, it's happening!!

            if (options.after) {
                // Eorzea Time Transforms
                if (options.after.eorzeaHours)
                    eTime.setUTCHours(eTime.getUTCHours() + options.after.eorzeaHours);
            }

            return gt.time.eorzeaToLocal(eTime);
        });

        return lResult;
    },

    weatherClicked: function(e) {
        var $this = $(this);
        var $zone = $this.closest('.zone');
        var $block = $zone.closest('.block');

        var data = $block.data('block');
        if (!data.favorites)
            data.favorites = [];

        var weather = $this.data('weather');
        var locationid = $zone.data('zoneid');
        var index = _.findIndex(data.favorites, function(f) { return f.id == locationid && f.weather == weather; });
        if (index == -1)
            data.favorites.push({id: locationid, weather: weather});
        else
            data.favorites.splice(index, 1);

        gt.core.redisplay($block);
        gt.settings.saveDirty();
    },

    getShortZoneName: function(name) {
        if (name == "Coerthas Central Highlands")
            return "C. Central Highlands";
        if (name == "Coerthas Western Highlands")
            return "C. Western Highlands";

        return name;
    }
};
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

    if (this.startingQuality)
        this.startingQuality = Math.floor(this.startingQuality);

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

    if (gt.settings.data.preferGathering && this.item.nodes) {
        gt.node.resolveCraftSource(this);
        return;
    }

    if (gt.settings.data.preferCrafting && this.item.craft) {
        this.setCraftSource(itemSettings);
        return;
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
        const partialList = gt.model.partialList(gt.item, this.item.reducedFrom);
        const reduceItem = partialList && partialList[0] || { name: '???' };
        this.sourceType = 'reduction';
        this.source = { sourceName: reduceItem.name, longSourceName: reduceItem.name + ' Aetherial Reduction', icon: 'images/item/Reduce.png' };
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
        this.source = { sourceName: 'Desynthesis', longSourceName: 'Desynthesis', icon: 'images/item/Desynth.png' };
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
        icon: gt.item.iconPath(65002),
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
                        var amount = currencyListing.amount * itemView.groupAmount / rewardListing.amount;
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
gt.map = {
    dragOriginX: 0,
    dragOriginY: 0,
    dragging: null,
    pixelsPerGrid: 50,
    pageTemplate: null,

    initialize: function(data) {
        gt.map.pageTemplate = doT.template($('#page-map-template').text());
    },

    setup: function ($block) {
        var $container = $('.map-container', $block);
        if (!$container.length)
            return;

        var id = $container.data('id');
        var location = gt.location.index[id];
        var x = Number($container.data('x'));
        var y = Number($container.data('y'));
        var r = Number($container.data('r'));

        if (!gt.display.isTouchDevice) {
            // Dragging, at least, works fine with touch by default.
            $container.bind('wheel', gt.map.wheel);

            $container.bind(gt.display.downEvent, gt.map.dragDown);
            $container.bind(gt.display.moveEvent, gt.map.mousemove);
            $container.bind('mouseout', gt.map.mouseout);
        }

        $container.data('location', location);

        // Paint the image.
        var $canvas = $('canvas', $container);
        if (!$canvas.length) {
            console.error("Can't find canvas, skipping map setup.");
            return;
        }
        
        var image = new Image();
        image.src = $canvas.data('image');
        image.onload = function(e) {
            var context = $canvas[0].getContext('2d');
            if (!context)
                return; // May have disappeared.

            context.drawImage(image, 0, 0);

            // Draw a circle for the location.
            context.beginPath();
            context.arc(x, y, r, 0, Math.PI * 2, false);
            context.fillStyle = 'rgba(164, 164, 219, 0.4)';
            context.fill();
            context.closePath();

            // Draw grid.
            context.beginPath();
            context.strokeStyle = 'rgba(50, 50, 50, 0.06)';
            var size = gt.map.pixelsPerGrid * location.size;
            for (var i = 0; i < 2048; i += size) {
                for (var ii = 0; ii < 2048; ii += size)
                    context.strokeRect(i, ii, size, size);
            }
            context.closePath();

            // Outline the circle.
            // Not available on some browsers.
            if (context.setLineDash) {
                context.beginPath();
                context.setLineDash([3]);
                context.arc(x, y, r, 0, Math.PI * 2, false);
                context.strokeStyle = 'rgba(192, 192, 214, 1)';
                context.stroke();
            }

            // Load and draw the icon if applicable.
            var iconSrc = $canvas.data('icon');
            if (iconSrc) {
                var iconImage = new Image();
                iconImage.src = iconSrc;
                iconImage.onload = function(e) {
                    var iconfilter = $canvas.data('iconfilter');
                    if (iconfilter)
                        context.filter = iconfilter;
                    context.drawImage(iconImage, x - 12, y - 12, 25, 25);
                };             
            }
        };

        // Center scrollbar on the coordinates.
        // Page must be visible for this to work!
        var mapContainer = $container[0];
        mapContainer.scrollLeft = x - mapContainer.clientWidth / 2;
        mapContainer.scrollTop = y - mapContainer.clientHeight / 2;
    },

    getViewModel: function(map) {
        if (!map.location.parentId)
            return null;

        var view = {
            location: map.location,
            parent: gt.location.index[map.location.parentId],
            displayCoords: map.coords,
            icon: map.icon,
            iconfilter: map.iconfilter
        };

        var offset = map.approx ? 0.5 : 1;
        var x = (map.coords[0] - offset) * gt.map.pixelsPerGrid * map.location.size;
        var y = (map.coords[1] - offset) * gt.map.pixelsPerGrid * map.location.size;
        view.coords = [x, y];

        if (map.radius)
            view.radius = gt.map.toMapCoordinate(map.radius, map.location.size) * Math.PI * 2;
        else {
            view.radius = gt.map.pixelsPerGrid / 2;
            if (map.approx)
                view.radius *= map.location.size;
        }

        if (view.radius < 15)
            view.radius = 15

        view.image = '../files/maps/' + view.parent.name + '/' + gt.map.sanitizeLocationName(view.location.name) + '.png';

        return view;
    },

    sanitizeLocationName: function(name) {
        if (name.indexOf('The Diadem') == 0)
            return 'The Diadem';
        else
            return name;
    },

    toMapCoordinate: function(value, size) {
        return ((50 / size) * ((value * size) / 2048));
    },

    getGridPosition: function(e, mapContainer) {
        var x = e.offsetX + mapContainer.scrollLeft;
        var y = e.offsetY + mapContainer.scrollTop;

        var zoom = Number($('.map', mapContainer).css('zoom') || 1);

        var location = $(mapContainer).data('location');
        var mapX = (x / (gt.map.pixelsPerGrid * zoom)) / location.size;
        var mapY = (y / (gt.map.pixelsPerGrid * zoom)) / location.size;
        return {x: mapX, y: mapY};
    },

    getAbsolutePosition: function(pos, mapContainer) {
        var location = $(mapContainer).data('location');
        var pixelsPerGrid = gt.map.pixelsPerGrid * Number($('.map', mapContainer).css('zoom') || 1);
        var scrollX = pos.x * pixelsPerGrid * location.size;
        var scrollY = pos.y * pixelsPerGrid * location.size;
        return {x: scrollX, y: scrollY};
    },

    mousemove: function(e) {
        var pos = gt.map.getGridPosition(e, this);
        $('.position', this).text(parseInt(pos.x + 1)  + ", " + parseInt(pos.y + 1));
    },

    wheel: function(e) {
        e.stopPropagation();
        e = e.originalEvent;

        var gridPos = gt.map.getGridPosition(e, this);

        var delta = gt.display.normalizeWheelDelta(e.deltaY) * .0015;

        var $map = $('.map', this);
        var currentZoom = Number($map.css('zoom') || 1);
        var zoom = Math.min(Math.max(currentZoom - delta, 0.182), 1.75);
        $map.css('zoom', zoom);

        // Zooming shifts location.  Readjust scrollbar to account for changes.
        var absolutePos = gt.map.getAbsolutePosition(gridPos, this);
        this.scrollLeft = absolutePos.x - e.offsetX;
        this.scrollTop = absolutePos.y - e.offsetY;

        return false;
    },

    mouseout: function(e) {
        // Reset coords when moving the mouse out of the map.
        var $position = $('.position', this);
        $position.text($position.data('original'));
    },

    dragDown: function(e) {
        gt.map.dragOriginX = e.pageX;
        gt.map.dragOriginY = e.pageY;
        gt.map.dragging = this;

        $('html')
            .bind('mouseup touchend', gt.map.dragUp)
            .bind('mousemove touchmove', gt.map.dragMove);

        $(this).addClass('dragging');
    },

    dragUp: function(e) {
        $('html')
            .unbind('mouseup')
            .unbind('mousemove')
            .unbind('touchup')
            .unbind('touchmove');

        $('.dragging').removeClass('dragging');

        gt.map.dragOriginX = 0;
        gt.map.dragOriginY = 0;
        gt.map.dragging = null;
    },

    dragMove: function(e) {
        var x = e.pageX;
        var y = e.pageY;

        var maxDelta = 15;
        var acceleration = 1.15;
        xDelta = Math.min(Math.max(gt.map.dragOriginX - x, -maxDelta), maxDelta) * acceleration;
        yDelta = Math.min(Math.max(gt.map.dragOriginY - y, -maxDelta), maxDelta) * acceleration;

        if (xDelta > 1 || xDelta < 1)
            gt.map.dragging.scrollLeft += xDelta;

        if (yDelta > 1 || yDelta < 1)
            gt.map.dragging.scrollTop += yDelta;

        gt.map.dragOriginX = x;
        gt.map.dragOriginY = y;

        return false;
    },

    export: function() {
        var $canvas = $('.block.active canvas.map');
        if (!$canvas.length)
            return;

        var link = $('<a>Download map as image</a>')[0];
        link.href = $canvas[0].toDataURL("image/jpeg");
        link.download = $('.block.active').data('view').name;
        $('body').append(link);
        link.click();
        $(link).remove();
    }
};
gt.note = {
    blockTemplate: null,
    type: 'note',

    initialize: function(data) {
        gt.note.blockTemplate = doT.template($('#block-note-template').text());

        $('#new-note').click(gt.note.newNoteClicked);
    },

    bindEvents: function($block, data, view) {
        $('.name-handle', $block).bind(gt.display.downEvent, gt.core.renameHeaderClicked);
        $('.note-text', $block).change(gt.note.notesChanged);

        gt.note.adjustHeight($block, data.notes);
    },

    newNoteClicked: function(e) {
        var name = "Note";
        var counter = 2;

        while (gt.list.getBlockData('note', name))
            name = "Note " + counter++;

        var note = { type: 'note', id: name };
        gt.list.addBlock(note);
        gt.core.activate('note', name);
    },

    notesChanged: function(e) {
        var $block = $(this).closest('.block');
        var data = $block.data('block');

        data.notes = $(this).val();
        if (!data.notes)
            delete data.notes;

        gt.note.adjustHeight($block, data.notes);
        gt.list.resized($block);

        gt.settings.saveDirty();
    },

    adjustHeight: function($block, notes) {
        var $text = $('.note-text', $block);
        $text.css('height', '');

        var height = $text[0].scrollHeight + 12;
        if (height < 159)
            height = 159 - 1;
        else if (height < 411)
            height = 411 - 1;
        else if (height < 663)
            height = 663 - 1;
        else
            height = 915 - 1;

        $('.note-text', $block).css('height', height + 'px');
    },

    getViewModel: function(note, data) {
        // todo: remove he module check.
        return {
            id: data.id,
            type: 'note',
            name: data.id,
            displayName: he.encode(data.id),
            template: gt.note.blockTemplate,
            blockClass: 'tool expand-right',
            icon: 'images/site/Note.png',
            subheader: 'Note Tool',
            tool: 1,

            text: data.notes || ''
        };
    }
};
