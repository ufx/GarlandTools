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
                browseIcon: firstEntry.browseIcon || firstEntry.icon,
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
