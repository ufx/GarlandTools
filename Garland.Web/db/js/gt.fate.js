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
