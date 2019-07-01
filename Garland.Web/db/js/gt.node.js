gt.node = {
    pluralName: 'Gathering Nodes',
    type: 'node',   
    blockTemplate: null,
    index: {},
    partialIndex: {},
    version: 2,
    bonusIndex: null,
    limitedNodeUpdateKey: null,
    types: ['Mineral Deposit', 'Rocky Outcropping', 'Mature Tree', 'Lush Vegetation', 'Spearfishing'],
    jobAbbreviations: ['MIN', 'MIN', 'BTN', 'BTN', 'FSH'],
    browse: [
        { type: 'icon-list', prop: 'job' },
        { type: 'group', prop: 'region' },
        { type: 'header', prop: 'location' },
        { type: 'sort', func: gt.browse.transformLevelAndName }
    ],

    initialize: function(data) {
        gt.node.blockTemplate = doT.template($('#block-node-template').text());
    },

    cache: function(data) {
        gt.node.index[data.node.id] = data.node;
    },

    bindEvents: function($block, data, view) {
        if (!view.time)
            return;

        gt.display.notifications($block, data);

        if (!gt.node.limitedNodeUpdateKey)
            gt.node.limitedNodeUpdateKey = setInterval(gt.node.limitedNodeUpdate, 1000);
    },

    getViewModel: function(node, data) {
        if (!node) {
            console.error('Invalid node for view model.', data);
            return null;
        }

        var view = {
            id: node.id,
            type: 'node',
            name: node.name,
            patch: gt.formatPatch(node.patch),
            template: gt.node.blockTemplate,
            blockClass: node.time ? 'limited' : '',
            settings: 1,

            lvl: node.lvl,
            job: gt.node.jobAbbreviations[node.type],
            category: gt.node.types[node.type],
            limited: node.time ? 1 : 0,
            stars: node.stars,
            time: node.time,
            uptime: node.uptime,
            zone: gt.location.index[node.zoneid] || { name: 'Unknown' },
            coords: node.coords,
            obj: node
        };

        var typePrefix = node.limitType ? (node.limitType + ' ') : '';

        view.icon = 'images/' + view.category + '.png';
        view.subheader = "Level " + node.lvl + gt.util.stars(node.stars) + ' ' + typePrefix + view.category;

        var typePrefix = node.limitType ? node.limitType + ' ' : '';
        view.byline = 'Lv. ' + view.lvl + gt.util.stars(view.stars) + ' ' + typePrefix + view.category;
        view.category = typePrefix + view.category;

        if (node.bonus)
            view.bonus = _.filter(_.map(node.bonus, function(b) { return gt.node.bonusIndex[b]; }));

        view.sourceName = gt.util.abbr(view.zone.name) + ', Lv. ' + view.lvl;
        view.longSourceName = view.zone.name + ', Lv. ' + view.lvl;
        view.location = view.zone.name;
        var region = gt.location.index[view.zone.parentId];
        if (region)
            view.region = region.name;

        if (data) {
            if (node.coords) {
                view.map = gt.map.getViewModel({
                    location: view.zone, coords: node.coords, radius: node.radius, approx: node.radius ? 0 : 1,
                    icon: view.icon, iconfilter: 'sepia(100%)'
                });
            }

            view.items = gt.model.partialList(gt.item, node.items, function(v, i) { v.node_slot = i.slot; return v; });

            if (node.time)
                view.items = _.sortBy(view.items, function(i) { return i.node_slot || i.name; });
            else
                view.items = _.sortBy(view.items, function(i) { return i.name; });

            if (node.time) {
                view.audio = 1;
                view.timeText = _.map(node.time, gt.time.formatHours).join(', ');

                var info = gt.node.getSpawnInfo(view);
                view.nextSpawn = info.nextSpawn;
                view.spawnText = info.text;
                view.spawnState = info.state;
                view.progressStart = info.progressStart;
                view.progressEnd = info.progressEnd;
                view.initialProgressPercent = gt.time.getPercentTimeDifference(view.progressStart, view.progressEnd);
                view.initialSpawnRemaining = gt.node.checkSpawnRemainingTime(view, data);
            }

            if (node.unlockId)
                view.unlock = gt.model.partial(gt.item, node.unlockId);
        }

        return view;
    },

    getPartialViewModel: function(partial) {
        var name = gt.model.name(partial);
        var category = gt.node.types[partial.t];
        var typePrefix = partial.lt ? (partial.lt + ' ') : '';
        var zone = gt.location.index[partial.z] || { name: 'Unknown' };
        var region = gt.location.index[zone.parentId];

        return {
            id: partial.i,
            type: 'node',
            name: name,
            sourceName: gt.util.abbr(zone.name) + ', Lv. ' + partial.l,
            longSourceName: zone.name + ', Lv. ' + partial.l,
            byline: 'Lv. ' + partial.l + gt.util.stars(partial.s) + ' ' + typePrefix + category,
            icon: 'images/' + category + '.png',
            job: gt.node.jobAbbreviations[partial.t],
            zone: zone,
            location: zone.name,
            lvl: partial.l,
            region: region ? region.name : 'Unknown',
            limited: partial.ti ? 1 : 0,
            stars: partial.s,
            category: category
        };
    },

    resolveCraftSource: function(step, id) {
        var view = gt.model.partial(gt.node, id || step.item.nodes[0]);
        if (view) {
            step.sourceType = 'node';
            step.sourceView = view;
        }
        step.setCategory(['Gathering']);
    },

    limitedNodeUpdate: function() {
        var $blocks = $('.block.node.limited');
        if (!$blocks.length) {
            clearInterval(gt.node.limitedNodeUpdateKey);
            gt.node.limitedNodeUpdateKey = null;
            return;
        }

        var now = new Date();
        var epoch = now.getTime();

        _.each($blocks, function(block) {
            var $block = $(block);
            var $progress = $('.progress', $block);
            var view = $block.data('view');
            var data = $block.data('block');

            // Update spawn text
            var nextChange = $block.data('next-spawn-change');
            if (!nextChange || epoch >= nextChange) {
                var info = gt.node.getSpawnInfo(view);
                view.nextSpawn = info.nextSpawn;
                view.spawnState = info.state;
                view.progressStart = info.progressStart;
                view.progressEnd = info.progressEnd;

                $('.spawn-info', $block).text(info.text);
                $progress.removeClass('spawning active').addClass(info.state);
                $block.data('next-spawn-change', info.change.getTime() + 1001);
            }

            // Update the progress bar.
            var percent = gt.time.getPercentTimeDifference(view.progressStart, view.progressEnd);
            $progress.css('width', percent + '%');

            // Update the remaining time.
            $('.spawn-remaining', $block).text(gt.node.checkSpawnRemainingTime(view, data));
        });
    },

    checkSpawnRemainingTime: function(view, data) {
        var countdown = gt.time.formatCountdown(view.progressStart > view.progressEnd ? view.progressStart : view.progressEnd);
        if (data && data.alarms && view.spawnState == 'spawning') {
            var notify = false;
            if (countdown == '2:00') {
                notify = true;
                gt.display.playWarningAlarm();
            } else if (countdown == '0:01') {
                notify = true;
                gt.display.playAvailableAlarm();
            }

            if (notify && gt.settings.data.notifications)
                gt.node.notifyNode(view);
        }
        return countdown;
    },

    getSpawnTimes: function(eStart, times, uptime) {
        var eSpawn = new Date(eStart);
        eSpawn.setUTCDate(eSpawn.getUTCDate() - 2);
        eSpawn.setUTCMinutes(0);
        eSpawn.setUTCHours(0);
        eSpawn.setUTCSeconds(0);

        var eSpawnPrevious, eExpirePrevious;
        while (true) {
            for (var i = 0; i < times.length; i++) {
                eSpawn.setUTCHours(times[i]);
                var eExpire = new Date(eSpawn);
                eExpire.setUTCMinutes(uptime);

                if (eExpire > eStart) {
                    return { eSpawn: eSpawnPrevious, eExpire: eExpirePrevious, eNextSpawn: eSpawn, eNextExpire: eExpire  };
                } else {
                    eSpawnPrevious = new Date(eSpawn);
                    eExpirePrevious = new Date(eExpire);
                }
            }

            eSpawn.setUTCHours(0);
            eSpawn.setUTCDate(eSpawn.getUTCDate() + 1);
        }
    },

    getSpawnInfo: function(view) {
        var lCurrent = new Date();
        var eCurrent = gt.time.localToEorzea(lCurrent);

        // Calculate the current spawn, expiration, and record the next spawn time.
        var times = gt.node.getSpawnTimes(eCurrent, view.time, view.uptime);
        times.lNextSpawn = gt.time.eorzeaToLocal(times.eNextSpawn);
        times.lExpire = gt.time.eorzeaToLocal(times.eExpire);

        // Figure out the current state of the node.
        var info = { nextSpawn: times.lNextSpawn, progressStart: times.lExpire, progressEnd: times.lNextSpawn };
        var eorzeaMinutesDifference = (times.eNextSpawn.getTime() - eCurrent.getTime()) / 60000;

        if (eorzeaMinutesDifference > 0 && eorzeaMinutesDifference <= 120) {
            // Spawns within 2 hours.
            info.text = "Spawns at " + gt.time.formatTime(times.lNextSpawn);
            info.state = 'spawning';
            info.change = times.lNextSpawn;
        } else if (eorzeaMinutesDifference < 0 && eorzeaMinutesDifference > -view.uptime) {
            // Active for {uptime} minutes.
            var lNextExpire = gt.time.eorzeaToLocal(times.eNextExpire);
            info.text = "Active until " + gt.time.formatTime(lNextExpire);
            info.state = "active";
            info.change = lNextExpire;
            info.progressStart = lNextExpire;
            info.progressEnd = times.lNextSpawn;
        }  else {
            // Dormant until 2 hours before the next spawn.
            var eSpawning = new Date(times.eNextSpawn);
            eSpawning.setUTCHours(eSpawning.getUTCHours() - 2);

            info.text = "Spawns at " + gt.time.formatTime(times.lNextSpawn);
            info.state = 'dormant';
            info.change = gt.time.eorzeaToLocal(eSpawning);
        }

        return info;
    },

    sort: function(b) {
        if (b.type != 'node')
            return 'zzz ' + b.obj.name;

        var view = b.$block.data('view');

        if (!b.obj.limited)
            return 'azz ' + view.location + ' ' + view.lvl;

        var prefix = (view.spawnState == 'active') ? 'aaa ' : 'aaz ';
        return prefix + view.nextSpawn.getTime() + ' ' + view.location + ' ' + view.lvl;
    },

    notifyNode: function(view, data) {
        if (!window.Notification || window.Notification.permission != "granted")
            return;

        var stars = view.stars ? (' ' + gt.util.repeat('*', view.stars)) : '';
        var title = 'Lv. ' + view.lvl + stars + ' ' + view.name;
        var spawn = gt.time.formatTime(view.nextSpawn);
        var items = _.map(view.items, function(i) { return (i.node_slot ? '[' + i.node_slot + '] ' : '') + i.name; });
        gt.util.showNotification(title, {
            icon: view.items[0].icon,
            body: view.location + ' ' + spawn + '\r\n' + items.join(', '),
            tag: view.id
        });
    }
};

