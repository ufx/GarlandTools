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
