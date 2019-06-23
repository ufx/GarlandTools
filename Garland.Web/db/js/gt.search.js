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
                var set = bestMatches.length < maxSet ? bestMatches : allMatches;
                set.push(data);
                return bestMatches.length == maxSet && allMatches.length >= 1;
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
                gt.search.resultIndex[value.type][value.id] = value.obj;
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
            .append(_.map(matches.result, gt.search.resultTemplate))
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
        return gt[searchResult.type].getPartialViewModel(searchResult.obj);
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
