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
            relationship: relationship,
            name: status.name,
            desc: status.desc,
            icon: '../files/icons/status/' + status.icon + '.png'
        };
    }
};
