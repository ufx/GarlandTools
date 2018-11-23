gt.leve = {
    pluralName: 'Leves',
    type: 'leve',
    index: {},
    partialIndex: {},
    rewardIndex: {},
    blockTemplate: null,
    version: 3,
    browse: [
        { type: 'icon-group', prop: 'jobCategory' },
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
            icon: 'images/Leve.png',
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
            view.gcIcon = 'images/' + gt.grandCompanies[leve.gc] + '.png';

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
            icon: 'images/Leve.png'
        };

        view.location = gt.location.index[partial.p].name;
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
        step.sourceView = { id: id, type: 'leve', name: 'Leve', sourceName: 'Leve', icon: 'images/Leve.png' };
        step.setCategory(['Leve', 'Other']);
    },
}
