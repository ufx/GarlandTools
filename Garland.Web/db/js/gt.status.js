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
