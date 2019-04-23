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
            requireIcon: venture.gathering ? 'images/Gathering.png' : 'images/ilvl.png',
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
