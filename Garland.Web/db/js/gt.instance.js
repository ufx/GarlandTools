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
