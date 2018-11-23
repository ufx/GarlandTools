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
