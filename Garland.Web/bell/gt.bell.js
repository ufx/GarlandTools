gt = {
    countdownWarning: '1:00',
    countdownWarning2: '0:05',
    isTouchDevice: false,
    timerData: { },

    t: function(obj) {
        return gt.locale.translate(obj);
    },

    tw: function(str) {
        // So nasty
        var regex = /[a-zA-Z\s]+[a-zA-Z$]+/;
        var word = regex.exec(str)[0];
        var value = str.split(regex)[1];
        return gt.locale.translate(word) + value;
    }
};

gt.bell = {
    nodes: null,
    fish: null,
    bait: null,
    timers: null,
    timerMap: null,
    is24Hour: false,
    timeOffset: 0,
    isLive: window.location.hostname != 'localhost',
    //isLive: true,

    settings: {
        filters: ['.patch-2', '.patch-3', '.patch-4', '.fish', '.GATE', '.hunt'],
        lists: [],
        tone: 'alarm1',
        tone2: 'alarm2',
        volume: 50,
        volume2: 50,
        warning: 60,
        warning2: 3,
        mute: false,
        list: false,
        unlimitedColumns: true,
        compact: false,
        colorblind: false,
        search: '',
        serverTime: false,
        timeline: true,
        maps: true,
        rotations: false,
        rotationsFilter: 'stormblood',
        hidden: {},
        layout: 'block',
        hiddenWarnings: {},
        timersActive: true
    },
    timerElements: { },

    initialize: function() {
        try {
            if (window.Raven && gt.bell.isLive) {
                window.Raven.config('https://953f84152b6e41749c98236cb9e3f664@sentry.io/172375', {
                    environment: gt.bell.isLive ? 'prod' : 'dev'
                }).install();
            }

            if ('ontouchstart' in window) {
                    if (window.FastClick)
                        window.FastClick(document.body);
                gt.isTouchDevice = true;
                $('body').addClass('touch');
            }

            // Miscellany
            var sample = gt.time.formatTime(new Date());
            if (sample.indexOf('M') == -1)
                gt.bell.is24Hour = true;

            // Layout
            gt.layout.initialize();
            gt.layout.table.initialize();
            gt.layout.block.initialize();

            gt.bell.initializeDisplay();

            gt.timer.updateKey = setInterval(gt.timer.update, 1000);
        } catch (ex) {
            if (!gt.bell.retryLoad())
                throw ex;
        }
    },

    retryLoad: function() {
        try {
            // Force a server refresh once a day if errors encountered.
            var lastRetry = localStorage.bellRetry ? new Date(parseInt(localStorage.bellRetry)) : null;
            var now = new Date();
            if (lastRetry) {
                var diffDays = (now - lastRetry) / (1000 * 60 * 60 * 24);
                if (diffDays < 1)
                    return;
            }

            localStorage.bellRetry = now.getTime();
            window.location.reload(true);
            return true;
        } catch (ex) {
            // Ignore, fall back to error writing.
            console.error(ex);
        }

        return false;
    },

    preloadAudioTags: function() {
        if (!gt.bell.settings.mute) {
            try {
                if (gt.bell.settings.tone)
                    $('#' + gt.bell.settings.tone).attr("preload", "auto");
            
                if (gt.bell.settings.tone2)
                    $('#' + gt.bell.settings.tone2).attr("preload", "auto");
            } catch (ex) {
                // Primarily from IE.
                gt.bell.showWarning('preload-failed');
            }
        }
    },

    initializeDisplay: function() {
        // Main layout
        var mainTemplate = doT.template($('#main-template').text());
        $('body').html(mainTemplate());

        gt.bell.updateTime(new Date());

        // Settings
        var settings = gt.bell.loadSettings();

        // Timers
        var allTimers = _.union(gt.bell.nodes, gt.bell.fish, gt.bell.timers, gt.timerData.tripletriad);
        gt.bell.timerMap = _.reduce(allTimers, function(memo, t) { memo[t.id] = t; return memo; }, {});

        // Main container
        var mainList = { name: 'Timers', main: true, hidden: gt.bell.settings.timersHidden };
        var $mainList = $(gt.layout.engine.templates.timerList(mainList));
        $mainList.data('list', mainList);

        $('#timer-container').append($mainList);
        gt.layout.engine.setupList(mainList, $mainList);
            
        gt.bell.initializeStarred();
        gt.bell.reactivateTimers();

        gt.timeline.render();
        gt.map.render();

        // Event handlers
        $('#filters .filter').click(gt.bell.filterClicked);
        $('#alarm-toggle').click(gt.bell.alarmToggleClicked);
        $('#settings-toggle').click(gt.bell.settingToggleClicked);
        $('#mode-toggle').click(gt.bell.modeToggleClicked);
        $('#unlimited-columns-setting').click(gt.bell.unlimitedColumnsClicked);
        $('#compact-setting').click(gt.bell.compactSettingClicked);
        $('#colorblind-setting').click(gt.bell.colorblindSettingClicked);
        $('#servertime-setting').click(gt.bell.serverTimeSettingClicked);
        $('#volume').change(gt.bell.alarmVolumeChanged);
        $('#tone').change(gt.bell.alarmToneChanged);
        $('#warning').change(gt.bell.alarmWarningChanged);
        $('#volume2').change(gt.bell.alarmVolume2Changed);
        $('#tone2').change(gt.bell.alarmTone2Changed);
        $('#warning2').change(gt.bell.alarmWarning2Changed);
        $('#search').bind('input', gt.bell.searchInput);
        $('#timeline-header').click(gt.bell.timelineHeaderClicked);
        $('#maps-header').click(gt.bell.mapsHeaderClicked);
        $('#rotation-header').click(gt.bell.rotationsHeaderClicked);
        $('#rotations-filter .button').click(gt.bell.rotationsFilterClicked);
        $('#global-popover-overlay').click(gt.bell.dismissListPopover);
        $('#list-popover-check').click(gt.bell.listPopoverCheckClicked);
        $('#timer-remove-overlay').click(gt.bell.timerRemoveOverlayClicked);
        $('#warnings .dismiss-link').click(gt.bell.dismissWarningClicked);
        $('#lmain .header').click(gt.bell.timerListHeaderClicked);

        gt.bell.preloadAudioTags();
    },

    initializeStarred: function() {
        var now = gt.time.now();

        var lists = gt.bell.settings.lists;
        for (var i = 0; i < lists.length; i++)
            gt.bell.initializeStarredList(lists[i], now);
    },

    initializeStarredList: function(list, now) {
        var $timerList = $(gt.layout.engine.templates.timerList(list));
        $timerList.data('list', list);
        $('#lmain').before($timerList);

        gt.layout.engine.setupList(list, $timerList);

        var removedIds = [];
        for (var i = 0 ; i < list.timers.length; i++) {
            var def = gt.bell.timerMap[list.timers[i]];
            if (!def) {
                // Node probably removed.
                removedIds.push(list.timers[i]);
                continue;
            }

            def.isStarred = 1;
            gt.bell.activateTimer(def, now, list);
        }

        if (removedIds.length) {
            for (var i = 0; i < removedIds.length; i++)
                list.timers = _.without(list.timers, removedIds[i]);
        }

        gt.layout.engine.sort(list.name);

        $('.header', $timerList).click(gt.bell.timerListHeaderClicked);
    },

    reactivateTimers: function() {
        var now = gt.time.now();
        var filters = gt.bell.convertFilters(gt.bell.settings.filters);
        var mainList = { name: 'Timers', main: true }; // hack

        // Mark existing timers inactive.
        for (var key in gt.bell.timerElements)
            gt.bell.timerElements[key].active = 0;

        var allDefs = _.union(gt.bell.nodes, gt.bell.fish, gt.bell.timers, gt.timerData.tripletriad);
        var visibleCount = 0;
        for (var i = 0; i < allDefs.length; i++) {
            var def = allDefs[i];
            if (gt.bell.isFiltered(def, filters))
                continue;

            visibleCount++;
            gt.bell.activateTimer(def, now, mainList);
        }

        // Remove any inactive timers.
        for (var key in gt.bell.timerElements) {
            var info = gt.bell.timerElements[key];
            if (!info.active) {
                gt.layout.engine.remove(mainList, info.element);
                delete gt.bell.timerElements[key];
            }
        }

        // Arrange the new timers.
        gt.layout.engine.sort(mainList.name);

        // Stats
        var total = gt.bell.timers.length + gt.bell.fish.length + gt.bell.nodes.length;
        var hidden = total - visibleCount;
        var parts = [visibleCount + ' ' + gt.t('timers')];
        if (hidden > 0)
            parts.push(hidden + ' ' + gt.t('hidden'));
        var stats = parts.join(', ');
        $('#node-stats').text(stats);
    },

    convertFilters: function(filters) {
        var patches = [];
        if (!_.contains(filters, '.patch-2')) {
            patches.push('1');
            patches.push('2');
        }
        if (!_.contains(filters, '.patch-3'))
            patches.push('3');
        if (!_.contains(filters, '.patch-4'))
            patches.push('4');
        if (!_.contains(filters, '.patch-5'))
            patches.push('5');

        return {
            // Classes
            miner: !_.contains(filters, '.miner'),
            botanist: !_.contains(filters, '.botanist'),
            fish: !_.contains(filters, '.fish'),

            // Types
            unspoiled: !_.contains(filters, '.unspoiled'),
            ephemeral: !_.contains(filters, '.ephemeral'),
            legendary: !_.contains(filters, '.legendary'),

            // Tasks (inverted)
            reducibleOnly: _.contains(filters, '.reducible'),
            whitescripsOnly: _.contains(filters, '.whitescrips'),
            yellowscripsOnly: _.contains(filters, '.yellowscrips'),
            hiddenOnly: _.contains(filters, '.hidden'),

            // Other
            gate: !_.contains(filters, '.GATE'),
            hunt: !_.contains(filters, '.hunt'),
            patches: patches
        };
    },

    isFiltered: function(def, filters) {
        // Temporary hack until always-available stuff is working.
        if (def.func == 'fish' && !def.during && !def.weather)
            return true;

        // Search terms take precedence over other filters and hiding.
        var query = gt.bell.settings.search;
        if (query && query.length > 1) {
            // Check contained items.
            if (def.items) {
                if (_.find(def.items, function(i) { return i.item.toLowerCase().indexOf(query) != -1; }))
                    return false;
            }

            if (def.title && def.title.toLowerCase().indexOf(query) != -1)
                return false;
            if (def.name && def.name.toLowerCase().indexOf(query) != -1)
                return false;
            if (def.desc && def.desc.toLowerCase().indexOf(query) != -1)
                return false;
            if (def.zone && def.zone.toLowerCase().indexOf(query) != -1)
                return false;

            // Not found, filter out.
            return true;
        }

        // Hidden only overrides others.
        if (filters.hiddenOnly)
            return !gt.bell.settings.hidden[def.id];

        // Manually hidden timers.
        if (gt.bell.settings.hidden[def.id])
            return true;

        // Patch filtering.
        if (def.patch) {
            var patch = Number(def.patch).toFixed(1);
            if (!_.any(filters.patches, function(p) { return patch.indexOf(p) == 0; } ))
                return true;
        }

        // No search, proceed with normal filtering.
        if (def.func == 'node') {
            if (!filters.miner && (def.type == "Mineral Deposit" || def.type == "Rocky Outcropping"))
                return true;
            if (!filters.botanist && (def.type == "Lush Vegetation" || def.type == "Mature Tree"))
                return true;
            if (!filters.unspoiled && def.name == "Unspoiled")
                return true;
            if (!filters.ephemeral && def.name == "Ephemeral")
                return true;
            if (!filters.legendary && def.name == "Legendary")
                return true;
            if (filters.reducibleOnly && !_.any(def.items, function(i) { return i.reduce; }))
                return true;
            if (filters.whitescripsOnly && !_.any(def.items, function(i) { return i.scrip == "White Gatherers' Scrip"; }))
                return true;
            if (filters.yellowscripsOnly && !_.any(def.items, function(i) { return i.scrip == "Yellow Gatherers' Scrip"; }))
                return true;
        } else if (def.func == 'fish') {
            if (!filters.fish)
                return true;
            if (filters.reducibleOnly && !def.reduce)
                return true;
            if (filters.whitescripsOnly && def.scrip != "White Gatherers' Scrip")
                return true;
            if (filters.yellowscripsOnly && def.scrip != "Yellow Gatherers' Scrip")
                return true;
        } else if (def.func == 'hunt') {
            if (!filters.hunt)
                return true;
        } else if (def.func == 'GATE' || def.func == 'tripletriad') {
            if (!filters.gate)
                return true;
        }

        // Not filtered - visible.
        return false;
    },

    activateTimer: function(def, now, list) {
        if (list && list.main && gt.bell.timerElements[def.id]) {
            gt.bell.timerElements[def.id].active = true;
            return;
        }

        var timer = gt.bell.createTimer(def, now);
        timer.star = def.isStarred;
        timer.hidden = gt.bell.settings.hidden[def.id] ? 1 : 0;

        var $timer = $(gt.layout.engine.templates.timer(timer));
        $timer.data('view', timer);
        
        if (timer.progress)
            $timer.data('next-spawn-change', timer.progress.change.getTime() + 1001);

        if (list && list.main)
            gt.bell.timerElements[def.id] = { element: $timer, active: true };

        if (list)
            gt.layout.engine.append(list, $timer);

        $timer.click(gt.bell.timerClicked);

        return $timer;
    },

    createTimer: function(def, now) {
        var timer = new gt.timer[def.func](now, def);
        if (timer.isTimed) {
            for (var i = 0; i < 1000; i++) {
                // 1000 iterations is just a precaution, should break before that.
                if (!timer.next(now))
                    break;
            }

            timer.progress = gt.timer.progress(now, timer.period);
        }

        timer.title = def.title;
        timer.id = def.id;
        timer.desc = def.desc;
        timer.def = def;
        return timer;
    },

    updateTime: function(now) {
        var eNow = gt.time.localToEorzea(now);
        var currentEorzeaTime = gt.bell.formatHoursMinutesUTC(eNow);

        // Set time value.
        var timeElement = document.getElementById('time');
        if (timeElement)
            timeElement.innerText = currentEorzeaTime;

        // Set title.
        if (gt.layout.engine) {
            var soonestView = gt.layout.engine.getSoonestView();
            var title = currentEorzeaTime;
            if (soonestView && soonestView.progress) {
                var progress = soonestView.progress;
                title += ' [' + progress.countdown + (progress.state == "active" ? "+" : "") + ']';
            }

            var titleElement = document.getElementsByTagName('title')[0];
            if (titleElement)
                titleElement.innerText = title + ' Garland Bell';

            // Tick the timeline.
            gt.timeline.tick(eNow);
        }
    },

    formatHours: function(hour) {
        if (gt.bell.is24Hour)
            return hour;

        if (hour == 0)
            hour = 24;

        return ((hour - 1) % 12 + 1) + ' ' + (hour > 11 && hour < 24 ? 'PM' : 'AM');
    },

    formatHoursMinutesUTC: function(date) {
        var hours = date.getUTCHours();
        var minutes = gt.util.zeroPad(date.getUTCMinutes(), 2);

        if (gt.bell.is24Hour)
            return hours + ':' + minutes

        if (hours == 0)
            hours = 24;

        return ((hours - 1) % 12 + 1) + ':' + minutes + ' ' + (hours > 11 && hours < 24 ? 'PM' : 'AM');
    },

    filterClicked: function(e) {
        e.stopPropagation();

        var $this = $(this);

        // Handle exclusive tasks.
        var exclusiveTag = $this.data('exclusive');
        if (exclusiveTag && !$this.hasClass('active'))
            $('#filters .filter[data-exclusive=' + exclusiveTag + '].active').removeClass('active');

        $this.toggleClass('active');

        // Record filter state.
        var filters = _.map($('#filters .filter[data-invert=0]:not(.active)'), function(e) { return $(e).data('filter'); });
        var invertedFilters = _.map($('#filters .filter[data-invert=1].active'), function(e) { return $(e).data('filter'); });
        gt.bell.settings.filters = _.union(filters, invertedFilters);

        // Reactivate hidden timers if needed.
        if (gt.bell.settings.timersHidden)
            gt.bell.unhideMainList();

        gt.bell.reactivateTimers();
        gt.bell.saveSettings();

        return false;
    },

    unhideMainList: function() {
        gt.bell.settings.timersHidden = false;
        $('#lmain.timer-list').removeClass('hidden');
    },

    dismissListPopover: function(e) {
        if (e)
            e.stopPropagation();

        $('#list-popover, #global-popover-overlay').hide();
        return false;
    },

    listPopoverCheckClicked: function(e) {
        e.stopPropagation();

        var timerid = $('#list-popover-entries').data('id');

        var hidden = gt.bell.settings.hidden;
        if (hidden[timerid])
            delete hidden[timerid];
        else
            hidden[timerid] = 1;

        gt.bell.reactivateTimers();
        gt.bell.dismissListPopover();
        gt.bell.saveSettings();

        return false;
    },

    timerClicked: function(e) {
        if ($(e.target).closest('a').length)
            return true;

        e.stopPropagation();

        var $this = $(this);
        var $timer = $this.closest('.timer');
        var $main = $timer.closest('#lmain');
        if ($main.length || !$this.hasClass('star'))
            gt.bell.star($timer);
        else {
            var $overlay = $('#timer-remove-overlay');

            // Need special positioning for the table.
            if (gt.bell.settings.layout == 'table') {            
                var rect = $timer[0].getBoundingClientRect();
                var scrollTop = window.scrollY + (document.body.scrollTop == window.scrollY ? 0 : document.body.scrollTop);
                var scrollLeft = window.scrollX + (document.body.scrollLeft == window.scrollX ? 0 : document.body.scrollLeft);
                $overlay.css('top', (rect.top + scrollTop) + 'px');
                $overlay.css('left', (rect.left + scrollLeft) + 'px');
                $overlay.css('width', (rect.right - rect.left) + 'px');
                $overlay.css('height', (rect.bottom - rect.top) + 'px');
            }

            $timer.append($overlay);

            // Remove the overlay after 3 seconds.
            setTimeout(function() {
                if ($overlay.closest('.timer')[0] == $timer[0]) {
                    $('body').append($overlay);
                }
            }, 2000);
        }

        return false;
    },

    timerRemoveOverlayClicked: function(e) {
        e.stopPropagation();

        var $timer = $(this).closest('.timer');
        $('body').append($('#timer-remove-overlay'));
        gt.bell.unstar($timer);

        return false;
    },

    star: function($timer) {
        var view = $timer.data('view');
        var timerid = $timer.data('id');

        // Not starred.  Find the list to add this timer to.
        var $popover = $('#list-popover-entries');
        $popover.data('id', timerid);

        // Create the popover list entries, with a constant list for favorites.
        var entries = gt.bell.settings.lists.slice();
        if (!_.any(gt.bell.settings.lists, function(l) { return l.name == gt.t('Favorites'); }))
            entries.push({ name: gt.t('Favorites') });

        // Append entries with metadata.
        $popover.empty();
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var $entry = $(gt.layout.templates.listEntry(entry));
            $entry.data('listname', entry.name);
            $popover.append($entry);
        }

        $popover.append($('<div class="entry new">' + gt.t('Create new list') + '</div>'));

        // Create a timer block to display.
        var currentLayoutEngine = gt.layout.engine;
        gt.layout.engine = gt.layout.block;

        var timer = gt.bell.createTimer(view.def, gt.time.now());
        var $popoverTimer = $(gt.layout.block.templates.timer(timer));
        $popoverTimer.data('view', timer);
        if (timer.progress)
            $popoverTimer.data('next-spawn-change', timer.progress.change.getTime() + 1001);

        gt.layout.engine = currentLayoutEngine;

        // Show the popover.
        $('#list-popover-timer').empty().append($popoverTimer);
        $('#global-popover-overlay, #list-popover').show();

        // Bind events
        $('.entry', $popover).click(gt.bell.listEntryClicked);
    },

    unstar: function($timer) {
        if ($timer.closest('#lmain').length)
            return;
        
        var view = $timer.data('view');
        var timerid = $timer.data('id');

        var $containerList = $timer.closest('.timer-list');
        var list = $containerList.data('list');
        gt.layout.engine.remove(list, $timer);

        // Sort lists that still have some entries.
        if (list.timers.length)
            gt.layout.engine.sort(list.name);

        // Remove filled star from main list if this is the last one.
        var $otherTimers = $('.user-list .timer[data-id="' + timerid + '"]').not($timer);
        if (!$otherTimers.length) {
            view.def.isStarred = 0;
            $('#lmain .timer[data-id="' + timerid + '"]').removeClass('star');
        }

        gt.timeline.render();
        gt.map.render();

        gt.bell.saveSettings();
    },

    listEntryClicked: function(e) {
        e.stopPropagation();

        var $this = $(this);
        var timerid = $('#list-popover-entries').data('id');
        var def = gt.bell.timerMap[timerid];
        var now = gt.time.now();

        if ($this.hasClass('new')) {
            // Create new list for this timer.
            var name = prompt(gt.t("Name the new list"));
            if (!name)
                return false;

            if (name == 'Timers' || _.any(gt.bell.settings.lists, function(l) { return l.name == name; })) {
                alert('A list with this name already exists.');
                return false;
            }

            var list = { name: name, timers: [timerid], active: true };
            gt.bell.initializeStarredList(list, now);
            gt.bell.settings.lists.push(list);

            gt.bell.saveSettings();
        } else {
            // Add to the existing list.
            var listName = $this.data('listname');
            var list = _.find(gt.bell.settings.lists, function(l) { return l.name == listName; });

            // Special lists (Favorites) are created on the fly.
            if (!list) {
                list = { name: listName, timers: [], active: true };
                gt.bell.initializeStarredList(list, now);
                gt.bell.settings.lists.push(list);
            }

            if (!_.contains(list.timers, timerid)) {
                // Add only when the list doesn't already contain the timer.
                list.timers.push(timerid);

                def.isStarred = 1;
                gt.bell.activateTimer(def, now, list);
                gt.layout.engine.sort(list.name);

                gt.bell.saveSettings();
            }
        }

        gt.timeline.render();
        gt.map.render();

        if (window.Notification && window.Notification.permission != "granted")
            window.Notification.requestPermission();

        gt.bell.dismissListPopover();
        return false;
    },

    loadSettings: function() {
        var settings = gt.bell.settings;

        try {
            if (localStorage.bellSettings) {
                // Compat to be removed.
                if (!localStorage.bellSettings.locationDisplay)
                    settings = JSON.parse(localStorage.bellSettings);
            }
        } catch (ex) {
            // Ignore.  Can be caused by users blocking access to localStorage, and private browsing modes.
        }

        if (settings.favorites) {
            settings.lists = [{name: gt.t('Favorites'), timers: settings.favorites}];
            delete settings.favorites;
        }

        if (settings.filters) {
            for (var i = 0; i < settings.filters.length; i++)
                $('#filters .filter[data-filter="' + settings.filters[i] + '"]').toggleClass('active');
        }

        if (settings.mute)
            $('#alarm-toggle').removeClass('active');

        if (settings.tone)
            $('#tone').val(settings.tone);
        else
            settings.tone = 'alarm1';

        if (settings.volume)
            $('#volume').val(settings.volume);
        else
            settings.volume = 50;

        if (settings.warning === null || settings.warning === undefined)
            settings.warning = 60;

        gt.countdownWarning = settings.warning ? gt.time.formatHoursMinutesSeconds(settings.warning) : null;
        $('#warning').val(settings.warning);

        if (settings.tone2)
            $('#tone2').val(settings.tone2);
        else
            settings.tone2 = 'alarm2';

        if (settings.volume2)
            $('#volume2').val(settings.volume2);
        else
            settings.volume2 = 50;

        if (settings.warning2 === null || settings.warning2 === undefined)
            settings.warning2 = 5;

        gt.countdownWarning2 = settings.warning2 ? gt.time.formatHoursMinutesSeconds(settings.warning2) : null;
        $('#warning2').val(settings.warning2);

        if (settings.search)
            $('#search').val(settings.search);
            
        if (settings.timeline)
            $('#timeline, #timeline-header').addClass('active');

        if (settings.maps)
            $('#maps, #maps-header').addClass('active');

        if (settings.rotations)
            $('#rotations, #rotation-header').addClass('active');

        if (settings.unlimitedColumns) {
            $('#unlimited-columns-setting').prop('checked', true);
            $('body').addClass('unlimited-columns');
        }

        if (settings.compact) {
            $('#compact-setting').prop('checked', true);
            $('body').addClass('compact');
        }

        if (settings.colorblind) {
            $('#colorblind-setting').prop('checked', true);
            $('body').addClass('colorblind');
        }

        if (settings.serverTime) {
            $('#servertime-setting').prop('checked', true);
            gt.bell.getServerTime();
        }       

        if (!settings.hidden)
            settings.hidden = { };

        if (!settings.rotationsFilter)
            settings.rotationsFilter = 'stormblood';

        if (settings.rotationsFilter != 'stormblood') {
            $('#rotations .radio .option').removeClass('active');
            $('#rotations .radio .option.' + settings.rotationsFilter).addClass('active');
            $('#rotations .rotation').removeClass('active');
            $('#rotations .rotation.' + settings.rotationsFilter).addClass('active');
        }

        // Layout
        if (!settings.layout)
            settings.layout = 'block';

        if (settings.layout == 'table')
            $('#mode-toggle').addClass('active');

        $('#main-content').addClass(settings.layout + "-layout");

        gt.layout.engine = gt.layout[settings.layout];

        gt.bell.settings = settings;
        return settings;
    },

    saveSettings: function() {
        try {
            localStorage.bellSettings = JSON.stringify(gt.bell.settings);
        } catch (ex) {
            // Warn.  Can be caused by users blocking access to localStorage, and private browsing modes.
            gt.bell.showWarning('storage-blocked');
        }
    },

    alarmToggleClicked: function(e) {
        e.stopPropagation();

        $('#alarm-toggle').toggleClass('active');
        gt.bell.settings.mute = !gt.bell.settings.mute;
        if (!gt.bell.settings.mute)
            gt.bell.playAlarm();

        gt.bell.saveSettings();

        return false;
    },

    settingToggleClicked: function(e) {
        $('#settings').toggle();
        $('#settings-toggle').toggleClass('active');
    },
    
    timelineHeaderClicked: function(e) {
        gt.bell.settings.timeline = !gt.bell.settings.timeline;
        $('#timeline, #timeline-header').toggleClass('active');
        gt.bell.saveSettings();
    },

    mapsHeaderClicked: function(e) {
        if (gt.bell.settings.maps) {
            $('#maps').empty();
            gt.bell.settings.maps = false;
        } else {
            gt.bell.settings.maps = true;
            gt.map.render();
        }

        $('#maps-header').toggleClass('active');
        gt.bell.saveSettings();
    },

    rotationsHeaderClicked: function(e) {
        gt.bell.settings.rotations = !gt.bell.settings.rotations;
        $('#rotations, #rotation-header').toggleClass('active', gt.bell.settings.rotations);
        gt.bell.saveSettings();
    },

    rotationsFilterClicked: function(e) {
        e.stopPropagation();

        var $this = $(this);
        if ($this.hasClass('active'))
            return false;

        var $radio = $this.closest('.radio');
        $('.option', $radio).removeClass('active');
        $this.addClass('active');

        var filter = $this.data('filter');
        $('#rotations .rotation').removeClass('active');
        $('#rotations .rotation.' + filter).addClass('active');

        gt.bell.settings.rotationsFilter = filter;
        gt.bell.saveSettings();

        return false;
    },

    timerListHeaderClicked: function(e) {
        var $this = $(this);
        var $containerList = $this.closest('.timer-list');
        var isUserList = $containerList.hasClass('user-list');

        if (isUserList) {
            var list = $containerList.data('list');
            list.active = !list.active;

            $containerList.toggleClass('active', list.active);

            gt.timeline.render();
            gt.map.render();
        } else {
            gt.bell.settings.timersHidden = !gt.bell.settings.timersHidden;
            $containerList.toggleClass('hidden', gt.bell.settings.timersHidden);
        }

        gt.layout.engine.update();
        gt.bell.saveSettings();
    },

    modeToggleClicked: function(e) {
        $('#mode-toggle').toggleClass('active');

        var engine = gt.layout.engine;
        gt.layout.engine = null;
        engine.destroy();
        gt.bell.timerElements = { };

        if (gt.bell.settings.layout == 'block')
            gt.bell.settings.layout = 'table';
        else
            gt.bell.settings.layout = 'block';

        gt.bell.saveSettings();
        gt.bell.initializeDisplay();
    },

    unlimitedColumnsClicked: function(e) {
        gt.bell.settings.unlimitedColumns = $(this).is(':checked');
        $('body').toggleClass('unlimited-columns', gt.bell.settings.unlimitedColumns);
        gt.layout.engine.update();
        gt.bell.saveSettings();
    },

    compactSettingClicked: function(e) {
        gt.bell.settings.compact = $(this).is(':checked');
        $('body').toggleClass('compact', gt.bell.settings.compact);
        gt.layout.engine.update();
        gt.bell.saveSettings();
    },

    colorblindSettingClicked: function(e) {
        gt.bell.settings.colorblind = $(this).is(':checked');
        $('body').toggleClass('colorblind', gt.bell.settings.colorblind);
        gt.bell.saveSettings();
    },

    serverTimeSettingClicked: function(e) {
        gt.bell.settings.serverTime = $(this).is(':checked');
        gt.bell.saveSettings();

        if (gt.bell.settings.serverTime)
            gt.bell.getServerTime();
        else 
            gt.time.timeOffset = 0;
    },

    alarmVolumeChanged: function(e) {
        gt.bell.settings.volume = $(this).val();
        gt.bell.playAlarm();
        gt.bell.saveSettings();
    },

    alarmToneChanged: function(e) {
        gt.bell.settings.tone = $(this).val();
        gt.bell.playAlarm();
        gt.bell.saveSettings();
    },

    alarmWarningChanged: function(e) {
        gt.bell.settings.warning = Number($(this).val());
        gt.countdownWarning = gt.time.formatHoursMinutesSeconds(gt.bell.settings.warning);
        gt.bell.saveSettings();
    },

    alarmVolume2Changed: function(e) {
        gt.bell.settings.volume2 = $(this).val();
        gt.bell.playAlarm2();
        gt.bell.saveSettings();
    },

    alarmTone2Changed: function(e) {
        gt.bell.settings.tone2 = $(this).val();
        gt.bell.playAlarm2();
        gt.bell.saveSettings();
    },

    alarmWarning2Changed: function(e) {
        gt.bell.settings.warning2 = Number($(this).val());
        gt.countdownWarning2 = gt.time.formatHoursMinutesSeconds(gt.bell.settings.warning2);
        gt.bell.saveSettings();
    },

    playAlarm: function() {
        gt.bell.playAlarmTone(gt.bell.settings.tone, gt.bell.settings.volume);
    },

    playAlarm2: function() {
        gt.bell.playAlarmTone(gt.bell.settings.tone2, gt.bell.settings.volume2);
    },

    playAlarmTone: function(tone, volume) {
        var alarm = $('#' + tone)[0];
        if (!alarm)
            return;

        if (!volume || volume < 0)
            volume = 0;
        else if (volume > 100)
            volume = 100;

        try {
            alarm.volume = volume / 100;
            alarm.play();
        } catch (ex) {
            // Warn about blocked audio.
            gt.bell.showWarning('audio-blocked');
        }
    },

    searchInput: function(e) {
        if (gt.bell.settings.timersHidden)
            gt.bell.unhideMainList();

        gt.bell.executeSearch($(this).val().toLowerCase());
        gt.bell.saveSettings();
    },

    executeSearch: function(query) {
        gt.bell.settings.search = query;
        gt.bell.reactivateTimers();
    },

    tokenizeBait: function(baitList) {
        var tokens = [];
        var separateBait = false;
        for (var i = 0; i < baitList.length; i++) {
            var name = baitList[i];
            if (!name) {
                separateBait = false;
                tokens.push({comma: 1});
                continue;
            }

            var bait = gt.bell.bait[name];
            if (separateBait)
                tokens.push({arrow: 1});

            tokens.push(bait);
            separateBait = true;
        }
        return tokens;
    },

    getServerTime: function() {
        $.get('/api/time.php', function(result) {
            var date = new Date();
            gt.time.timeOffset = parseInt(result) - date.getTime();
        });
    },

    showNotification: function(title, options) {
        try {
            var n = new window.Notification(title, options);
            setTimeout(function() {
                try {
                    n.close();
                } catch (ex) {
                    // Ignore authorization errors, probably from the notification disappearing already.
                }
            }, 45 * 1000);
        } catch (ex) {
            // Ignore illegal constructor errors.
        }
    },

    showWarning: function(warning) {
        if (gt.bell.settings.hiddenWarnings && gt.bell.settings.hiddenWarnings[warning])
            return;

        $('#' + warning).show();
    },

    dismissWarningClicked: function(e) {
        e.stopPropagation();

        var $warning = $(this).parents('.warning');
        var id = $warning.attr('id');

        if (!gt.bell.settings.hiddenWarnings)
            gt.bell.settings.hiddenWarnings = {};
        gt.bell.settings.hiddenWarnings[id] = 1;
        gt.bell.saveSettings();

        $warning.hide();

        return false;
    }
};

// gt.layout.js

gt.layout = {
    engine: null,
    templates: { },

    initialize: function() {
        gt.layout.templates = {
            listEntry: doT.template($('#list-entry-template').text()),
            map: doT.template($('#page-map-template').text()),
            fishBait: doT.template($('#fish-bait-template').text())
        };
    }
};

gt.layout.block = {
    isotope: { },
    isotopeOptions: {
        layoutMode: 'masonry',
        itemSelector: '.timer',
        masonry: {
            gutter: 6,
            columnWidth: '.timer'
        },
        getSortData: {
            active: '[data-active]',
            time: '[data-time]'
        },
        sortBy: ['active', 'time'],
        sortAscending: {
            active: false,
            time: true
        },
        transitionDuration: '0.6s'
    },
    templates: { },

    initialize: function() {
        // Firefox isn't firing isotope transition end events, causing all kinds
        // of wackiness.  Disabled for now.
        if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1)
            gt.layout.block.isotopeOptions.transitionDuration = 0;

        gt.layout.block.templates = {
            timer: doT.template($('#timer-block-template').text()),
            timerList: doT.template($('#timer-list-block-template').text()),
            nodeContent: doT.template($('#node-content-block-template').text()),
            fishContent: doT.template($('#fish-content-block-template').text()),
            fishEntry: doT.template($('#fish-entry-block-template').text()),
            huntContent: doT.template($('#hunt-content-block-template').text())
        };
    },

    destroy: function() {
        for (var key in gt.layout.block.isotope) {
            var isotope = gt.layout.block.isotope[key];
            isotope.destroy();
        }

        gt.layout.block.isotope = { };
    },

    setupList: function(list, $list) {
        var $nodeList = $('.node-list', $list);
        var isotope = new Isotope($nodeList[0], gt.layout.block.isotopeOptions);
        gt.layout.block.isotope[list.name] = isotope;
    },

    sort: function(listName, noAnimation) {
        var isotope = gt.layout.block.isotope[listName];

        if (noAnimation) {
            isotope.options.transitionDuration = 0;
            isotope.arrange();
            isotope.options.transitionDuration = gt.layout.block.isotopeOptions.transitionDuration;
        } else
            isotope.arrange();

    },

    update: function() {
        for (var key in gt.layout.block.isotope) {
            var isotope = gt.layout.block.isotope[key];

            for (var i = 0; i < isotope.filteredItems.length; i++) {
                var $timer = $(isotope.filteredItems[i].element);
                gt.layout.block.setHeight($timer);
            }

            isotope.updateSortData();
            isotope.arrange();
        }
    },

    setHeight: function($timer) {
        $timer.removeClass('small medium large xlarge');

        var step = gt.bell.settings.compact ? 95 : 135;
        var height = $timer[0].scrollHeight;
        var size = Math.ceil(height / step);

        switch (size) {
            case 1: $timer.addClass('small'); break;
            case 2: $timer.addClass('medium'); break;
            case 3: $timer.addClass('large'); break;
            default: $timer.addClass('xlarge'); break;
        }
    },

    calcStepCss: function() {
        gt.layout.block.calcStepCssCore(135);
        gt.layout.block.calcStepCssCore(95, 'compact');
    },

    calcStepCssCore: function(step, bodyClass) {
        var step = 135;
        var margin = 6;

        var sizes = [];
        for (var i = 1; i <= 4; i++) {
            var height = i * step;
            height += (i - 1) * margin;
            sizes.push(height);
        }

        var prefix = bodyClass ? "body." + bodyClass + " " : "";

        var rules = [];
        rules.push(prefix + '.block-layout .timer.small { height: ' + sizes[0] + 'px; }');
        rules.push(prefix + '.block-layout .timer.medium { height: ' + sizes[1] + 'px; }');
        rules.push(prefix + '.block-layout .timer.large { height: ' + sizes[2] + 'px; }');
        rules.push(prefix + '.block-layout .timer.xlarge { height: ' + sizes[3] + 'px; overflow-y: auto; overflow-x: hidden; }');
        console.log(rules.join("\n"));
    },

    append: function(list, $timer) {
        var isotope = gt.layout.block.isotope[list.name];
        isotope.$element.append($timer);
        isotope.addItems($timer);

        gt.layout.block.setHeight($timer);
    },

    remove: function(list, timerElement) {
        var $timer = $(timerElement);
        var $containerList = $timer.closest('.timer-list');

        var isotope = gt.layout.block.isotope[list.name];
        isotope.remove(timerElement);

        if (list.timers) {
            var timerid = $timer.data('id');
            list.timers = _.without(list.timers, timerid);
            
            if (!list.timers.length && !list.main) {
                $containerList.remove();
                isotope.destroy();
                delete gt.layout.block.isotope[list.name];
                gt.bell.settings.lists = _.without(gt.bell.settings.lists, list);
            }
        }
    },

    getDisplayedElements: function(list) {
        return _.map(gt.layout.block.isotope[list.name].filteredItems, function(i) { return i.element; });
    },

    getSoonestView: function() {
        var soonestItem = null;
        for (var i = 0; i < gt.bell.settings.lists.length; i++) {
            var list = gt.bell.settings.lists[i];
            if (!list.active)
                continue;

            var isotope = gt.layout.block.isotope[list.name];
            var item = isotope.filteredItems[0];
            if (item && (soonestItem == null || item.sortData.time < soonestItem.sortData.time))
                soonestItem = item;
        }

        return soonestItem ? $(soonestItem.element).data('view') : null;
    },

    updateSpawnTime: function(view, $timer) {
        $('.spawn-time', $timer).text(view.progress.countdown + ' / ' + view.progress.time);
    }
};

gt.layout.table = {
    tables: { },
    templates: { },

    initialize: function() {
        gt.layout.table.templates = {
            timer: doT.template($('#timer-table-template').text()),
            timerList: doT.template($('#timer-list-table-template').text()),
            nodeContent: doT.template($('#node-content-table-template').text()),
            fishContent: doT.template($('#fish-content-table-template').text()),
            huntContent: doT.template($('#hunt-content-table-template').text())
        };

        gt.layout.engine = gt.layout.table;
    },

    destroy: function() {
        gt.layout.table.tables = { };
    },

    setupList: function(list, $list) {
        var table = {
            $element: $list.is('.node-list') ? $list : $('.node-list', $list)
        };

        gt.layout.table.tables[list.name] = table;
    },

    sort: function(listName) {
        // Un-jquery'd for performance.
        var table = gt.layout.table.tables[listName];
        var $timers = $('.timer', table.$element);
        $timers.sort(gt.layout.table.compareElementTime);

        var elem = table.$element[0];
        for (var i = 0; i < $timers.length; i++)
            elem.appendChild($timers[i]);
    },

    compareElementTime: function(a, b) {
        var view1 = $(a).data('view');
        var view2 = $(b).data('view');

        if (!view1.isTimed || !view2.isTimed) {
            if (view1.isTimed && !view2.isTimed)
                return 1;
            else if (view2.isTimed && !view1.isTimed)
                return -1;

            return view1.title > view2.title ? 1 : view1.title < view2.title ? -1 : 0;
        }

        var time1 = view1.progress.state == 'active' ? view1.progress.start.getTime() : view1.progress.end.getTime();
        var time2 = view2.progress.state == 'active' ? view2.progress.start.getTime() : view2.progress.end.getTime();

        if (view1.progress.state == 'active' && view2.progress.state != 'active')
            return -1;
        if (view2.progress.state == 'active' && view1.progress.state != 'active')
            return 1;

        if (time1 > time2)
            return 1;
        if (time1 < time2)
            return -1;

        return view1.id > view2.id ? 1 : view1.id < view2.id ? -1 : 0;
    },

    update: function() {
        for (var key in gt.layout.table.tables)
            gt.layout.table.sort(key);
    },

    append: function(list, $timer) {
        var table = gt.layout.table.tables[list.name];
        table.$element.append($timer);
    },

    remove: function(list, timerElement) {
        var $timer = $(timerElement);
        var timerid = $timer.data('id');

        if (list.timers) {
            list.timers = _.without(list.timers, timerid);

            if (!list.timers.length && !list.main) {
                var $containerList = $timer.closest('.timer-list');
                $containerList.remove();
                delete gt.layout.table.tables[list.name];
                gt.bell.settings.lists = _.without(gt.bell.settings.lists, list);
                return;
            }
        }

        $timer.remove();
    },

    getDisplayedElements: function(list) {
        var table = gt.layout.table.tables[list.name];
        return $('.timer', table.$element);
    },

    getSoonestView: function() {
        var soonestElement;
        for (var i = 0; i < gt.bell.settings.lists.length; i++) {
            var list = gt.bell.settings.lists[i];
            if (!list.active)
                continue;

            var table = gt.layout.table.tables[list.name];
            var $elements = $('.timer', table.$element);
            for (var ii = 0; ii < $elements.length; ii++) {
                var element = $elements[ii];
                if (!$(element).data('view').isTimed)
                    continue;

                if (soonestElement == null || gt.layout.table.compareElementTime(element, soonestElement) == -1)
                    soonestElement = element;
            }
        }

        return soonestElement ? $(soonestElement).data('view') : null;
    },

    updateSpawnTime: function(view, $timer) {
        // Un-jquery'd for performance.
        var $countdown = $('.countdown', $timer);
        for (var i = 0; i < $countdown.length; i++)
            $countdown[i].innerText = view.progress.countdown;

        var $spawntime = $('.spawn-time', $timer);
        for (var i = 0; i < $spawntime.length; i++)
            $spawntime[i].innerText = view.progress.time;
    }
};

// gt.timer.js

gt.timer = {
    updateKey: null,

    baseline: function(current, daysBack) {
        var start = new Date(current);
        start.setUTCDate(start.getUTCDate() - daysBack);
        start.setUTCMinutes(0);
        start.setUTCHours(0);
        start.setUTCSeconds(0);
        return start;
    },

    progress: function(current, period) {
        // Start from a position of dormancy.
        var progress = {
            start: period.lastExpire,
            end: period.active,
            change: period.active,
            percent: null,
            time: null,
            countdown: null,
            sort: period.active.getTime()
        };

        var minutesDiff = (period.active.getTime() - current.getTime()) / 60000;
        if (minutesDiff > 0 && minutesDiff <= 5) {
            // Active within 5 minutes.
            progress.state = 'spawning';
            progress.time = gt.time.formatTime(gt.time.removeOffset(progress.change));
        } else if (minutesDiff < 0 && minutesDiff > -period.mUp) {
            // Active for {mUp} minutes.
            progress.state = 'active';
            progress.start  = period.expire;
            progress.end = period.active;
            progress.change = period.expire;
            progress.sort = period.expire.getTime();
            progress.time = gt.time.formatTime(gt.time.removeOffset(period.expire));
        } else {
            // Dormant until 5 minutes before the next spawn.
            var spawning = new Date(period.active);
            spawning.setUTCMinutes(spawning.getUTCMinutes() - 5);
            progress.state = 'dormant';
            progress.change = spawning;

            if (minutesDiff >= 1440)
                progress.time = gt.time.formatDateTime(gt.time.removeOffset(period.active));
            else
                progress.time = gt.time.formatTime(gt.time.removeOffset(period.active));
        }

        progress.percent = gt.time.getPercentTimeDifference(progress.start, progress.end);
        progress.countdown = gt.time.formatCountdown(progress.start > progress.end ? progress.start : progress.end);

        return progress;
    },

    update: function() {
        var now = gt.time.now();
        var epoch = now.getTime();
        var update = false;
        var starUpdate = false;

        _.each($('.timer'), function(element) {
            var $timer = $(element);
            var view = $timer.data('view');

            // No need to update untimed views.
            if (!view || !view.isTimed)
                return;

            // Update progress
            var nextChange = $timer.data('next-spawn-change');
            if (epoch >= nextChange) {
                view.next(now);
                view.progress = gt.timer.progress(now, view.period);

                $timer.removeClass('spawning active dormant').addClass(view.progress.state);
                $timer.data('next-spawn-change', view.progress.change.getTime() + 1001);
                $timer.attr('data-time', view.progress.sort);
                $timer.attr('data-active', view.progress.state == 'active' ? 1 : 0);
                update = true;

                if (!starUpdate && $timer.hasClass('star'))
                    starUpdate = true;
            }

            // Update the progress bar.
            view.progress.percent = gt.time.getPercentTimeDifference(view.progress.start, view.progress.end);
            $('.progress', $timer).css('width', view.progress.percent + '%');

            // Update the remaining time.
            view.progress.countdown = gt.time.formatCountdown(view.progress.start > view.progress.end ? view.progress.start : view.progress.end);
            gt.layout.engine.updateSpawnTime(view, $timer);

            // Play an alarm if spawning node is a favorite.
            if (view.progress.state == 'spawning' && (view.progress.countdown === gt.countdownWarning || view.progress.countdown === gt.countdownWarning2)) {
                if (!gt.bell.settings.mute && $timer.closest('.timer-list.active').length) {
                    if (view.progress.countdown === gt.countdownWarning)
                        gt.bell.playAlarm();
                    else
                        gt.bell.playAlarm2();

                    if (window.Notification && window.Notification.permission == "granted")
                        view.notify();
                }
            }
        });

        gt.bell.updateTime(now);

        if (update)
            gt.layout.engine.update();

        if (starUpdate)
            gt.map.render();
    }
};

// gt.timer.tripletriad

gt.timer.tripletriad = function(now, def) {
    this.type = 'tripletriad';
    this.def = def;
    //this.contentTemplate = gt.layout.engine.templates.tripletriadContent;
    this.icon = '../db/images/TripleTriad.png';
    this.zone = def.zone;
    this.timeText = gt.bell.formatHours(def.during.start) + " - " + gt.bell.formatHours(def.during.end);
    this.typeIcon = 'icons/GoldSaucer.png';
    this.isTimed = true;

    if (def.rules)
        this.conditions = def.rules.join(', ');

    if (def.zone && def.coords)
        this.map = gt.map.getViewModel(def.zone, def.coords);

    var eNow = gt.time.localToEorzea(now);
    var hUp = (24 + def.during.end - def.during.start) % 24;

    var active = new Date(eNow);
    active.setUTCMinutes(0);
    active.setUTCSeconds(0);
    active.setUTCHours(def.during.start);

    var expire = new Date(active);
    expire.setUTCHours(def.during.start + hUp);

    var lastExpire = new Date(expire);
    lastExpire.setUTCDate(lastExpire.getUTCDate() - 1);

    this.period = {
        active: gt.time.eorzeaToLocal(active),
        expire: gt.time.eorzeaToLocal(expire),
        lastExpire: gt.time.eorzeaToLocal(lastExpire),
        mUp: hUp * 60
    };

    this.next(now);
};

gt.timer.tripletriad.prototype.next = function(now) {
    if (this.period && this.period.expire > now)
        return false; // No period changes if this one hasn't expired yet.

    var expire = gt.time.localToEorzea(this.period.expire);
    expire.setUTCDate(expire.getUTCDate() + 1);

    var active = gt.time.localToEorzea(this.period.active);
    active.setUTCDate(active.getUTCDate() + 1);

    this.period.lastExpire = this.period.expire;
    this.period.expire = gt.time.eorzeaToLocal(expire);
    this.period.active = gt.time.eorzeaToLocal(active);
};

gt.timer.tripletriad.prototype.notify = function(now) {
    gt.bell.showNotification(this.title, {
        icon: this.icon,
        body: this.desc + '\r\n' + this.progress.time + '\r\n',
        tag: this.id
    });
};

// gt.timer.GATE

gt.timer.GATE = function(now, def) {
    var active = gt.timer.baseline(now, 0);
    active.setUTCMinutes(def.minute);

    var expire = new Date(active);
    expire.setUTCMinutes(def.minute + def.uptime);

    var lastExpire = new Date(expire);
    lastExpire.setUTCHours(lastExpire.getUTCHours() - 1);

    // Members
    this.period = { active: active, expire: expire, lastExpire: lastExpire, mUp: def.uptime };
    this.progress = null;
    this.type = 'GATE';
    this.title = null;
    this.desc = null;
    this.zone = 'Gold Saucer';
    this.icon = 'icons/GATE.png';
    this.tooltip = def.title;
    this.typeIcon = 'icons/GoldSaucer.png';
    this.isTimed = true;
};

gt.timer.GATE.prototype.next = function(now) {
    if (this.period.expire > now)
        return false; // No period changes if this one hasn't expired yet.

    this.period.lastExpire = this.period.expire;
    this.period.expire = new Date(this.period.expire);
    this.period.expire.setUTCHours(this.period.expire.getUTCHours() + 1);
    this.period.active.setUTCHours(this.period.active.getUTCHours() + 1);

    return true;
};

gt.timer.GATE.prototype.notify = function() {
    gt.bell.showNotification(this.title, {
        icon: this.icon,
        body: this.desc + '\r\n' + this.progress.time + '\r\n',
        tag: this.id
    });
};

// gt.timer.hunt

gt.timer.hunt = function(now, def) {
    this.progress = null;
    this.period = null;
    this.type = 'hunt';
    this.def = def;
    this.contentTemplate = gt.layout.engine.templates.huntContent;
    this.icon = 'icons/' + def.name + '.png';
    this.tooltip = def.name;
    this.cooldown = def.cooldown + 'h CD (maint. ' + def.maintenanceCooldown + 'h)';
    this.typeIcon = 'icons/Hunt.png';
    this.isTimed = true;
    def.zone = def.title;

    if (def.fish)
        this.fish = new gt.timer.fish(0, def.fish);

    // Calculate initial period.
    var lStart = new Date(now);
    lStart.setUTCHours(lStart.getUTCHours() - 8);
    this.next(lStart);
};

gt.timer.hunt.prototype.next = function(now) {
    if (this.period && this.period.expire > now)
        return false; // No period changes if this one hasn't expired yet.

    if (this.def.weather)
        gt.skywatcher.calculateNextPeriod(this, now);
    else if (this.def.fish)
        gt.skywatcher.calculateNextPeriod(this, now);
    else if (this.def.moon) {
        var active = gt.skywatcher.nextMoonPhase(gt.time.localToEorzea(now), this.def.moon.phase, this.def.moon.offset);

        var expire = new Date(active);
        expire.setUTCHours((expire.getUTCHours()- this.def.moon.offset) + 96);

        this.period = {
            active: gt.time.eorzeaToLocal(active),
            expire: gt.time.eorzeaToLocal(expire),
            lastExpire: this.period ? this.period.expire : now
        };
    } else if (this.def.time) {
        var spawnTimes = gt.time.getSpawnTimes(gt.time.localToEorzea(now), this.def.time, this.def.uptime);

        this.period = {
            active: gt.time.eorzeaToLocal(spawnTimes.eNextSpawn),
            expire: gt.time.eorzeaToLocal(spawnTimes.eNextExpire),
            lastExpire: gt.time.eorzeaToLocal(spawnTimes.eExpire),
            mUp: this.uptime / gt.time.epochTimeFactor
        };
    } else if (this.def.name == "The Garlok") {
        this.period = { lastExpire: this.period ? this.period.expire : now };

        var period = this.period;
        var eStart = gt.skywatcher.getWeatherInterval(gt.time.localToEorzea(now));
        var eSpawnTicks = null;
        var lSpawnTime = null;
        var findExpiration = false;
        gt.skywatcher.iterateWeather(eStart, this.def.zone, this.def.name, function(weather, transitionWeather, eTime) {
            if (eSpawnTicks && eSpawnTicks < eTime.getTime()) {
                // This spawn time was accurate.
                findExpiration = true;
            }

            if (weather == "Rain" || weather == "Showers") {
                if (findExpiration) {
                    period.expire = gt.time.eorzeaToLocal(eTime);
                    return true;
                }

                var eCurrent = new Date(eTime);
                eCurrent.setUTCHours(eTime.getUTCHours() + 8);
                period.active = gt.time.eorzeaToLocal(eCurrent);
                period.active.setUTCMinutes(period.active.getUTCMinutes() + 200);
                eSpawnTicks = gt.time.localToEorzea(period.active).getTime();
            }
        });
    }

    this.period.mUp = (this.period.expire - this.period.active) / 60000;
    return true;
};

gt.timer.hunt.prototype.notify = function() {
    gt.bell.showNotification(this.title, {
        icon: this.icon,
        body: this.def.name + '\r\n' + this.progress.time + '\r\n',
        tag: this.id
    });
};

// gt.timer.fish

gt.timer.fish = function(now, def) {
    this.progress = null;
    this.period = null;
    this.type = 'fish';
    this.def = def;
    this.contentTemplate = gt.layout.engine.templates.fishContent;
    this.icon = '../files/icons/item/' + def.icon + '.png';
    this.typeIcon = '../files/icons/job/FSH.png';
    this.tooltip = def.name;
    this.title = def.title;
    this.isTimed = def.during || def.weather;

    if (def.zone && def.coords)
        this.map = gt.map.getViewModel(def.zone, def.coords);

    def.baitTokens = gt.bell.tokenizeBait(def.bait);

    if (def.predator) {
        this.predator = [];
        for (var i = 0; i < def.predator.length; i++) {
            var pred = def.predator[i];
            pred.zone = def.zone; // hacks to remove
            pred.title = def.title;
            var predatorTimer = new gt.timer.fish(0, pred);
            predatorTimer.title = def.title;
            predatorTimer.id = pred.id;
            this.predator.push(predatorTimer);
        }
    }

    // Calculate initial period.
    if (this.isTimed && now) {
        var lStart = new Date(now);
        lStart.setUTCHours(lStart.getUTCHours() - 8);
        this.next(lStart);
    }
};

gt.timer.fish.prototype.next = function(now) {
    if (this.period && this.period.expire > now)
        return false; // No period changes if this one hasn't expired yet.

    gt.skywatcher.calculateNextPeriod(this, now);
    return this.period ? true : false;
};

gt.timer.fish.prototype.notify = function() {
    var stars = this.def.stars ? (' ' + gt.util.repeat('*', this.def.stars)) : '';
    var spot = 'Lv. ' + this.def.lvl + stars + ' ' + this.def.category;
    var bait = this.def.bait.join(' -> ');

    gt.bell.showNotification(this.def.name, {
        icon: this.icon,
        body: this.def.title + ', ' + this.def.zone + '\r\n' + spot + ' @ ' + this.progress.time + '\r\n' + bait,
        tag: this.id
    });
};

// gt.timer.node

gt.timer.node = function(now, def) {
    this.node = def;
    this.progress = null;
    this.type = 'node';
    this.contentTemplate = gt.layout.engine.templates.nodeContent;
    this.icon = '../files/icons/item/' + def.items[0].icon + '.png';
    this.tooltip = def.items[0].item;
    this.zone = def.zone;
    this.isTimed = true;

    if (def.zone && def.coords)
        this.map = gt.map.getViewModel(def.zone, def.coords);

    if (def.condition) {
        this.condition = gt.tw(def.condition);
        this.conditionAbbr = this.condition.replace(' < ', ' ');
    }
    if (def.bonus)
        this.bonus = gt.tw(def.bonus);

    if (def.type == 'Mature Tree' || def.type == 'Lush Vegetation') {
        this.requiredClass = 'botanist';
        this.typeIcon = '../files/icons/job/BTN.png';
    }
    else {
        this.requiredClass = 'miner';
        this.typeIcon = '../files/icons/job/MIN.png';
    }

    this.timeText = _.map(def.time, function(t) {
        return gt.bell.formatHours(t);
    }).join(', ');

    // Calculate initial period.
    this.mUp = def.uptime / gt.time.epochTimeFactor;
    this.next(now); // fixme remove, unnecessary
};

gt.timer.node.prototype.next = function(now) {
    if (this.period && this.period.expire > now)
        return false; // No period changes if this one hasn't expired yet.

    var nextPeriod = this.getPeriod(gt.time.localToEorzea(now));
    if (!this.period) {
        var lastActive = gt.time.localToEorzea(nextPeriod.lastExpire);
        lastActive.setUTCMinutes(lastActive.getUTCMinutes() - this.mUp);
        this.lastPeriod = this.getPeriod(lastActive);
    } else
        this.lastPeriod = this.period;

    this.period = nextPeriod;
    return true;
};

gt.timer.node.prototype.getPeriod = function(from) {
    var spawnTimes = gt.time.getSpawnTimes(from, this.node.time, this.node.uptime);

    return {
        active: gt.time.eorzeaToLocal(spawnTimes.eNextSpawn),
        expire: gt.time.eorzeaToLocal(spawnTimes.eNextExpire),
        lastExpire: gt.time.eorzeaToLocal(spawnTimes.eExpire),
        mUp: this.mUp
    };

};

gt.timer.node.prototype.notify = function() {
    var stars = this.node.stars ? (' ' + gt.util.repeat('*', this.node.stars)) : '';
    var title = 'Lv. ' + this.node.lvl + stars + ' ' + this.title;
    var items = _.map(this.node.items, function(i) { return (i.slot ? '[' + i.slot + '] ' : '') + i.item; });
    gt.bell.showNotification(title, {
        icon: this.icon,
        body: this.node.zone + ' ' + this.progress.time + '\r\n' + items.join(', '),
        tag: this.id
    });
};

// gt.time.js

gt.time = {
    epochTimeFactor: 20.571428571428573, // 60 * 24 Eorzean minutes (one day) per 70 real-world minutes.
    millisecondsPerEorzeaMinute: (2 + 11/12) * 1000,
    millisecondsPerDay: 24 * 60 * 60 * 1000,
    monthDay: {month: 'numeric', day: 'numeric'},
    timeOffset: 0,

    localToEorzea: function(date) {
        return new Date(date.getTime() * gt.time.epochTimeFactor);
    },

    eorzeaToLocal: function(date) {
        return new Date(date.getTime() / gt.time.epochTimeFactor);
    },

    eCurrentTime: function() {
        return gt.time.localToEorzea(gt.time.now());
    },

    formatTime: function(date, options) {
        if (options) // Optimization: Chrome slow path.
            return date.toLocaleTimeString(navigator.language || "en-US", options);
        return date.toLocaleTimeString();
    },

    formatDateTime: function(date) {
        if (!date)
            return '(error)';
        
        return date.toLocaleDateString(navigator.language || "en-US", gt.time.monthDay) + ' ' + gt.time.formatTime(date);
    },

    formatEorzeaHour: function(eDate) {
        return gt.util.zeroPad(eDate.getUTCHours(), 2);
    },

    getPercentTimeDifference: function(start, end) {
        var start = start.getTime();
        var end = end.getTime();
        var now = (gt.time.now()).getTime();
        return ((now - start) / (end - start)) * 100;
    },

    formatCountdown: function(end) {
        var remainingSeconds = (end.getTime() - (gt.time.now()).getTime()) / 1000;
        if (remainingSeconds <= 0)
            return '0:00';

        if (remainingSeconds > 60 * 3)
            return gt.time.formatHoursMinutes(remainingSeconds);

        return gt.time.formatHoursMinutesSeconds(remainingSeconds);
    },

    formatHoursMinutes: function(totalSeconds) {
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);

        if (hours)  
            return hours + 'h ' + gt.util.zeroPad(minutes, 2) + 'm';
        else
            return minutes + 'm';
    },

    formatHoursMinutesSeconds: function(totalSeconds) {
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = Math.floor((totalSeconds % 3600) % 60);

        if (hours)  
            return hours + ':' + gt.util.zeroPad(minutes, 2) + ':' + gt.util.zeroPad(seconds, 2);
        else
            return minutes + ':' + gt.util.zeroPad(seconds, 2);
    },

    now: function() {
        var date = new Date();
        if (gt.time.timeOffset)
            date.setTime(date.getTime() + gt.time.timeOffset);
        return date;
    },

    removeOffset: function(offsetDate) {
        if (!gt.time.timeOffset)
            return offsetDate;

        var date = new Date(offsetDate);
        date.setTime(date.getTime() - gt.time.timeOffset);
        return date;
    },

    getSpawnTimes: function(eStart, time, uptime) {
        var eSpawn = new Date(eStart);
        eSpawn.setUTCDate(eSpawn.getUTCDate() - 2);
        eSpawn.setUTCMinutes(0);
        eSpawn.setUTCHours(0);
        eSpawn.setUTCSeconds(0);

        var eSpawnPrevious, eExpirePrevious;
        while (true) {
            for (var i = 0; i < time.length; i++) {
                eSpawn.setUTCHours(time[i]);
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
    }
};

// gt.skywatcher.js

gt.skywatcher = {
    weatherIndex: ["","Clear Skies","Fair Skies","Clouds","Fog","Wind","Gales","Rain","Showers","Thunder","Thunderstorms","Dust Storms","Sandstorms","Hot Spells","Heat Waves","Snow","Blizzards","Gloom","Auroras","Darkness","Tension","Clouds","Storm Clouds","Rough Seas","Rough Seas","Louring","Heat Waves","Gloom","Gales","Eruptions","Fair Skies","Fair Skies","Fair Skies","Fair Skies","Fair Skies","Irradiance","Core Radiation","Core Radiation","Core Radiation","Core Radiation","Shelf Clouds","Shelf Clouds","Shelf Clouds","Shelf Clouds","Oppression","Oppression","Oppression","Oppression","Oppression","Umbral Wind","Umbral Static","Smoke","Fair Skies","Royal Levin","Hyperelectricity","Royal Levin"],
    zoneWeather: {"Limsa Lominsa":[{"weather":3,"rate":20},{"weather":1,"rate":50},{"weather":2,"rate":80},{"weather":4,"rate":90},{"weather":7,"rate":100}],"Middle La Noscea":[{"weather":3,"rate":20},{"weather":1,"rate":50},{"weather":2,"rate":70},{"weather":5,"rate":80},{"weather":4,"rate":90},{"weather":7,"rate":100}],"Lower La Noscea":[{"weather":3,"rate":20},{"weather":1,"rate":50},{"weather":2,"rate":70},{"weather":5,"rate":80},{"weather":4,"rate":90},{"weather":7,"rate":100}],"Eastern La Noscea":[{"weather":4,"rate":5},{"weather":1,"rate":50},{"weather":2,"rate":80},{"weather":3,"rate":90},{"weather":7,"rate":95},{"weather":8,"rate":100}],"Western La Noscea":[{"weather":4,"rate":10},{"weather":1,"rate":40},{"weather":2,"rate":60},{"weather":3,"rate":80},{"weather":5,"rate":90},{"weather":6,"rate":100}],"Upper La Noscea":[{"weather":1,"rate":30},{"weather":2,"rate":50},{"weather":3,"rate":70},{"weather":4,"rate":80},{"weather":9,"rate":90},{"weather":10,"rate":100}],"Outer La Noscea":[{"weather":1,"rate":30},{"weather":2,"rate":50},{"weather":3,"rate":70},{"weather":4,"rate":85},{"weather":7,"rate":100}],"Mist":[{"weather":3,"rate":20},{"weather":1,"rate":50},{"weather":2,"rate":70},{"weather":2,"rate":80},{"weather":4,"rate":90},{"weather":7,"rate":100}],"Gridania":[{"weather":7,"rate":5},{"weather":7,"rate":20},{"weather":4,"rate":30},{"weather":3,"rate":40},{"weather":2,"rate":55},{"weather":1,"rate":85},{"weather":2,"rate":100}],"Central Shroud":[{"weather":9,"rate":5},{"weather":7,"rate":20},{"weather":4,"rate":30},{"weather":3,"rate":40},{"weather":2,"rate":55},{"weather":1,"rate":85},{"weather":2,"rate":100}],"East Shroud":[{"weather":9,"rate":5},{"weather":7,"rate":20},{"weather":4,"rate":30},{"weather":3,"rate":40},{"weather":2,"rate":55},{"weather":1,"rate":85},{"weather":2,"rate":100}],"South Shroud":[{"weather":4,"rate":5},{"weather":10,"rate":10},{"weather":9,"rate":25},{"weather":4,"rate":30},{"weather":3,"rate":40},{"weather":2,"rate":70},{"weather":1,"rate":100}],"North Shroud":[{"weather":4,"rate":5},{"weather":8,"rate":10},{"weather":7,"rate":25},{"weather":4,"rate":30},{"weather":3,"rate":40},{"weather":2,"rate":70},{"weather":1,"rate":100}],"The Lavender Beds":[{"weather":3,"rate":5},{"weather":7,"rate":20},{"weather":4,"rate":30},{"weather":3,"rate":40},{"weather":2,"rate":55},{"weather":1,"rate":85},{"weather":2,"rate":100}],"Ul'dah":[{"weather":1,"rate":40},{"weather":2,"rate":60},{"weather":3,"rate":85},{"weather":4,"rate":95},{"weather":7,"rate":100}],"Western Thanalan":[{"weather":1,"rate":40},{"weather":2,"rate":60},{"weather":3,"rate":85},{"weather":4,"rate":95},{"weather":7,"rate":100}],"Central Thanalan":[{"weather":11,"rate":15},{"weather":1,"rate":55},{"weather":2,"rate":75},{"weather":3,"rate":85},{"weather":4,"rate":95},{"weather":7,"rate":100}],"Eastern Thanalan":[{"weather":1,"rate":40},{"weather":2,"rate":60},{"weather":3,"rate":70},{"weather":4,"rate":80},{"weather":7,"rate":85},{"weather":8,"rate":100}],"Southern Thanalan":[{"weather":14,"rate":20},{"weather":1,"rate":60},{"weather":2,"rate":80},{"weather":3,"rate":90},{"weather":4,"rate":100}],"Northern Thanalan":[{"weather":1,"rate":5},{"weather":2,"rate":20},{"weather":3,"rate":50},{"weather":4,"rate":100}],"The Goblet":[{"weather":1,"rate":40},{"weather":2,"rate":60},{"weather":3,"rate":85},{"weather":4,"rate":95},{"weather":7,"rate":100}],"Ishgard":[{"weather":15,"rate":60},{"weather":2,"rate":70},{"weather":1,"rate":75},{"weather":3,"rate":90},{"weather":4,"rate":100}],"Coerthas Central Highlands":[{"weather":16,"rate":20},{"weather":15,"rate":60},{"weather":2,"rate":70},{"weather":1,"rate":75},{"weather":3,"rate":90},{"weather":4,"rate":100}],"Coerthas Western Highlands":[{"weather":16,"rate":20},{"weather":15,"rate":60},{"weather":2,"rate":70},{"weather":1,"rate":75},{"weather":3,"rate":90},{"weather":4,"rate":100}],"Mor Dhona":[{"weather":3,"rate":15},{"weather":4,"rate":30},{"weather":17,"rate":60},{"weather":1,"rate":75},{"weather":2,"rate":100}],"The Sea of Clouds":[{"weather":1,"rate":30},{"weather":2,"rate":60},{"weather":3,"rate":70},{"weather":4,"rate":80},{"weather":5,"rate":90},{"weather":49,"rate":100}],"Azys Lla":[{"weather":2,"rate":35},{"weather":3,"rate":70},{"weather":9,"rate":100}],"The Diadem":[{"weather":2,"rate":30},{"weather":4,"rate":60},{"weather":5,"rate":90},{"weather":49,"rate":100}],"The Dravanian Forelands":[{"weather":3,"rate":10},{"weather":4,"rate":20},{"weather":9,"rate":30},{"weather":11,"rate":40},{"weather":1,"rate":70},{"weather":2,"rate":100}],"The Dravanian Hinterlands":[{"weather":3,"rate":10},{"weather":4,"rate":20},{"weather":7,"rate":30},{"weather":8,"rate":40},{"weather":1,"rate":70},{"weather":2,"rate":100}],"The Churning Mists":[{"weather":3,"rate":10},{"weather":6,"rate":20},{"weather":50,"rate":40},{"weather":1,"rate":70},{"weather":2,"rate":100}],"Idyllshire":[{"weather":3,"rate":10},{"weather":4,"rate":20},{"weather":7,"rate":30},{"weather":8,"rate":40},{"weather":1,"rate":70},{"weather":2,"rate":100}],"Rhalgr's Reach":[{"weather":1,"rate":15},{"weather":2,"rate":60},{"weather":3,"rate":80},{"weather":4,"rate":90},{"weather":9,"rate":100}],"The Fringes":[{"weather":1,"rate":15},{"weather":2,"rate":60},{"weather":3,"rate":80},{"weather":4,"rate":90},{"weather":9,"rate":100}],"The Peaks":[{"weather":1,"rate":10},{"weather":2,"rate":60},{"weather":3,"rate":75},{"weather":4,"rate":85},{"weather":5,"rate":95},{"weather":11,"rate":100}],"The Lochs":[{"weather":1,"rate":20},{"weather":2,"rate":60},{"weather":3,"rate":80},{"weather":4,"rate":90},{"weather":10,"rate":100}],"The Ruby Sea":[{"weather":9,"rate":10},{"weather":5,"rate":20},{"weather":3,"rate":35},{"weather":2,"rate":75},{"weather":1,"rate":100}],"Yanxia":[{"weather":8,"rate":5},{"weather":7,"rate":15},{"weather":4,"rate":25},{"weather":3,"rate":40},{"weather":2,"rate":80},{"weather":1,"rate":100}],"The Azim Steppe":[{"weather":6,"rate":5},{"weather":5,"rate":10},{"weather":7,"rate":17},{"weather":4,"rate":25},{"weather":3,"rate":35},{"weather":2,"rate":75},{"weather":1,"rate":100}],"Kugane":[{"weather":7,"rate":10},{"weather":4,"rate":20},{"weather":3,"rate":40},{"weather":2,"rate":80},{"weather":1,"rate":100}],"Shirogane":[{"weather":7,"rate":10},{"weather":4,"rate":20},{"weather":3,"rate":40},{"weather":2,"rate":80},{"weather":1,"rate":100}]},

    forecast: function(lDate, zone) {
        var weatherRate = gt.skywatcher.zoneWeather[zone];
        if (!weatherRate) {
            console.error("No weather rates for zone", zone);
            return null;
        }

        var forecastTarget = gt.skywatcher.calculateForecastTarget(lDate);
        var rate = _.find(weatherRate, function(r) { return forecastTarget < r.rate; });
        return gt.skywatcher.weatherIndex[rate.weather];
    },

    calculateForecastTarget: function(lDate) {
        // Thanks to Rogueadyn's SaintCoinach library for this calculation.

        var unixSeconds = parseInt(lDate.getTime() / 1000);
        // Get Eorzea hour for weather start
        var bell = unixSeconds / 175;

        // Do the magic 'cause for calculations 16:00 is 0, 00:00 is 8 and 08:00 is 16
        var increment = (bell + 8 - (bell % 8)) % 24;

        // Take Eorzea days since unix epoch
        var totalDays = unixSeconds / 4200;
        totalDays = (totalDays << 32) >>> 0; // uint

        // 0x64 = 100
        var calcBase = totalDays * 100 + increment;

        // 0xB = 11
        var step1 = ((calcBase << 11) ^ calcBase) >>> 0; // uint
        var step2 = ((step1 >>> 8) ^ step1) >>> 0; // uint

        // 0x64 = 100
        return step2 % 100;
    },

    getWeatherInterval: function(eDate) {
        var eWeather = new Date(eDate ? eDate : gt.time.eCurrentTime());
        eWeather.setUTCHours(parseInt(eWeather.getUTCHours() / 8) * 8);
        eWeather.setUTCMinutes(0);
        eWeather.setUTCSeconds(0);
        return eWeather;
    },

    iterateWeather: function(eStart, zone, name, callback)  {
        var eCurrent = new Date(eStart);
        eCurrent.setUTCHours(eCurrent.getUTCHours() - 8);
        var transitionWeather = gt.skywatcher.forecast(gt.time.eorzeaToLocal(eCurrent), zone);
        if (!transitionWeather) {
            console.error('Invalid weather zone, aborting.');
            return null;
        }

        for (var i = 0; i < 200000; i++) {
            eCurrent.setUTCHours(eCurrent.getUTCHours() + 8);
            var weather = gt.skywatcher.forecast(gt.time.eorzeaToLocal(eCurrent), zone);
            var result = callback(weather, transitionWeather, eCurrent);
            if (result)
                return result;

            transitionWeather = weather;
        }

        console.error('Infinite iteration detected', zone, name, eStart);
        return null;
    },

    calculateNextPeriod: function(timer, now) {
        var eStart;
        if (timer.period) {
            eStart = gt.time.localToEorzea(timer.period.expire);
            eStart.setUTCHours(eStart.getUTCHours() + 8);
        } else
            eStart = gt.time.localToEorzea(now);

        var results = gt.skywatcher.calculateWindow(eStart, timer.def);
        if (!results) {
            timer.isTimed = false;
            timer.period = null;
            return;
        }

        timer.period = {
            active: gt.time.eorzeaToLocal(results.active),
            expire: gt.time.eorzeaToLocal(results.expire),
            lastExpire: timer.period ? timer.period.expire : null
        };

        timer.period.mUp = (timer.period.expire - timer.period.active) / 60000;

        // If no expiration was encountered in the last 8 hours default to now.
        if (!timer.period.lastExpire)
            timer.period.lastExpire = now;
    },

    calculateWindow: function(eStart, options) {
        var eStartInterval = gt.skywatcher.getWeatherInterval(eStart);

        var hourCheck = null;
        if (options.during) {
            if (options.during.start < options.during.end)
                hourCheck = function(h) { return h >= options.during.start && h < options.during.end; };
            else
                hourCheck = function(h) { return h >= options.during.start || h < options.during.end; };
        }

        var results = { };

        results.active = gt.skywatcher.iterateWeather(eStartInterval, options.zone, options.name, function(weather, transitionWeather, eTime) {
            if (options.transition && !_.contains(options.transition, transitionWeather))
                return;

            if (options.weather && !_.contains(options.weather, weather))
                return;

            if (hourCheck) {
                var eCheckTime = new Date(eTime);
                // Check all the hours between the time this weather starts and the time it ends.
                for (var i = 0; i < 8; i++) {
                    var hour = eCheckTime.getUTCHours();
                    if (hourCheck(hour)) {
                        // Last check, it's happening!!
                        return eCheckTime;
                    }

                    eCheckTime.setUTCHours(hour + 1);
                }

                return;
            }

            // All other checks passed.
            return eTime;
        });

        if (!results.active)
            return null;

        // Additional transforms after conditions are met.
        if (options.after) {
            if (options.after.eorzeaHours)
                results.active.setUTCHours(results.active.getUTCHours() + options.after.eorzeaHours);
        }

        // Now find when it expires.
        var eActive = gt.skywatcher.getWeatherInterval(results.active);
        results.expire = gt.skywatcher.iterateWeather(eActive, options.zone, options.name, function(weather, transitionWeather, eTime) {
            var eEnd = new Date(eTime);
            eEnd.setUTCHours(eEnd.getUTCHours() + 8);

            if (eEnd < results.active)
                return; // Doesn't start fast enough.

            if (options.transition && !_.contains(options.transition, transitionWeather))
                return eTime;

            if (options.weather && !_.contains(options.weather, weather))
                return eTime;

            if (hourCheck) {
                var eCheckTime = new Date(eTime);
                // Check all the hours between the time this weather starts and the time it ends.
                for (var i = 0; i < 8; i++) {
                    var hour = eCheckTime.getUTCHours();
                    if (eCheckTime > results.active && !hourCheck(hour))
                        return eCheckTime;

                    eCheckTime.setUTCHours(hour + 1);
                }
            }

            // Must still be happening.
        });

        if (!results.expire) {
            console.error("No expiration detected.  Possible 24/7 or all-weather duration.", options);
            return null;
        }

        return results;
    },

    daysIntoLunarCycle: function(eDate) {
        // Moon is visible starting around 6pm.  Change phase around noon when
        // it can't be seen.
        return ((eDate.getTime() / (1000 * 60 * 60 * 24)) + .5) % 32;
    },

    nextMoonPhase: function(eDate, moon, interCycleHourOffset) {
        var daysIntoCycle = gt.skywatcher.daysIntoLunarCycle(eDate);
        var daysNeeded = moon * 4;

        var offsetDays = (daysNeeded - daysIntoCycle) + (interCycleHourOffset / 24);

        // Use next month if this time is in the past.
        if (offsetDays <= 0)
            offsetDays += 32;

        var ticks = eDate.getTime() + (offsetDays * gt.time.millisecondsPerDay);
        return new Date(ticks);
    }
};

// gt.timeline.js

gt.timeline = {
    addSlot: function(timeslots, active, timer) {
        // Fit an icon into this timeslot.
        var activeSeconds = (active.getUTCHours() * 3600) + (active.getUTCMinutes() * 60) + active.getUTCSeconds();
        var slot = timeslots[activeSeconds];
        if (!slot)
            timeslots[activeSeconds] = slot = [];

        slot.push('<img src="' + timer.icon + '" title="' + timer.tooltip + '">');
    },

    render: function() {
        // Render a 24 Eorzea-hour period (70 minutes)
        var now = gt.time.eCurrentTime();
        var end = new Date(now);
        end.setUTCMinutes(0);
        end.setUTCSeconds(1);
        end.setUTCHours(24);
        var end2 = new Date(now);
        end2.setUTCHours(end2.getUTCHours() + 24);

        // Find the items to generate a timeline for.
        var items = [];
        for (var i = 0; i < gt.bell.settings.lists.length; i++) {
            var list = gt.bell.settings.lists[i];
            if (!list.active)
                continue;

            var elements = gt.layout.engine.getDisplayedElements(list);
            for (var ii = 0; ii < elements.length; ii++)
                items.push(elements[ii]);
        }

        // Generate timeslots.
        var timeslots = {};
        var activeItems = {};
        var timers = _.map(items, function(i) { return $(i).data('view'); });
        for (var i = 0; i < timers.length; i++) {
            var timer = timers[i];
            if (!timer.isTimed)
                continue;

            var active = gt.time.localToEorzea(timer.period.active);
            if (active > end && active > end2)
                continue;

            if (activeItems[timer.id])
                continue;
            else
                activeItems[timer.id] = 1;

            gt.timeline.addSlot(timeslots, active, timer);

            if (timer.lastPeriod) {
                var lastActive = gt.time.localToEorzea(timer.lastPeriod.active);
                if (lastActive.getUTCHours() == active.getUTCHours())
                    continue; // Don't log to the same slot.

                if (lastActive > end && lastActive > end2)
                    continue;

                gt.timeline.addSlot(timeslots, lastActive, timer);

            }
        }

        // Display all the slots.
        var max = 0;
        var $timeslots = $('#timeslots');
        $timeslots.empty();
        for (var activeSeconds in timeslots) {
            var images = timeslots[activeSeconds];
            max = Math.max(max, images.length);
            var activePercent = (activeSeconds / (24 * 60 * 60)) * 100;
            var $slot = $('<div class="slot" style="left: ' + activePercent + '%"></div>');
            $slot.append(images);
            $timeslots.append($slot);
        }

        max = Math.min(max, 5); // Cap at 5.
        $timeslots.css('height', (8 + (30 * max)) + 'px');

        // Render hours
        var $hours = $('#timeline .hours');
        $hours.empty();
        for (var h = 0; h < 24; h++) {
            var percent = (h / 24) * 100;
            var formatted = h;
            if (!gt.bell.is24Hour) {
                var hour = h == 0 ? 24 : h;
                formatted = ((hour - 1) % 12 + 1);
                if (formatted == 12)
                    formatted += (hour > 11 && hour < 24 ? 'P' : 'A');
            }
            var $hour = $('<span class="hour" style="left: ' + percent + '%">' + formatted + '</span>');
            $hours.append($hour);
        }
    },

    tick: function(now) {
        var seconds = (now.getUTCHours() * 3600) + (now.getUTCMinutes() * 60) + now.getUTCSeconds();
        var percent = (seconds / (24 * 60 * 60)) * 100;
        $('#timeline .hand').css('left', percent + '%');

        // Rerender at the start of the day to catch new stuff.
        if (seconds <= 21)
            gt.timeline.render();
    }
};

// gt.map.js

gt.map = {
    dragOriginX: 0,
    dragOriginY: 0,
    dragging: null,
    pixelsPerGrid: 50,
    canvasSize: 381,
    canvasScale: 381 / 2048,
    stateFillStyles: {
        active: 'rgba(60, 99, 60, 0.7)',
        spawning: 'rgba(150, 72, 51, 0.7)'
    },

    setup: function ($wrapper) {
        var $container = $('.map-container', $wrapper);
        if (!$container.length)
            return;

        var view = $wrapper.data('view');
        var location = view.location;
        var size = gt.map.pixelsPerGrid * location.size * gt.map.canvasScale;

        if (!gt.isTouchDevice) {
            // Dragging, at least, works fine with touch by default.
            //$container.bind('wheel', gt.map.wheel);

            //$container.bind('mousedown', gt.map.dragDown);
            $container.bind('mousemove', gt.map.mousemove);
            $container.bind('mouseout', gt.map.mouseout);
        }

        $container.data('location', location);

        // Paint the image
        var $base = $('canvas.base', $container);

        gt.cache.whenImages([view.image]).done(function() {
            var image = gt.cache.images[view.image];

            // Draw base map image.
            var baseContext = $base[0].getContext('2d');
            baseContext.drawImage(image, 0, 0, gt.map.canvasSize, gt.map.canvasSize);

            // Draw grid tiles.
            baseContext.beginPath();
            baseContext.strokeStyle = 'rgba(50, 50, 50, 0.05)';
            for (var i = 0; i < gt.map.canvasSize; i += size) {
                for (var ii = 0; ii < gt.map.canvasSize; ii += size)
                    baseContext.strokeRect(i, ii, size, size);
            }
            baseContext.closePath();

            gt.map.renderPoints($container, view);
        });
    },

    renderPoints: function($container, view) {
        var pointScale = 4;

        var points = view.points;
        var size = gt.map.pixelsPerGrid * view.location.size;
        var iconSize = gt.map.pixelsPerGrid * pointScale * gt.map.canvasScale;

        var $points = $('canvas.points', $container);
        var pointContext = $points[0].getContext('2d');

        var imageSources = _.map(view.points, function(p) {
            return { src: p.icon, rarity: p.origin.def.rarity || 1 };
        });

        gt.display.paintItemsWithoutBackground(imageSources).done(function() {
            for (var i = 0; i < view.points.length; i++) {
                var p = view.points[i];
                var img = gt.cache.imagesWithoutBackground[p.icon];
                var progress = p.origin.progress;
                var state = progress ? progress.state : 'dormant';

                if (state != 'dormant') {
                    var adj = (iconSize / 2) - 12;
                    pointContext.beginPath();
                    pointContext.arc(p.x + adj, p.y + adj, p.r * (pointScale / view.location.size) * gt.map.canvasScale * 1.2, 0, Math.PI * 2, false);
                    pointContext.fillStyle = gt.map.stateFillStyles[state];
                    pointContext.fill();
                    pointContext.closePath();
                }

                pointContext.drawImage(img, p.x - (gt.map.pixelsPerGrid / pointScale), p.y - (gt.map.pixelsPerGrid / pointScale), iconSize, iconSize);
            }
        });
    },

    getViewModel: function(zoneName, coords, radius) {
        var location = _.find(_.values(gt.location.index), function(l) { return l.name == zoneName; });
        if (!location || !location.parentId)
            return null;

        var view = {
            location: location,
            parent: gt.location.index[location.parentId],
            displayCoords: coords
        };

        var offset = 1;
        var x = (coords[0] - offset) * gt.map.pixelsPerGrid * location.size * gt.map.canvasScale;
        var y = (coords[1] - offset) * gt.map.pixelsPerGrid * location.size * gt.map.canvasScale;
        view.coords = [x, y];

        if (radius)
            view.radius = gt.map.toMapCoordinate(radius, location.size) * Math.PI * 2;
        else {
            view.radius = gt.map.pixelsPerGrid / 2;
            view.radius *= location.size;
        }

        view.image = '../files/maps/' + view.parent.name + '/' + gt.map.sanitizeLocationName(location.name) + '.png';

        return view;
    },

    sanitizeLocationName: function(name) {
        if (name.indexOf('The Diadem') == 0)
            return 'The Diadem';
        else
            return name;
    },

    toMapCoordinate: function(value, size) {
        return ((50 / size) * ((value * size) / 2048));
    },

    getGridPosition: function(e, mapContainer) {
        var x = e.offsetX + mapContainer.scrollLeft;
        var y = e.offsetY + mapContainer.scrollTop;

        var zoom = Number($('.map', mapContainer).css('zoom') || 1);

        var location = $(mapContainer).data('location');
        var mapX = (x / (gt.map.pixelsPerGrid * zoom)) / location.size;
        var mapY = (y / (gt.map.pixelsPerGrid * zoom)) / location.size;
        return {x: mapX, y: mapY};
    },

    getAbsolutePosition: function(pos, mapContainer) {
        var location = $(mapContainer).data('location');
        var pixelsPerGrid = gt.map.pixelsPerGrid * Number($('.map', mapContainer).css('zoom') || 1);
        var scrollX = pos.x * pixelsPerGrid * location.size;
        var scrollY = pos.y * pixelsPerGrid * location.size;
        return {x: scrollX, y: scrollY};
    },

    mousemove: function(e) {
        var pos = gt.map.getGridPosition(e, this);
        pos.x /= gt.map.canvasScale;
        pos.y /= gt.map.canvasScale;
        $('.position', this).text(parseInt(pos.x + 1) + ", " + parseInt(pos.y + 1));
    },

    wheel: function(e) {
        e.stopPropagation();
        e = e.originalEvent;

        var gridPos = gt.map.getGridPosition(e, this);

        var delta = gt.display.normalizeWheelDelta(e.deltaY) * .0015;

        var $map = $('.map', this);
        var currentZoom = Number($map.css('zoom') || 1);
        var zoom = Math.min(Math.max(currentZoom - delta, 0.1857), 1.75);

        $map.css('zoom', zoom);

        // Zooming shifts location.  Readjust scrollbar to account for changes.
        var absolutePos = gt.map.getAbsolutePosition(gridPos, this);
        this.scrollLeft = absolutePos.x - e.offsetX;
        this.scrollTop = absolutePos.y - e.offsetY;

        return false;
    },

    mouseout: function(e) {
        // Reset coords when moving the mouse out of the map.
        var $position = $('.position', this);
        $position.empty();
    },

    dragDown: function(e) {
        gt.map.dragOriginX = e.pageX;
        gt.map.dragOriginY = e.pageY;
        gt.map.dragging = this;

        $('html')
            .bind('mouseup touchend', gt.map.dragUp)
            .bind('mousemove touchmove', gt.map.dragMove);

        $(this).addClass('dragging');
    },

    dragUp: function(e) {
        $('html')
            .unbind('mouseup')
            .unbind('mousemove')
            .unbind('touchup')
            .unbind('touchmove');

        $('.dragging').removeClass('dragging');

        gt.map.dragOriginX = 0;
        gt.map.dragOriginY = 0;
        gt.map.dragging = null;
    },

    dragMove: function(e) {
        var x = e.pageX;
        var y = e.pageY;

        var maxDelta = 15;
        var acceleration = 1.15;
        xDelta = Math.min(Math.max(gt.map.dragOriginX - x, -maxDelta), maxDelta) * acceleration;
        yDelta = Math.min(Math.max(gt.map.dragOriginY - y, -maxDelta), maxDelta) * acceleration;

        if (xDelta > 1 || xDelta < 1)
            gt.map.dragging.scrollLeft += xDelta;

        if (yDelta > 1 || yDelta < 1)
            gt.map.dragging.scrollTop += yDelta;

        gt.map.dragOriginX = x;
        gt.map.dragOriginY = y;

        return false;
    },

    render: function() {
        if (!gt.bell.settings.maps)
            return;

        // Collect map data.
        var zoneMaps = {};
        var lists = gt.bell.settings.lists;
        for (var i = 0; i < lists.length; i++) {
            var list = lists[i];
            if (!list.active)
                continue;

            var elements = gt.layout.engine.getDisplayedElements(list);
            for (var ii = 0; ii < elements.length; ii++) {
                var $element = $(elements[ii]);
                var view = $element.data('view');
                if (!view.map)
                    continue;

                var mapView = zoneMaps[view.map.location.name];
                if (!mapView) {
                    mapView = zoneMaps[view.map.location.name] = {
                        points: [],
                        location: view.map.location,
                        image: view.map.image
                    };
                }

                mapView.points.push({
                    x: view.map.coords[0], y: view.map.coords[1],
                    dx: view.map.displayCoords[0], dy: view.map.displayCoords[1],
                    r: view.map.radius, icon: view.icon,
                    origin: view
                });
            }
        }

        // Display the maps
        var sortedMapKeys = _.keys(zoneMaps).sort();
        var $maps = $('#maps').empty();
        for (var i = 0; i < sortedMapKeys.length; i++) {
            var mapView = zoneMaps[sortedMapKeys[i]];
            mapView.displayCoords = _.map(mapView.points, function(p) { return p.dx + ", " + p.dy }).join("<br/>");

            var $map = $(gt.layout.templates.map(mapView));
            $map.data('view', mapView);
            $maps.append($map);
            gt.map.setup($map);
        }
    }
};

// gt.display.js

gt.display = {
    normalizeWheelDelta: function(d) {
        var min = 50;

        if (d < 0 && d > -min)
            return -min;
        else if (d > 0 && d < min)
            return min;
        return d;
    },

    paintItemsWithoutBackground: function(set) {
        set.unshift({ src: 'icons/Blank Item Backdrop.png', rarity: 1, backdrop: 1 });
        set.unshift({ src: 'icons/Blank Uncommon Backdrop.png', rarity: 2, backdrop: 1 });
        var imageSet = _.map(set, function(i) { return i.src; });

        var completed = $.Deferred();
        gt.cache.whenImages(imageSet).done(function() {
            var blankImages = { };
            var loads = [];

            for (var i = 0; i < set.length; i++) {
                var item = set[i];
                if (item.backdrop) {
                    blankImages[item.rarity] = gt.cache.images[item.src];
                    continue;
                }

                var src = item.src;
                var blankImg = blankImages[item.rarity];

                var image = gt.cache.imagesWithoutBackground[src];
                if (image)
                    loads.push(image.deferred);
                else {
                    var load = $.Deferred();

                    var newImage = new Image();
                    newImage.deferred = load;
                    gt.cache.imagesWithoutBackground[src] = newImage;

                    newImage.onload = function() { this.deferred.resolve(this); };
                    newImage.src = gt.display.paintItemWithoutBackground(blankImg, gt.cache.images[src], 128);
                    loads.push(load);
                }
            }

            $.when.apply($, loads).done(function() { completed.resolve(); });
        });

        return completed;
    },

    paintItemWithoutBackground: function(blankImg, itemImg, size) {
        var canvas = document.createElement('canvas');
        canvas.height = size * 2;
        canvas.width = size * 2;
        var context = canvas.getContext('2d');

        context.drawImage(blankImg, size, size, size, size);
        var blankPixels = context.getImageData(size, size, size, size);
        var blankData = blankPixels.data;

        context.drawImage(itemImg, 0, 0, size, size);
        var itemPixels = context.getImageData(0, 0, size, size);
        var itemData = itemPixels.data;

        for (var i = 0; i < itemData.length; i += 4) {
            // Skip already transparent pixels.
            if (itemData[i+3] == 0)
                continue;

            // Generate a difference score.
            var diff = 0;
            for (var ii = 0; ii < 3; ii++)
                diff += Math.abs(itemData[i+ii] - blankData[i+ii]);

            // Make this pixel transparent if the difference is not over our threshold.
            if (diff < 45)
                itemData[i+3] = 0;
        }

        canvas.height = size;
        canvas.width = size;
        context.clearRect(0, 0, size, size);
        context.putImageData(itemPixels, 0, 0);

        return canvas.toDataURL();
    }
};

// gt.cache.js

gt.cache = {
    images: {},
    imagesWithoutBackground: {},

    whenImages: function(set) {
        var loads = [];

        for (var i = 0; i < set.length; i++) {
            var src = set[i];
            var image = gt.cache.images[src];
            if (image)
                loads.push(image.deferred);
            else {
                var load = $.Deferred();

                var newImage = new Image();
                newImage.deferred = load;
                gt.cache.images[src] = newImage;

                newImage.onload = function() { this.deferred.resolve(this); };
                newImage.src = src;
                loads.push(load);
            } 
        }

        return $.when.apply($, loads);
    }
}

// gt.util.js

gt.util = {
    repeat: function(str, times) {
        var result = "";
        for (var i = 0; i < times; i++)
            result += str;
        return result;
    },

    stars: function(stars) {
        return stars ? (' ' + gt.util.repeat('&#x2605', stars)) : '';
    },

    zeroPad: function(num, digits) {
        return ("00000000" + num).slice(-digits);
    },

    sanitize: function(str) {
        return str.replace(/[\s'\?\(\)\.\:/\!"<>\\\+]/g, '');
    }
};

// gt.data.core.js

gt.scrips = { "Red Gatherers' Scrip": 65029, "Yellow Gatherers' Scrip": 65043, "White Gatherers' Scrip": 65069 };
gt.location = { };
gt.location.index = {"21":{"id":21,"name":"Eorzea","parentId":21,"size":1},"22":{"id":22,"name":"La Noscea","parentId":22,"size":1},"23":{"id":23,"name":"The Black Shroud","parentId":23,"size":1},"24":{"id":24,"name":"Thanalan","parentId":24,"size":1},"25":{"id":25,"name":"Coerthas","parentId":25,"size":1},"26":{"id":26,"name":"Mor Dhona","parentId":26,"size":1},"27":{"id":27,"name":"Limsa Lominsa","parentId":22,"weatherRate":14},"28":{"id":28,"name":"Limsa Lominsa Upper Decks","parentId":22,"size":2,"weatherRate":14},"29":{"id":29,"name":"Limsa Lominsa Lower Decks","parentId":22,"size":2,"weatherRate":15},"30":{"id":30,"name":"Middle La Noscea","parentId":22,"size":1,"weatherRate":16},"31":{"id":31,"name":"Lower La Noscea","parentId":22,"size":1,"weatherRate":17},"32":{"id":32,"name":"Eastern La Noscea","parentId":22,"size":1,"weatherRate":18},"33":{"id":33,"name":"Western La Noscea","parentId":22,"size":1,"weatherRate":19},"34":{"id":34,"name":"Upper La Noscea","parentId":22,"size":1,"weatherRate":20},"35":{"id":35,"name":"Sastasha","parentId":22,"size":2},"36":{"id":36,"name":"Brayflox's Longstop","parentId":22,"size":2},"37":{"id":37,"name":"The Wanderer's Palace","parentId":22,"size":2},"39":{"id":39,"name":"Gridania","parentId":23,"weatherRate":1},"40":{"id":40,"name":"Ul'dah - Steps of Nald","parentId":24,"size":2,"weatherRate":7},"41":{"id":41,"name":"Ul'dah - Steps of Thal - Merchant Strip","parentId":24,"size":2,"weatherRate":8},"42":{"id":42,"name":"Western Thanalan","parentId":24,"size":1,"weatherRate":9},"43":{"id":43,"name":"Central Thanalan","parentId":24,"size":1,"weatherRate":10},"44":{"id":44,"name":"Eastern Thanalan","parentId":24,"size":1,"weatherRate":11},"45":{"id":45,"name":"Southern Thanalan","parentId":24,"size":1,"weatherRate":12},"46":{"id":46,"name":"Northern Thanalan","parentId":24,"size":1,"weatherRate":13},"47":{"id":47,"name":"Cutter's Cry - The Dry Sands","parentId":24,"size":2},"48":{"id":48,"name":"Copperbell Mines - Ground Level","parentId":24,"size":2},"49":{"id":49,"name":"Halatali","parentId":24,"size":2},"50":{"id":50,"name":"The Sunken Temple of Qarn - Sanctum Entrance","parentId":24,"size":2},"51":{"id":51,"name":"Ul'dah","parentId":24,"weatherRate":7},"52":{"id":52,"name":"New Gridania","parentId":23,"size":2,"weatherRate":1},"53":{"id":53,"name":"Old Gridania","parentId":23,"size":2,"weatherRate":2},"54":{"id":54,"name":"Central Shroud","parentId":23,"size":1,"weatherRate":3},"55":{"id":55,"name":"East Shroud","parentId":23,"size":1,"weatherRate":4},"56":{"id":56,"name":"South Shroud","parentId":23,"size":1,"weatherRate":5},"57":{"id":57,"name":"North Shroud","parentId":23,"size":1,"weatherRate":6},"58":{"id":58,"name":"The Tam-Tara Deepcroft","parentId":23,"size":3},"59":{"id":59,"name":"Haukke Manor - Ground Floor","parentId":23,"size":2},"61":{"id":61,"name":"The Thousand Maws of Toto-Rak","parentId":23,"size":2},"62":{"id":62,"name":"Ishgard","parentId":25,"weatherRate":47},"63":{"id":63,"name":"Coerthas Central Highlands","parentId":25,"size":1,"weatherRate":21},"64":{"id":64,"name":"Dzemael Darkhold - Outer Hold","parentId":25,"size":2},"65":{"id":65,"name":"Aurum Vale","parentId":25,"size":2},"66":{"id":66,"name":"Far East","parentId":66,"size":1},"67":{"id":67,"name":"Mor Dhona","parentId":26,"size":1,"weatherRate":22},"68":{"id":68,"name":"Jadeite Thick"},"69":{"id":69,"name":"Greentear"},"70":{"id":70,"name":"Bentbranch"},"71":{"id":71,"name":"Sorrel Haven"},"73":{"id":73,"name":"The Honey Yard"},"74":{"id":74,"name":"Nine Ivies"},"75":{"id":75,"name":"The Bramble Patch"},"76":{"id":76,"name":"Larkscall"},"77":{"id":77,"name":"Sylphlands"},"78":{"id":78,"name":"Upper Paths"},"79":{"id":79,"name":"Lower Paths"},"80":{"id":80,"name":"Snakemolt"},"81":{"id":81,"name":"Silent Arbor"},"82":{"id":82,"name":"Urth's Gift"},"83":{"id":83,"name":"Treespeak"},"84":{"id":84,"name":"Peacegarden"},"85":{"id":85,"name":"Alder Springs"},"86":{"id":86,"name":"Proud Creek"},"87":{"id":87,"name":"Blue Badger Gate"},"88":{"id":88,"name":"White Wolf Gate"},"89":{"id":89,"name":"Gilbert's Spire"},"90":{"id":90,"name":"The Bannock"},"91":{"id":91,"name":"Gabineaux's Bower"},"93":{"id":93,"name":"Spirithold"},"94":{"id":94,"name":"Bentbranch Meadows"},"95":{"id":95,"name":"Galvanth's Spire"},"96":{"id":96,"name":"The Matron's Lethe"},"98":{"id":98,"name":"The Mirror Planks"},"99":{"id":99,"name":"Lilystone"},"100":{"id":100,"name":"The Hedgetree"},"101":{"id":101,"name":"Everschade"},"103":{"id":103,"name":"Sanguine Perch"},"104":{"id":104,"name":"Hopeseed Pond"},"105":{"id":105,"name":"Amberscale Rock"},"107":{"id":107,"name":"The Hawthorne Hut"},"108":{"id":108,"name":"The Hedgetree"},"110":{"id":110,"name":"Amarissaix's Spire"},"111":{"id":111,"name":"Castrum Oriens"},"112":{"id":112,"name":"Sanctum of the Twelve","parentId":23,"size":2,"weatherRate":4},"113":{"id":113,"name":"Little Solace"},"114":{"id":114,"name":"Moonspore Grove"},"115":{"id":115,"name":"The Seedbed"},"116":{"id":116,"name":"Goldleaf Dais"},"117":{"id":117,"name":"Hanging Barbs"},"118":{"id":118,"name":"Buscarron's Scar"},"119":{"id":119,"name":"Buscarron's Druthers"},"121":{"id":121,"name":"Issom-Har"},"122":{"id":122,"name":"No Man's Hovel"},"123":{"id":123,"name":"Camp Tranquil"},"125":{"id":125,"name":"The Lost City of Amdapor - Central Amdapor","parentId":23,"size":2,"weatherRate":40},"126":{"id":126,"name":"Rootslake"},"128":{"id":128,"name":"Amdapor Keep","parentId":23,"size":2,"weatherRate":28},"129":{"id":129,"name":"Quarrymill"},"130":{"id":130,"name":"Redbelly Hive"},"131":{"id":131,"name":"Goblins' Meet"},"132":{"id":132,"name":"Takers' Rot"},"133":{"id":133,"name":"South Shroud - Urth's Fount","parentId":23,"size":1,"weatherRate":45},"135":{"id":135,"name":"Yellow Serpent Gate"},"136":{"id":136,"name":"Treespeak Stables"},"137":{"id":137,"name":"E-Tatt's Spire"},"138":{"id":138,"name":"The Hedgetree"},"139":{"id":139,"name":"Hyrstmill"},"140":{"id":140,"name":"Fallgourd Float"},"141":{"id":141,"name":"The Bobbing Cork"},"142":{"id":142,"name":"Florentel's Spire"},"143":{"id":143,"name":"Finders' Bluff"},"144":{"id":144,"name":"Gelmorra Ruins"},"145":{"id":145,"name":"Ixali Logging Grounds"},"146":{"id":146,"name":"Eugenia's Spire"},"147":{"id":147,"name":"Hall of the Novice"},"153":{"id":153,"name":"Mordion Gaol"},"155":{"id":155,"name":"Sweetbloom Pier"},"156":{"id":156,"name":"West Vein"},"158":{"id":158,"name":"Josselin's Spire"},"159":{"id":159,"name":"Fullflower Comb"},"160":{"id":160,"name":"Blessed Bud"},"161":{"id":161,"name":"Zephyr Drift"},"162":{"id":162,"name":"Summerford"},"163":{"id":163,"name":"Three-malm Bend"},"164":{"id":164,"name":"Moraby Bay"},"165":{"id":165,"name":"Cedarwood"},"166":{"id":166,"name":"The Gods' Grip"},"167":{"id":167,"name":"Bloodshore"},"168":{"id":168,"name":"Raincatcher Gully"},"169":{"id":169,"name":"Agelyss Wise"},"170":{"id":170,"name":"Quarterstone"},"171":{"id":171,"name":"Skull Valley"},"173":{"id":173,"name":"The Isles of Umbra"},"174":{"id":174,"name":"Oakwood"},"176":{"id":176,"name":"Iron Lake"},"177":{"id":177,"name":"Bronze Lake"},"178":{"id":178,"name":"Zelma's Run"},"179":{"id":179,"name":"Zephyr Gate"},"182":{"id":182,"name":"Rogue River"},"183":{"id":183,"name":"La Thagran Checkpoint"},"184":{"id":184,"name":"Summerford Farms"},"185":{"id":185,"name":"Seasong Grotto"},"186":{"id":186,"name":"Agelyss River"},"187":{"id":187,"name":"The Cookpot"},"188":{"id":188,"name":"Tiller's Rest"},"189":{"id":189,"name":"The Descent"},"190":{"id":190,"name":"Skylift"},"191":{"id":191,"name":"De Nevelle Checkpoint"},"192":{"id":192,"name":"Woad Whisper Canyon"},"193":{"id":193,"name":"Nym River"},"194":{"id":194,"name":"Foremast"},"195":{"id":195,"name":"Madman Bridge"},"196":{"id":196,"name":"The Eyes"},"197":{"id":197,"name":"The Mourning Widow"},"198":{"id":198,"name":"Tempest Gate"},"199":{"id":199,"name":"Oschon's Embrace"},"200":{"id":200,"name":"Red Rooster Stead"},"201":{"id":201,"name":"The Grey Fleet"},"202":{"id":202,"name":"Blind Iron Mines"},"204":{"id":204,"name":"House of Sticks"},"205":{"id":205,"name":"Gullperch Tower"},"206":{"id":206,"name":"Costa del Sol"},"207":{"id":207,"name":"Agelyss River"},"208":{"id":208,"name":"Ferry Docks"},"209":{"id":209,"name":"The Garlok's Lair"},"210":{"id":210,"name":"Hidden Falls Docks"},"211":{"id":211,"name":"Hidden Falls"},"213":{"id":213,"name":"The Severed String"},"214":{"id":214,"name":"Red Mantis Falls"},"215":{"id":215,"name":"Raincatcher Gully Docks"},"216":{"id":216,"name":"Wineport"},"218":{"id":218,"name":"Swiftperch"},"219":{"id":219,"name":"The Flock"},"220":{"id":220,"name":"The Brewer's Beacon"},"223":{"id":223,"name":"Aleport"},"224":{"id":224,"name":"Camp Skull Valley"},"225":{"id":225,"name":"The Founder's Crypt"},"226":{"id":226,"name":"North Tidegate"},"227":{"id":227,"name":"South Tidegate"},"228":{"id":228,"name":"The Ship Graveyard"},"229":{"id":229,"name":"Isle of Endless Summer"},"230":{"id":230,"name":"Pharos Sirius - Flood Cellar","parentId":22,"size":2,"weatherRate":28},"231":{"id":231,"name":"Memeroon's Trading Post"},"232":{"id":232,"name":"Poor Maid's Mill"},"233":{"id":233,"name":"Thalaos"},"234":{"id":234,"name":"Fool Falls"},"235":{"id":235,"name":"The Hermit's Hovel"},"236":{"id":236,"name":"The Floating City of Nym"},"237":{"id":237,"name":"Camp Overlook"},"238":{"id":238,"name":"U'Ghamaro Mines"},"239":{"id":239,"name":"Camp Bronze Lake"},"241":{"id":241,"name":"Jijiroon's Trading Post"},"242":{"id":242,"name":"Kobold Dig"},"243":{"id":243,"name":"Hammerlea"},"244":{"id":244,"name":"Horizon's Edge"},"245":{"id":245,"name":"The Footfalls"},"246":{"id":246,"name":"Cape Westwind"},"247":{"id":247,"name":"Spineless Basin"},"248":{"id":248,"name":"Black Brush"},"249":{"id":249,"name":"The Clutch"},"250":{"id":250,"name":"Drybone"},"251":{"id":251,"name":"Sandgate"},"252":{"id":252,"name":"Wellwick Wood"},"253":{"id":253,"name":"The Burning Wall"},"254":{"id":254,"name":"Broken Water"},"255":{"id":255,"name":"Southern Thanalan - Zanr'ak","parentId":24,"size":1,"weatherRate":12},"256":{"id":256,"name":"The Red Labyrinth"},"257":{"id":257,"name":"Sagolii Desert"},"258":{"id":258,"name":"Bluefog"},"259":{"id":259,"name":"Raubahn's Push"},"260":{"id":260,"name":"Castrum Meridianum","parentId":24,"size":2},"262":{"id":262,"name":"Beaconhill Lighthouse"},"263":{"id":263,"name":"Scorpion Crossing"},"264":{"id":264,"name":"Nophica's Wells"},"265":{"id":265,"name":"The East Hammer"},"266":{"id":266,"name":"The Silver Bazaar"},"268":{"id":268,"name":"Sunrise Gate"},"269":{"id":269,"name":"Sunset Gate"},"270":{"id":270,"name":"Royal Allagan Sunway"},"271":{"id":271,"name":"Horizon"},"272":{"id":272,"name":"Crescent Cove"},"273":{"id":273,"name":"The Silent King"},"274":{"id":274,"name":"Vesper Bay"},"275":{"id":275,"name":"Moondrip"},"276":{"id":276,"name":"Parata's Peace"},"277":{"id":277,"name":"Imperial Outpost"},"278":{"id":278,"name":"Stonesthrow"},"279":{"id":279,"name":"Fesca's Wash"},"282":{"id":282,"name":"Royal Plantations"},"283":{"id":283,"name":"Ul'dah Dispatch Yard"},"284":{"id":284,"name":"Royal Allagan Starway"},"285":{"id":285,"name":"Fesca's Watch"},"286":{"id":286,"name":"Sultantree"},"287":{"id":287,"name":"Sagolii Gate"},"288":{"id":288,"name":"Royal Allagan Sunway"},"289":{"id":289,"name":"The Coffer & Coffin"},"290":{"id":290,"name":"Black Brush Station"},"291":{"id":291,"name":"Sil'dih Excavation Site"},"292":{"id":292,"name":"The Rat's Nest"},"293":{"id":293,"name":"Hellsbrood Holes"},"294":{"id":294,"name":"Lost Hope"},"295":{"id":295,"name":"The Bonfire"},"296":{"id":296,"name":"Nanawa Mines"},"297":{"id":297,"name":"The Unholy Heir"},"298":{"id":298,"name":"The Quiveron Manse"},"299":{"id":299,"name":"Royal Allagan Sunway"},"300":{"id":300,"name":"Camp Drybone"},"301":{"id":301,"name":"The Invisible City"},"302":{"id":302,"name":"Church of Saint Adama Landama"},"304":{"id":304,"name":"The Golden Bazaar"},"306":{"id":306,"name":"Amalj'aa Encampment "},"307":{"id":307,"name":"Highbridge"},"308":{"id":308,"name":"Yugr'am River"},"309":{"id":309,"name":"Thal's Respite"},"310":{"id":310,"name":"Burgundy Falls"},"311":{"id":311,"name":"Final Prayer"},"313":{"id":313,"name":"Little Ala Mhigo"},"314":{"id":314,"name":"Burnt Lizard Creek"},"315":{"id":315,"name":"The Sepulchre"},"316":{"id":316,"name":"Circle of the Tempered"},"318":{"id":318,"name":"Zanr'ak Encampment"},"320":{"id":320,"name":"Zahar'ak"},"321":{"id":321,"name":"Nald's Reflection"},"322":{"id":322,"name":"Minotaur Malm"},"323":{"id":323,"name":"Forgotten Springs"},"324":{"id":324,"name":"Byregot's Strike"},"325":{"id":325,"name":"Camp Bluefog"},"326":{"id":326,"name":"East Watchtower"},"327":{"id":327,"name":"West Watchtower"},"328":{"id":328,"name":"Abandoned Amajina Mythril Mine"},"329":{"id":329,"name":"Dalamud's Talons"},"330":{"id":330,"name":"Ceruleum Field"},"331":{"id":331,"name":"Ceruleum Processing Plant"},"332":{"id":332,"name":"Forward Gates"},"337":{"id":337,"name":"Moraby Drydocks"},"338":{"id":338,"name":"The Salt Strand"},"339":{"id":339,"name":"Candlekeep Quay"},"340":{"id":340,"name":"Empty Heart"},"341":{"id":341,"name":"Oschon's Torch"},"346":{"id":346,"name":"Seat of the First Bow","parentId":23,"size":8},"347":{"id":347,"name":"Lotus Stand","parentId":23,"size":4},"350":{"id":350,"name":"Outer La Noscea","parentId":22,"size":1,"weatherRate":24},"351":{"id":351,"name":"Command Room","parentId":22,"size":8,"weatherRate":14},"354":{"id":354,"name":"Heart of the Sworn","parentId":24,"size":4},"356":{"id":356,"name":"The Waking Sands","parentId":24,"size":4},"357":{"id":357,"name":"Bowl of Embers","parentId":24,"size":4,"weatherRate":25},"358":{"id":358,"name":"Wolves' Den Pier","parentId":22,"size":4,"weatherRate":29},"359":{"id":359,"name":"The Navel","parentId":22,"size":4,"weatherRate":23},"360":{"id":360,"name":"Thornmarch","parentId":23,"size":4,"weatherRate":30},"361":{"id":361,"name":"The Howling Eye","parentId":25,"size":4,"weatherRate":26},"362":{"id":362,"name":"The Serpent's Tongue"},"363":{"id":363,"name":"Sapsa Spawning Grounds"},"364":{"id":364,"name":"Sahagin Landbase"},"365":{"id":365,"name":"Reaver Hide"},"368":{"id":368,"name":"Aleport Docks"},"370":{"id":370,"name":"Crescent Cove Docks"},"371":{"id":371,"name":"Silver Bazaar Docks"},"374":{"id":374,"name":"The Solar"},"375":{"id":375,"name":"The South Hammer"},"376":{"id":376,"name":"The West Hammer"},"378":{"id":378,"name":"Ul'dah Aetheryte Plaza"},"380":{"id":380,"name":"Dragonhead"},"381":{"id":381,"name":"Providence Point"},"382":{"id":382,"name":"Boulder Downs"},"383":{"id":383,"name":"Whitebrim"},"384":{"id":384,"name":"Haldrath's March"},"385":{"id":385,"name":"Observatorium"},"386":{"id":386,"name":"Griffin Crossing","parentId":25,"size":2},"387":{"id":387,"name":"Skyfire Locks"},"388":{"id":388,"name":"Camp Dragonhead"},"389":{"id":389,"name":"Witchdrop"},"390":{"id":390,"name":"Steel Vigil"},"391":{"id":391,"name":"The Ogre's Belly"},"392":{"id":392,"name":"The Weeping Saint"},"393":{"id":393,"name":"Natalan"},"395":{"id":395,"name":"Hall of the Seven Echoes"},"396":{"id":396,"name":"Monument Tower"},"398":{"id":398,"name":"Daniffen Pass"},"400":{"id":400,"name":"Gates of Judgement"},"401":{"id":401,"name":"Stone Vigil","parentId":25,"size":2,"weatherRate":27},"402":{"id":402,"name":"Whitebrim Front"},"403":{"id":403,"name":"Behemoth's Dominion"},"404":{"id":404,"name":"Snowcloak","parentId":25,"size":2,"weatherRate":42},"406":{"id":406,"name":"Steps of Faith","parentId":25,"size":2,"weatherRate":28},"407":{"id":407,"name":"Sea of Clouds"},"409":{"id":409,"name":"Fogfens"},"410":{"id":410,"name":"north Silvertear"},"411":{"id":411,"name":"Revenant's Toll"},"412":{"id":412,"name":"Camp Revenant's Toll"},"413":{"id":413,"name":"The Tangle"},"414":{"id":414,"name":"Rathefrost"},"415":{"id":415,"name":"Castrum Centri"},"416":{"id":416,"name":"Saint Coinach's Find"},"417":{"id":417,"name":"Singing Shards"},"418":{"id":418,"name":"The Keeper of the Lake - Forecastle","parentId":26,"size":2,"weatherRate":74},"419":{"id":419,"name":"Everschade\r\n(The Guardian Tree)"},"420":{"id":420,"name":"Crystal Tower"},"422":{"id":422,"name":"The Braveheart"},"423":{"id":423,"name":"Entry Counter"},"424":{"id":424,"name":"Wolves' Den Docks"},"425":{"id":425,"name":"Mist","parentId":22,"size":2,"weatherRate":32},"426":{"id":426,"name":"The Lavender Beds","parentId":23,"size":2,"weatherRate":34},"427":{"id":427,"name":"The Goblet","parentId":24,"size":2,"weatherRate":33},"430":{"id":430,"name":"The Praetorium"},"439":{"id":439,"name":"Dunstan's Spire"},"459":{"id":459,"name":"The Howling Eye","parentId":25,"size":4,"weatherRate":26},"460":{"id":460,"name":"Moraby Drydocks Landing"},"461":{"id":461,"name":"Isles of Umbra Docks"},"462":{"id":462,"name":"Rhotano Sea","parentId":22,"size":4},"464":{"id":464,"name":"Upper Aetheroacoustic Exploratory Site","parentId":22,"size":2},"465":{"id":465,"name":"Lower Aetheroacoustic Exploratory Site","parentId":22,"size":2},"466":{"id":466,"name":"The Ragnarok - Engine Room","parentId":22,"size":2},"467":{"id":467,"name":"Ragnarok Drive Cylinder","parentId":22,"size":2},"468":{"id":468,"name":"Ragnarok Central Core","parentId":22,"size":2},"470":{"id":470,"name":"Labyrinth Guide (to the Minotaur Malm)"},"472":{"id":472,"name":"The Waking Sands"},"473":{"id":473,"name":"White Wolf Gate Guard"},"475":{"id":475,"name":"Mirror Planks Docks"},"476":{"id":476,"name":"Lavender Beds Docks"},"477":{"id":477,"name":"Porta Decumana","parentId":24,"size":4,"weatherRate":31},"478":{"id":478,"name":"Labyrinth of the Ancients - Lower Labyrinth","parentId":26,"size":2},"481":{"id":481,"name":"The Rising Stones","parentId":26,"size":4},"482":{"id":482,"name":"Ring of Ash"},"493":{"id":493,"name":"Syrcus Tower - First Lower Ring","parentId":26,"size":2},"496":{"id":496,"name":"Seal Rock","parentId":22,"size":1,"weatherRate":59},"497":{"id":497,"name":"Abalathia's Spine","parentId":497,"size":1},"498":{"id":498,"name":"Dravania","parentId":498,"size":1},"513":{"id":513,"name":"Kugane","weatherRate":82},"516":{"id":516,"name":"The Crystarium","weatherRate":112},"517":{"id":517,"name":"Eulmore","weatherRate":113},"547":{"id":547,"name":"Carline Canopy\r\n(Adventurers' Guild)"},"548":{"id":548,"name":"The Roost","parentId":23,"size":8},"549":{"id":549,"name":"Airship Landing"},"551":{"id":551,"name":"The Knot"},"552":{"id":552,"name":"Blue Badger Gate"},"554":{"id":554,"name":"Carpenters' Guild"},"557":{"id":557,"name":"Acorn Orchard"},"559":{"id":559,"name":"White Wolf Gate"},"563":{"id":563,"name":"Quiver's Hold\r\n(Archers' Guild)"},"564":{"id":564,"name":"Ebony Stalls"},"565":{"id":565,"name":"Rosewood Stalls"},"566":{"id":566,"name":"Shaded Bower"},"568":{"id":568,"name":"Leatherworkers' Guild"},"569":{"id":569,"name":"Fen–Yll Fineries"},"572":{"id":572,"name":"Wailing Barracks\r\n(Lancers' Guild)"},"573":{"id":573,"name":"The Centaur's Eye"},"574":{"id":574,"name":"Black Boar Gate"},"575":{"id":575,"name":"Apkallu Falls"},"578":{"id":578,"name":"Stillglade Fane\r\n(Conjurers' Guild)"},"579":{"id":579,"name":"Nophica's Altar"},"580":{"id":580,"name":"Mih Khetto's Amphitheatre"},"581":{"id":581,"name":"Greatloam Growery"},"582":{"id":582,"name":"Botanists' Guild"},"584":{"id":584,"name":"The Whistling Miller"},"585":{"id":585,"name":"Black Tea Brook"},"589":{"id":589,"name":"The Mun–Tuy Cellars"},"590":{"id":590,"name":"Gridania Aetheryte Plaza"},"591":{"id":591,"name":"Adders' Nest"},"595":{"id":595,"name":"Westshore Pier"},"613":{"id":613,"name":"Gate of Nald"},"614":{"id":614,"name":"Hall of Flames"},"616":{"id":616,"name":"The Quicksand\r\n(Adventurers' Guild)"},"617":{"id":617,"name":"The Hourglass","parentId":24,"size":8},"619":{"id":619,"name":"Pugilists' Guild"},"621":{"id":621,"name":"Emerald Avenue"},"622":{"id":622,"name":"The Coliseum"},"623":{"id":623,"name":"Gladiators' Guild"},"625":{"id":625,"name":"The Rudius"},"626":{"id":626,"name":"Gate of the Sultana"},"628":{"id":628,"name":"Erralig's Burial Chamber"},"630":{"id":630,"name":"Arrzaneth Ossuary\r\n(Thaumaturges' Guild)"},"631":{"id":631,"name":"Eshtaime's Aesthetics"},"633":{"id":633,"name":"Goldsmiths' Guild"},"636":{"id":636,"name":"Miners' Guild"},"638":{"id":638,"name":"Onyx Lane"},"639":{"id":639,"name":"The Gold Court"},"640":{"id":640,"name":"Ruby Road Exchange"},"641":{"id":641,"name":"Wellhead Lift"},"642":{"id":642,"name":"Sunsilk Tapestries"},"643":{"id":643,"name":"Weavers' Guild"},"645":{"id":645,"name":"Gate of Thal"},"646":{"id":646,"name":"Sapphire Avenue Exchange"},"647":{"id":647,"name":"Pearl Lane"},"648":{"id":648,"name":"Milvaneth Sacrarium"},"650":{"id":650,"name":"Alchemists' Guild"},"652":{"id":652,"name":"Scholars' Walk"},"653":{"id":653,"name":"Royal Promenade"},"654":{"id":654,"name":"Ul'dah - Steps of Nald - Airship Landing","parentId":24,"size":2,"weatherRate":7},"694":{"id":694,"name":"Hall of the Bestiarii"},"695":{"id":695,"name":"Frondale's Ward for Friendless Foundlings","parentId":24,"size":8},"698":{"id":698,"name":"Ul'dah - Steps of Thal - Hustings Strip","parentId":24,"size":2,"weatherRate":8},"702":{"id":702,"name":"The Astalicia"},"703":{"id":703,"name":"Coral Tower\r\n(Marauders' Guild)"},"707":{"id":707,"name":"Mealvaan's Gate\r\n(Arcanists' Guild)"},"709":{"id":709,"name":"The Bismarck\r\n(Culinarians' Guild)"},"711":{"id":711,"name":"Naldiq & Vymelli's\r\n(Blacksmiths' Guild)\r\n(Armorers' Guild)"},"714":{"id":714,"name":"Fisherman's Bottom\r\n(Fishermen's Guild)"},"716":{"id":716,"name":"The Drowning Wench\r\n(Adventurers' Guild)"},"717":{"id":717,"name":"The Hyaline"},"718":{"id":718,"name":"The Seventh Sage"},"719":{"id":719,"name":"The Missing Member"},"725":{"id":725,"name":"Limsa Lominsa Upper Decks - Airship Landing","parentId":22,"size":2,"weatherRate":14},"728":{"id":728,"name":"Ferry Docks"},"731":{"id":731,"name":"Crow's Lift"},"732":{"id":732,"name":"Bulwark Hall"},"733":{"id":733,"name":"Mizzenmast Inn","parentId":22,"size":8},"737":{"id":737,"name":"The Aftcastle"},"738":{"id":738,"name":"Limsa Lominsa Aetheryte Plaza"},"739":{"id":739,"name":"The Octant"},"741":{"id":741,"name":"Anchor Yard"},"743":{"id":743,"name":"Hawkers' Round"},"744":{"id":744,"name":"East Hawkers' Alley"},"745":{"id":745,"name":"West Hawkers' Alley"},"754":{"id":754,"name":"Lominsan Ferry Docks"},"755":{"id":755,"name":"Maelstrom Command"},"789":{"id":789,"name":"The Silent Garden"},"941":{"id":941,"name":"Crystal Gate"},"943":{"id":943,"name":"The Seventh Heaven"},"944":{"id":944,"name":"789th Order Dig"},"945":{"id":945,"name":"Novv's Nursery"},"946":{"id":946,"name":"Moonshade Isle"},"949":{"id":949,"name":"The Reef of Sending"},"951":{"id":951,"name":"The Vein"},"952":{"id":952,"name":"The Mirror"},"953":{"id":953,"name":"Verdant Drop"},"954":{"id":954,"name":"Springripple Brook"},"955":{"id":955,"name":"Sylphlands"},"956":{"id":956,"name":"Upper Hathoeva River"},"957":{"id":957,"name":"Middle Hathoeva River"},"958":{"id":958,"name":"Lower Hathoeva River"},"959":{"id":959,"name":"East Hathoeva River"},"960":{"id":960,"name":"Goblinblood"},"961":{"id":961,"name":"Murmur Rills"},"962":{"id":962,"name":"Fallgourd Float"},"963":{"id":963,"name":"Lake Tahtotl"},"964":{"id":964,"name":"Jadeite Flood"},"965":{"id":965,"name":"Lower Black Tea Brook"},"966":{"id":966,"name":"The Deep Tangle"},"967":{"id":967,"name":"The North Shards"},"968":{"id":968,"name":"Coerthas River"},"969":{"id":969,"name":"The Nail"},"970":{"id":970,"name":"Dragonhead Latrines"},"971":{"id":971,"name":"Exploratory Ice Hole"},"972":{"id":972,"name":"Sea of Clouds"},"973":{"id":973,"name":"Zephyr Drift"},"974":{"id":974,"name":"Summerford"},"975":{"id":975,"name":"West Agelyss River"},"976":{"id":976,"name":"Moraby Bay"},"977":{"id":977,"name":"Cedarwood"},"978":{"id":978,"name":"South Bloodshore"},"979":{"id":979,"name":"North Bloodshore"},"980":{"id":980,"name":"East Agelyss River"},"981":{"id":981,"name":"The Juggernaut"},"982":{"id":982,"name":"Skull Valley"},"983":{"id":983,"name":"Halfstone"},"984":{"id":984,"name":"Isles of Umbra Northshore"},"985":{"id":985,"name":"Isles of Umbra Southshore"},"987":{"id":987,"name":"Northeast Bronze Lake"},"988":{"id":988,"name":"Bronze Lake Shallows"},"989":{"id":989,"name":"The Long Climb"},"990":{"id":990,"name":"Upper Soot Creek"},"991":{"id":991,"name":"Lower Soot Creek"},"992":{"id":992,"name":"North Drybone"},"993":{"id":993,"name":"South Drybone"},"995":{"id":995,"name":"Zahar'ak"},"996":{"id":996,"name":"Sagolii Desert"},"997":{"id":997,"name":"Sagolii Dunes"},"998":{"id":998,"name":"Bluefog"},"999":{"id":999,"name":"Upper Black Tea Brook"},"1000":{"id":1000,"name":"Whispering Gorge"},"1001":{"id":1001,"name":"Rhotano Sea (Privateer Forecastle)"},"1002":{"id":1002,"name":"Rhotano Sea (Privateer Sterncastle)"},"1003":{"id":1003,"name":"Unfrozen Pond"},"1004":{"id":1004,"name":"Clearpool"},"1005":{"id":1005,"name":"South Banepool"},"1006":{"id":1006,"name":"West Banepool"},"1007":{"id":1007,"name":"West Mourn"},"1008":{"id":1008,"name":"Upper Thaliak River"},"1009":{"id":1009,"name":"Middle Thaliak River"},"1010":{"id":1010,"name":"Sohm Al Summit"},"1011":{"id":1011,"name":"Aetherochemical Spill"},"1012":{"id":1012,"name":"Northwest Bronze Lake"},"1013":{"id":1013,"name":"North Isle of Endless Summer"},"1014":{"id":1014,"name":"Timmon Beck"},"1015":{"id":1015,"name":"Dimwold"},"1016":{"id":1016,"name":"The Comet's Tail"},"1017":{"id":1017,"name":"The Velodyna River"},"1018":{"id":1018,"name":"Mirage Creek"},"1019":{"id":1019,"name":"Grymm & Enid"},"1020":{"id":1020,"name":"The Slow Wash"},"1021":{"id":1021,"name":"Heather Falls"},"1022":{"id":1022,"name":"The Ephor"},"1023":{"id":1023,"name":"The Bull's Bath"},"1025":{"id":1025,"name":"The Arms of Meed"},"1026":{"id":1026,"name":"Loch Seld"},"1027":{"id":1027,"name":"The Ruby Price"},"1028":{"id":1028,"name":"Hells' Lid"},"1029":{"id":1029,"name":"The Isle of Bekko"},"1030":{"id":1030,"name":"Shoal Rock"},"1031":{"id":1031,"name":"Onokoro"},"1032":{"id":1032,"name":"Isari"},"1033":{"id":1033,"name":"The Isle of Zekki"},"1034":{"id":1034,"name":"The Heron's Nest"},"1035":{"id":1035,"name":"The Heron's Way"},"1036":{"id":1036,"name":"Namai"},"1037":{"id":1037,"name":"Doma Castle"},"1038":{"id":1038,"name":"Mercantile Docks"},"1039":{"id":1039,"name":"The One River (East)"},"1040":{"id":1040,"name":"The One River (West)"},"1041":{"id":1041,"name":"Plum Spring"},"1042":{"id":1042,"name":"Prism Lake"},"1043":{"id":1043,"name":"Prism Canyon"},"1044":{"id":1044,"name":"Dotharl Khaa"},"1045":{"id":1045,"name":"Azim Khaat"},"1046":{"id":1046,"name":"Nem Khaal"},"1047":{"id":1047,"name":"Tao Khaal"},"1048":{"id":1048,"name":"Lower Yat Khaal"},"1049":{"id":1049,"name":"Upper Yat Khaal"},"1115":{"id":1115,"name":"1"},"1120":{"id":1120,"name":"6"},"1146":{"id":1146,"name":"Resident Caretaker"},"1149":{"id":1149,"name":"Mist Docks"},"1152":{"id":1152,"name":"Goblet North"},"1154":{"id":1154,"name":"Residential Area Guide"},"1200":{"id":1200,"name":"Mistgate Square"},"1202":{"id":1202,"name":"Seagaze Markets"},"1203":{"id":1203,"name":"Mist Beach"},"1209":{"id":1209,"name":"The Endless Draught"},"1210":{"id":1210,"name":"The Brimming Heart"},"1220":{"id":1220,"name":"Wildflower Stalls"},"1221":{"id":1221,"name":"Yainu-Par"},"1222":{"id":1222,"name":"Amethyst Shallows"},"1228":{"id":1228,"name":"Company Workshop - The Goblet","parentId":24,"size":4},"1301":{"id":1301,"name":"Dalamud's Shadow","parentId":23,"size":2},"1302":{"id":1302,"name":"The Outer Coil - Incubation Bay","parentId":23,"size":2,"weatherRate":28},"1303":{"id":1303,"name":"Central Decks - Lower Decks","parentId":23,"size":2},"1304":{"id":1304,"name":"The Holocharts","parentId":23,"size":2},"1334":{"id":1334,"name":"The Whorleater","parentId":22,"size":4,"weatherRate":38},"1350":{"id":1350,"name":"The Solar"},"1352":{"id":1352,"name":"Residential Area Guide"},"1363":{"id":1363,"name":"The Striking Tree","parentId":23,"size":4,"weatherRate":43},"1374":{"id":1374,"name":"Carteneau Flats: Borderland Ruins","parentId":26,"size":1},"1377":{"id":1377,"name":"Hullbreaker Isle","parentId":22,"size":2},"1378":{"id":1378,"name":"Runner's Reel"},"1385":{"id":1385,"name":"Ehcatl"},"1390":{"id":1390,"name":"The Chrysalis","parentId":26,"size":4},"1392":{"id":1392,"name":"Rowena's House of Splendors"},"1393":{"id":1393,"name":"The Diamond Forge"},"1399":{"id":1399,"name":"Akh Afah Amphitheatre","parentId":25,"size":4,"weatherRate":46},"1406":{"id":1406,"name":"IC-06 Central Decks","parentId":24,"size":2},"1407":{"id":1407,"name":"IC-06 Regeneration Grid","parentId":24,"size":2},"1408":{"id":1408,"name":"IC-06 Main Bridge","parentId":24,"size":2},"1409":{"id":1409,"name":"The Burning Heart","parentId":24,"size":2,"weatherRate":44},"1427":{"id":1427,"name":"Dutiful Sisters of the Edelweiss","parentId":22,"size":4,"weatherRate":15},"1428":{"id":1428,"name":"Dock Storehouse","parentId":22,"size":4,"weatherRate":18},"1429":{"id":1429,"name":"Intercessory","parentId":25,"size":4},"1431":{"id":1431,"name":"The World of Darkness","parentId":26,"size":2},"1453":{"id":1453,"name":"Dutiful Sisters of the Edelweiss\r\n(Rogues' Guild)"},"1484":{"id":1484,"name":"The Gold Saucer","parentId":24,"size":4},"1485":{"id":1485,"name":"Entrance Square"},"1486":{"id":1486,"name":"Gold Saucer Aetheryte Plaza"},"1487":{"id":1487,"name":"Card Square"},"1488":{"id":1488,"name":"Wonder Square"},"1489":{"id":1489,"name":"Round Square"},"1490":{"id":1490,"name":"Event Square"},"1491":{"id":1491,"name":"Airship Landing"},"1492":{"id":1492,"name":"Main Counter"},"1493":{"id":1493,"name":"Chocobo Lift"},"1494":{"id":1494,"name":"El Coloso"},"1495":{"id":1495,"name":"Mt. Corel"},"1496":{"id":1496,"name":"Main Stage"},"1497":{"id":1497,"name":"Cactpot Board"},"1498":{"id":1498,"name":"The Manderville Tables"},"1499":{"id":1499,"name":"The Manderville Lounge"},"1501":{"id":1501,"name":"Race Counter"},"1502":{"id":1502,"name":"Chocobo Lift"},"1570":{"id":1570,"name":"The Quire"},"1628":{"id":1628,"name":"The Fist of the Father","parentId":498,"size":2},"1633":{"id":1633,"name":"The Cuff of the Father - Upper Ring","parentId":498,"size":2},"1638":{"id":1638,"name":"The Arm of the Father","parentId":498,"size":2},"1645":{"id":1645,"name":"The Burden of the Father","parentId":498,"size":2},"1647":{"id":1647,"name":"The Diadem","parentId":497,"size":1,"weatherRate":71},"1660":{"id":1660,"name":"The Eighteenth Floor","parentId":24,"size":1},"1663":{"id":1663,"name":"Lord of Verminion Counter"},"1665":{"id":1665,"name":"The Battlehall","parentId":24,"size":8},"1708":{"id":1708,"name":"The Fist of the Son","parentId":498,"size":2},"1714":{"id":1714,"name":"The Cuff of the Son - Forward Ring","parentId":498,"size":2},"1723":{"id":1723,"name":"The Arm of the Son","parentId":498,"size":2},"1731":{"id":1731,"name":"The Burden of the Son","parentId":498,"size":2},"1742":{"id":1742,"name":"The Weeping City of Mhach - Yafaem Saltmoor","parentId":26,"size":2},"1759":{"id":1759,"name":"The Binding Coil of Bahamut"},"1792":{"id":1792,"name":"Xelphatol","parentId":25,"size":2,"weatherRate":40},"1794":{"id":1794,"name":"Dueling Circle"},"1800":{"id":1800,"name":"Twin Adder Barracks","parentId":23,"size":4},"1801":{"id":1801,"name":"Flame Barracks","parentId":24,"size":4},"1802":{"id":1802,"name":"Maelstrom Barracks","parentId":22,"size":4},"1803":{"id":1803,"name":"The Parrock","parentId":497,"size":4},"1804":{"id":1804,"name":"Leofard's Chambers","parentId":497,"size":8},"1811":{"id":1811,"name":"Topmast Apartment Lobby","parentId":22,"size":4},"1813":{"id":1813,"name":"Lily Hills Apartment Lobby","parentId":23,"size":4},"1815":{"id":1815,"name":"Sultana's Breath Apartment Lobby","parentId":24,"size":4},"1823":{"id":1823,"name":"Room #107"},"1824":{"id":1824,"name":"Room #108"},"1826":{"id":1826,"name":"Room #101"},"1827":{"id":1827,"name":"Room #105"},"1828":{"id":1828,"name":"Room #103"},"1830":{"id":1830,"name":"Room #102"},"1831":{"id":1831,"name":"Room #201"},"1833":{"id":1833,"name":"The Hall of Blood"},"1835":{"id":1835,"name":"Eyes of the Creator - The Tipped Ewer","parentId":498,"size":2},"1841":{"id":1841,"name":"Breath of the Creator - Illuminus","parentId":498,"size":2},"1847":{"id":1847,"name":"Heart of the Creator","parentId":498,"size":2},"1852":{"id":1852,"name":"Main Generators"},"1853":{"id":1853,"name":"Soul of the Creator","parentId":498,"size":2},"1856":{"id":1856,"name":"Heart of the Creator","parentId":498,"size":1},"1857":{"id":1857,"name":"Baelsar's Wall - Lower Reaches","parentId":23,"size":2,"weatherRate":40},"1868":{"id":1868,"name":"Dun Scaith - The Lady Radlia","parentId":497,"size":2,"weatherRate":58},"1887":{"id":1887,"name":"Omega Control","parentId":26,"size":4},"1896":{"id":1896,"name":"Akanegumo Bridge"},"1912":{"id":1912,"name":"Shirogane Shores Subdivision"},"1960":{"id":1960,"name":"The Misery","parentId":22,"size":4,"weatherRate":36},"2000":{"id":2000,"name":"The Dravanian Forelands","parentId":498,"size":0.95,"weatherRate":50},"2001":{"id":2001,"name":"The Dravanian Hinterlands","parentId":498,"size":0.95,"weatherRate":51},"2002":{"id":2002,"name":"The Churning Mists","parentId":498,"size":0.95,"weatherRate":52},"2003":{"id":2003,"name":"Chocobo Forest"},"2004":{"id":2004,"name":"The Smoldering Wastes"},"2005":{"id":2005,"name":"Loth ast Gnath"},"2006":{"id":2006,"name":"Avalonia Fallen"},"2007":{"id":2007,"name":"Sohm Al Foothills - The South Face","parentId":498,"size":2},"2008":{"id":2008,"name":"Mourn"},"2009":{"id":2009,"name":"The Makers' Quarter"},"2010":{"id":2010,"name":"The Collectors' Quarter"},"2011":{"id":2011,"name":"The Ruling Quarter"},"2012":{"id":2012,"name":"Sohm Al Summit"},"2013":{"id":2013,"name":"Eil Tohm"},"2014":{"id":2014,"name":"Landlord Colony"},"2015":{"id":2015,"name":"Four Arms"},"2016":{"id":2016,"name":"Ohl Tahn"},"2017":{"id":2017,"name":"Greensward"},"2018":{"id":2018,"name":"Tailfeather"},"2019":{"id":2019,"name":"The Hundred Throes"},"2020":{"id":2020,"name":"Whilom River"},"2021":{"id":2021,"name":"Loth ast Vath"},"2022":{"id":2022,"name":"The Stained One"},"2023":{"id":2023,"name":"Thriphive"},"2025":{"id":2025,"name":"Anyx Trine"},"2028":{"id":2028,"name":"Ehs Daih"},"2029":{"id":2029,"name":"The Iron Feast"},"2030":{"id":2030,"name":"Halo"},"2031":{"id":2031,"name":"Sohm Al"},"2032":{"id":2032,"name":"The Arkhitekton"},"2033":{"id":2033,"name":"The Paths of Creation"},"2034":{"id":2034,"name":"Saint Mocianne's Arboretum - First Floor","parentId":498,"size":2},"2035":{"id":2035,"name":"Quickspill Delta"},"2036":{"id":2036,"name":"Matoya's Cave","parentId":498,"size":4},"2037":{"id":2037,"name":"Path of Knowing"},"2038":{"id":2038,"name":"The Great Gubal Library","parentId":498,"size":2},"2039":{"id":2039,"name":"Thaliak River"},"2042":{"id":2042,"name":"Moghome"},"2043":{"id":2043,"name":"The House of Letters"},"2044":{"id":2044,"name":"Monsterie"},"2045":{"id":2045,"name":"Asah"},"2046":{"id":2046,"name":"Zenith"},"2047":{"id":2047,"name":"The Rookery"},"2048":{"id":2048,"name":"Tharl Oom Khash"},"2049":{"id":2049,"name":"Easton Eyes"},"2050":{"id":2050,"name":"The Aery","parentId":498,"size":2,"weatherRate":28},"2051":{"id":2051,"name":"Mother of the Sheave"},"2052":{"id":2052,"name":"The Answering Quarter"},"2053":{"id":2053,"name":"The Hissing Cobbles"},"2055":{"id":2055,"name":"Mare's Oath"},"2064":{"id":2064,"name":"Anyx Old"},"2067":{"id":2067,"name":"Bigwest Shortstop"},"2069":{"id":2069,"name":"The Paths of Contemplation"},"2076":{"id":2076,"name":"Gron Rhei"},"2078":{"id":2078,"name":"Sothton Walls"},"2079":{"id":2079,"name":"Weston Waters"},"2080":{"id":2080,"name":"The Lost Landlord"},"2081":{"id":2081,"name":"Thok ast Thok","parentId":498,"size":4,"weatherRate":57},"2082":{"id":2082,"name":"Idyllshire","parentId":498,"size":4,"weatherRate":55},"2083":{"id":2083,"name":"Sacrificial Chamber","parentId":498,"size":4},"2084":{"id":2084,"name":"Frontbridge"},"2085":{"id":2085,"name":"Backbridge"},"2086":{"id":2086,"name":"The Cenotaph"},"2087":{"id":2087,"name":"Idyllshire Aetheryte Plaza"},"2088":{"id":2088,"name":"The Antitower - Pleroma","parentId":498,"size":2},"2089":{"id":2089,"name":"Stone, Sky, Sea"},"2090":{"id":2090,"name":"Sohr Khai - An Answer of Sorrow","parentId":498,"size":2},"2092":{"id":2092,"name":"Stickqix's Bangpots"},"2093":{"id":2093,"name":"Rowena's Center for Cultural Promotion"},"2094":{"id":2094,"name":"Freewalks Roundspot"},"2095":{"id":2095,"name":"Bahrr Lehs"},"2096":{"id":2096,"name":"The Hard Place"},"2097":{"id":2097,"name":"The Snail"},"2098":{"id":2098,"name":"Greengrub Mudplots"},"2100":{"id":2100,"name":"The Sea of Clouds","parentId":497,"size":0.95,"weatherRate":53},"2101":{"id":2101,"name":"Azys Lla","parentId":497,"size":0.95,"weatherRate":54},"2102":{"id":2102,"name":"Cloudtop"},"2103":{"id":2103,"name":"Voor Sian Siran"},"2104":{"id":2104,"name":"Vundu Ok' Bendu"},"2105":{"id":2105,"name":"The Blue Window"},"2106":{"id":2106,"name":"The Gauntlet"},"2107":{"id":2107,"name":"Ok' Vundu Vana"},"2108":{"id":2108,"name":"Ok' Vundu Mok"},"2109":{"id":2109,"name":"Alpha Quadrant"},"2110":{"id":2110,"name":"Beta Quadrant"},"2111":{"id":2111,"name":"Gamma Quadrant"},"2112":{"id":2112,"name":"Delta Quadrant"},"2113":{"id":2113,"name":"The Habisphere"},"2114":{"id":2114,"name":"The Flagship"},"2115":{"id":2115,"name":"The Protector"},"2116":{"id":2116,"name":"Camp Cloudtop"},"2117":{"id":2117,"name":"The Rosehouse"},"2118":{"id":2118,"name":"Ok' Gundu"},"2119":{"id":2119,"name":"The Nidifice"},"2120":{"id":2120,"name":"The Eddies"},"2121":{"id":2121,"name":"Hearth of the Mighty Bendu"},"2123":{"id":2123,"name":"Ok' Zundu"},"2125":{"id":2125,"name":"Hall of the Fallen Plume"},"2126":{"id":2126,"name":"The Cromlech"},"2129":{"id":2129,"name":"Mok Oogl Island"},"2130":{"id":2130,"name":"Neverreap","parentId":497,"size":2},"2131":{"id":2131,"name":"Helix"},"2132":{"id":2132,"name":"Alpha Comm Beacon"},"2134":{"id":2134,"name":"Matter Conduit II-III"},"2135":{"id":2135,"name":"Matter Conduit III-II"},"2136":{"id":2136,"name":"Biomass Incubation Complex"},"2138":{"id":2138,"name":"Matter Conduit IV-V"},"2139":{"id":2139,"name":"Matter Conduit V-IV"},"2143":{"id":2143,"name":"Matter Conduit VI-VII"},"2144":{"id":2144,"name":"Matter Conduit VII-VI"},"2147":{"id":2147,"name":"Aetherochemical Research Facility - Automachina Research","parentId":497,"size":2},"2148":{"id":2148,"name":"The Fractal Continuum - Forward Complex","parentId":497,"size":2},"2151":{"id":2151,"name":"The Limitless Blue","parentId":497,"size":4,"weatherRate":28},"2152":{"id":2152,"name":"Last Step"},"2153":{"id":2153,"name":"Wisent Herd"},"2154":{"id":2154,"name":"Disappearing Falls"},"2156":{"id":2156,"name":"Morrowmotes"},"2160":{"id":2160,"name":"Provenance"},"2161":{"id":2161,"name":"Centrifugal Crystal Engine"},"2164":{"id":2164,"name":"Recombination Labs"},"2172":{"id":2172,"name":"The Aqueduct"},"2173":{"id":2173,"name":"The Pappus Tree"},"2174":{"id":2174,"name":"The Warring Triad"},"2177":{"id":2177,"name":"Hyperstellar Downconverter"},"2178":{"id":2178,"name":"Singularity Reactor","parentId":497,"size":4,"weatherRate":56},"2179":{"id":2179,"name":"Central Azys Lla","parentId":497,"size":4},"2181":{"id":2181,"name":"Void Ark - Upper Deck","parentId":497,"size":2,"weatherRate":37},"2200":{"id":2200,"name":"Coerthas Western Highlands","parentId":25,"size":0.95,"weatherRate":49},"2201":{"id":2201,"name":"Riversmeet"},"2202":{"id":2202,"name":"Twinpools"},"2203":{"id":2203,"name":"Red Rim"},"2204":{"id":2204,"name":"Falcon's Nest"},"2205":{"id":2205,"name":"Coerthas River"},"2207":{"id":2207,"name":"Gorgagne Mills"},"2208":{"id":2208,"name":"Hemlock"},"2209":{"id":2209,"name":"Camp Riversmeet"},"2210":{"id":2210,"name":"Banepool"},"2211":{"id":2211,"name":"Ashpool"},"2212":{"id":2212,"name":"The Dreaming Dragon"},"2213":{"id":2213,"name":"The Bed of Bones"},"2214":{"id":2214,"name":"Dusk Vigil","parentId":25,"size":2,"weatherRate":42},"2215":{"id":2215,"name":"The Pike"},"2216":{"id":2216,"name":"The Anvil"},"2217":{"id":2217,"name":"Greytail Falls"},"2220":{"id":2220,"name":"The Convictory"},"2221":{"id":2221,"name":"Black Iron Bridge"},"2222":{"id":2222,"name":"The Ninth Vare"},"2223":{"id":2223,"name":"Gorgagne Holding"},"2225":{"id":2225,"name":"Oakum Landing"},"2227":{"id":2227,"name":"Dragonspit"},"2228":{"id":2228,"name":"The Watcher"},"2237":{"id":2237,"name":"Lancegate"},"2238":{"id":2238,"name":"Summoning Stone"},"2240":{"id":2240,"name":"Ok' Gundu Nakki"},"2255":{"id":2255,"name":"The Bounty"},"2256":{"id":2256,"name":"Containment Bay S1T7","parentId":497,"size":4,"weatherRate":66},"2258":{"id":2258,"name":"Diadem Grotto"},"2259":{"id":2259,"name":"Southern Diadem Lake"},"2261":{"id":2261,"name":"Northern Diadem Lake"},"2262":{"id":2262,"name":"Blustery Cloudtop"},"2263":{"id":2263,"name":"Calm Cloudtop"},"2264":{"id":2264,"name":"Swirling Cloudtop"},"2265":{"id":2265,"name":"Containment Bay P1T6","parentId":497,"size":4,"weatherRate":69},"2266":{"id":2266,"name":"Containment Bay Z1T9","parentId":497,"size":4,"weatherRate":75},"2272":{"id":2272,"name":"Kobai Goten Apartment Lobby","parentId":2402,"size":4},"2284":{"id":2284,"name":"The Interdimensional Rift","parentId":2400,"size":2,"weatherRate":88},"2291":{"id":2291,"name":"The Hall of the Griffin","parentId":2400,"size":2},"2294":{"id":2294,"name":"Ala Mhigo - Royal Palace","parentId":2400,"size":2},"2295":{"id":2295,"name":"The Blessed Treasury","parentId":2401,"size":4,"weatherRate":77},"2296":{"id":2296,"name":"The Resonatorium","parentId":2400,"size":4},"2297":{"id":2297,"name":"The Sirensong Sea","parentId":22,"size":2,"weatherRate":36},"2298":{"id":2298,"name":"Kugane Castle - Ni-no-Maru","parentId":2402,"size":2},"2299":{"id":2299,"name":"Emanation","parentId":2400,"size":4,"weatherRate":87},"2300":{"id":2300,"name":"Foundation","parentId":25,"size":2,"weatherRate":47},"2301":{"id":2301,"name":"The Pillars","parentId":25,"size":2,"weatherRate":48},"2302":{"id":2302,"name":"The Arc of the Worthy"},"2303":{"id":2303,"name":"Ishgard Aetheryte Plaza"},"2304":{"id":2304,"name":"Saint Valeroyant's Forum"},"2305":{"id":2305,"name":"Saint Reinette's Forum"},"2307":{"id":2307,"name":"The Arc of the Humble"},"2308":{"id":2308,"name":"The Fury's Mercy"},"2309":{"id":2309,"name":"The Brume"},"2310":{"id":2310,"name":"Cloud Nine","parentId":25,"size":8},"2311":{"id":2311,"name":"The Forgotten Knight"},"2312":{"id":2312,"name":"Congregation of Our Knights Most Heavenly"},"2313":{"id":2313,"name":"The Lightfeather Proving Grounds","parentId":25,"size":4},"2314":{"id":2314,"name":"Skysteel Manufactory"},"2316":{"id":2316,"name":"The Holy Stables"},"2317":{"id":2317,"name":"The Jeweled Crozier"},"2318":{"id":2318,"name":"Durendaire Manor"},"2319":{"id":2319,"name":"Haillenarte Manor"},"2320":{"id":2320,"name":"Fortemps Manor","parentId":25,"size":4},"2321":{"id":2321,"name":"Dzemael Manor"},"2322":{"id":2322,"name":"Athenaeum Astrologicum"},"2323":{"id":2323,"name":"Airship Landing"},"2325":{"id":2325,"name":"The Supreme Sacred Tribunal of Halonic Inquisitory Doctrine"},"2326":{"id":2326,"name":"The Hoplon"},"2327":{"id":2327,"name":"The Vault - Chantry Nave","parentId":25,"size":2},"2328":{"id":2328,"name":"Saint Reymanaud's Cathedral"},"2329":{"id":2329,"name":"The Architects"},"2330":{"id":2330,"name":"The Last Vigil"},"2331":{"id":2331,"name":"The Arc of the Venerable"},"2335":{"id":2335,"name":"Seat of the Lord Commander","parentId":25,"size":4},"2336":{"id":2336,"name":"Ruling Chamber","parentId":25,"size":4},"2337":{"id":2337,"name":"Saint Endalim's Scholasticate","parentId":25,"size":4},"2339":{"id":2339,"name":"The First Altar of Djanan Qhat","parentId":2400,"size":4},"2354":{"id":2354,"name":"The Jade Stoa","parentId":2401,"size":4,"weatherRate":93},"2357":{"id":2357,"name":"Deltascape V1.0","parentId":2400,"size":4,"weatherRate":88},"2358":{"id":2358,"name":"Deltascape V2.0","parentId":2400,"size":4,"weatherRate":88},"2359":{"id":2359,"name":"Deltascape V3.0","parentId":2400,"size":4,"weatherRate":88},"2360":{"id":2360,"name":"Deltascape V4.0","parentId":2400,"size":4,"weatherRate":88},"2367":{"id":2367,"name":"The Drowned City of Skalla - The Shallows","parentId":2400,"size":2},"2370":{"id":2370,"name":"The Prima Vista Tiring Room"},"2371":{"id":2371,"name":"The Prima Vista Bridge"},"2372":{"id":2372,"name":"The Royal City of Rabanastre"},"2392":{"id":2392,"name":"Reisen Temple","parentId":2401,"size":4},"2400":{"id":2400,"name":"Gyr Abania","parentId":2400,"size":1},"2401":{"id":2401,"name":"Othard","parentId":2401,"size":1},"2402":{"id":2402,"name":"Hingashi","parentId":2402,"size":1},"2403":{"id":2403,"name":"Rhalgr's Reach","parentId":2400,"size":2,"weatherRate":78},"2404":{"id":2404,"name":"Kugane","parentId":2402,"size":2,"weatherRate":82},"2405":{"id":2405,"name":"???"},"2406":{"id":2406,"name":"The Fringes","parentId":2400,"size":1,"weatherRate":79},"2407":{"id":2407,"name":"The Peaks","parentId":2400,"size":1,"weatherRate":80},"2408":{"id":2408,"name":"The Lochs","parentId":2400,"size":1,"weatherRate":81},"2409":{"id":2409,"name":"The Ruby Sea","parentId":2401,"size":1,"weatherRate":83},"2410":{"id":2410,"name":"Yanxia","parentId":2401,"size":1,"weatherRate":84},"2411":{"id":2411,"name":"The Azim Steppe","parentId":2401,"size":1,"weatherRate":85},"2412":{"id":2412,"name":"Shirogane","parentId":2402,"size":2,"weatherRate":82},"2414":{"id":2414,"name":"Eureka Anemos","weatherRate":91},"2415":{"id":2415,"name":"Port Surgate"},"2451":{"id":2451,"name":"The Ridorana Cataract"},"2456":{"id":2456,"name":"Echoes from Time's Garden"},"2462":{"id":2462,"name":"Eureka Pagos","weatherRate":94},"2463":{"id":2463,"name":"Icepoint"},"2475":{"id":2475,"name":"The Western Edge"},"2483":{"id":2483,"name":"The Ridorana Lighthouse"},"2497":{"id":2497,"name":"Haukke Manor - Ground Floor","parentId":23,"size":2},"2500":{"id":2500,"name":"Hak Khaal"},"2501":{"id":2501,"name":"Kugane Piers"},"2502":{"id":2502,"name":"Upper Mirage Creek"},"2503":{"id":2503,"name":"The Outer Fist"},"2504":{"id":2504,"name":"Rhalgr's Reach"},"2505":{"id":2505,"name":"Shirogane"},"2506":{"id":2506,"name":"The Silver Canal"},"2507":{"id":2507,"name":"The Doman Enclave"},"2511":{"id":2511,"name":"Ruby Price Depths"},"2512":{"id":2512,"name":"Tamamizu"},"2513":{"id":2513,"name":"Sui–no–Sato"},"2514":{"id":2514,"name":"The Adventure"},"2515":{"id":2515,"name":"Shisui of the Violet Tides"},"2516":{"id":2516,"name":"The Kobayashi Maru"},"2517":{"id":2517,"name":"The One River Southwestern Riverbeds"},"2518":{"id":2518,"name":"The One River Southern Riverbeds"},"2519":{"id":2519,"name":"Imperial Hypersonic Assault Craft L-XXIII"},"2520":{"id":2520,"name":"The Sunken Junk"},"2521":{"id":2521,"name":"The Dragon's Struggle"},"2522":{"id":2522,"name":"Azim Khaat Western Lakebed"},"2523":{"id":2523,"name":"Azim Khaat Eastern Lakebed"},"2524":{"id":2524,"name":"Loch Seld Northwestern Lakebed"},"2525":{"id":2525,"name":"Loch Seld Central Lakebed"},"2526":{"id":2526,"name":"Loch Seld Southeastern Lakebed"},"2530":{"id":2530,"name":"Eureka Pyros","weatherRate":96},"2531":{"id":2531,"name":"Northpoint"},"2532":{"id":2532,"name":"Flurry"},"2539":{"id":2539,"name":"The Living Foundry"},"2545":{"id":2545,"name":"Eureka Hydatos","weatherRate":100},"2600":{"id":2600,"name":"East End"},"2601":{"id":2601,"name":"Pike Falls"},"2602":{"id":2602,"name":"The Striped Hills"},"2603":{"id":2603,"name":"Virdjala"},"2604":{"id":2604,"name":"The Last Forest"},"2605":{"id":2605,"name":"Rustrock"},"2606":{"id":2606,"name":"Wightrock"},"2607":{"id":2607,"name":"Mount Yorn"},"2608":{"id":2608,"name":"The High Bank"},"2609":{"id":2609,"name":"Loch Seld"},"2610":{"id":2610,"name":"The Ala Mhigan Quarter"},"2611":{"id":2611,"name":"Abalathia's Skull"},"2613":{"id":2613,"name":"Castrum Oriens"},"2614":{"id":2614,"name":"Liberty Gate"},"2615":{"id":2615,"name":"Bittermill"},"2617":{"id":2617,"name":"Timmon Beck"},"2618":{"id":2618,"name":"Owyn's Stash"},"2620":{"id":2620,"name":"The Percipient One"},"2621":{"id":2621,"name":"Dimwold"},"2622":{"id":2622,"name":"Fletcher's Cabin"},"2623":{"id":2623,"name":"Castellum Corvi"},"2624":{"id":2624,"name":"The Comet's Tail"},"2625":{"id":2625,"name":"The Pall of Clarity"},"2626":{"id":2626,"name":"The Velodyna River"},"2627":{"id":2627,"name":"Schism"},"2628":{"id":2628,"name":"The Circles of Answering"},"2630":{"id":2630,"name":"Mirage Creek"},"2631":{"id":2631,"name":"Gyr Kehim"},"2632":{"id":2632,"name":"Castellum Velodyna"},"2634":{"id":2634,"name":"The Peering Stones"},"2635":{"id":2635,"name":"Vira Nilya"},"2636":{"id":2636,"name":"Qalyana Nilya"},"2637":{"id":2637,"name":"Djanan Qhat"},"2639":{"id":2639,"name":"Sathya Maga"},"2640":{"id":2640,"name":"The Yawn"},"2641":{"id":2641,"name":"Emprise"},"2642":{"id":2642,"name":"Grymm & Enid"},"2643":{"id":2643,"name":"Byron's Bread"},"2644":{"id":2644,"name":"The Ziggurat"},"2645":{"id":2645,"name":"The Carmine Kitchen"},"2646":{"id":2646,"name":"Ala Gannha"},"2651":{"id":2651,"name":"Hidden Tear"},"2652":{"id":2652,"name":"Sleeping Stones"},"2654":{"id":2654,"name":"Whitherwander"},"2655":{"id":2655,"name":"The Razor Mountains"},"2657":{"id":2657,"name":"Goodblade"},"2658":{"id":2658,"name":"Miriam's Luck"},"2660":{"id":2660,"name":"Ala Ghiri"},"2661":{"id":2661,"name":"The Scabbard"},"2662":{"id":2662,"name":"Specula Imperatoris"},"2663":{"id":2663,"name":"The Arms of Meed"},"2665":{"id":2665,"name":"Castrum Abania","parentId":2400,"size":2},"2666":{"id":2666,"name":"Radiata"},"2667":{"id":2667,"name":"The Ironroad"},"2668":{"id":2668,"name":"The Bull's Bath"},"2669":{"id":2669,"name":"Coldhearth"},"2670":{"id":2670,"name":"Porta Praetoria"},"2674":{"id":2674,"name":"Sothwatch"},"2675":{"id":2675,"name":"Sali Monastery"},"2679":{"id":2679,"name":"Aenadem Ei"},"2685":{"id":2685,"name":"The Saltery"},"2688":{"id":2688,"name":"The Divine Audience"},"2689":{"id":2689,"name":"The Ruiner"},"2691":{"id":2691,"name":"Ala Mhigo - Mercantile District","parentId":2400,"size":2},"2692":{"id":2692,"name":"The Queen's Gardens"},"2693":{"id":2693,"name":"The Ala Mhigan Quarter"},"2694":{"id":2694,"name":"Gylbarde's Gate"},"2698":{"id":2698,"name":"Aenadem Ol"},"2699":{"id":2699,"name":"Bloodhowe"},"2700":{"id":2700,"name":"The Tomb of the Errant Sword"},"2704":{"id":2704,"name":"The Royal Hunting Grounds"},"2705":{"id":2705,"name":"Rhalgr's Reach Aetheryte Plaza"},"2706":{"id":2706,"name":"The Barber"},"2707":{"id":2707,"name":"The Temple of the Fist - Dilemma","parentId":2400,"size":2},"2708":{"id":2708,"name":"The Royal Airship Landing","parentId":2400,"size":4,"weatherRate":76},"2710":{"id":2710,"name":"The Destroyer"},"2711":{"id":2711,"name":"Bloodstorm"},"2712":{"id":2712,"name":"Recompense"},"2713":{"id":2713,"name":"Starfall"},"2714":{"id":2714,"name":"Chakra Falls"},"2715":{"id":2715,"name":"Transparency","parentId":2400,"size":4,"weatherRate":76},"2737":{"id":2737,"name":"The Interdimensional Rift","parentId":2400,"size":4,"weatherRate":92},"2750":{"id":2750,"name":"Rasen Kaikyo"},"2751":{"id":2751,"name":"East Othard Coastline"},"2752":{"id":2752,"name":"The Gensui Chain"},"2753":{"id":2753,"name":"The Glittering Basin"},"2754":{"id":2754,"name":"Valley of the Fallen Rainbow"},"2755":{"id":2755,"name":"Doma"},"2756":{"id":2756,"name":"The Sea of Blades"},"2757":{"id":2757,"name":"Onsal Hakair"},"2758":{"id":2758,"name":"The Towering Still"},"2759":{"id":2759,"name":"Nhaama's Retreat"},"2760":{"id":2760,"name":"The Ruby Price"},"2762":{"id":2762,"name":"Hells' Lid","parentId":2401,"size":2},"2763":{"id":2763,"name":"The Crab Pots"},"2766":{"id":2766,"name":"Sakazuki"},"2767":{"id":2767,"name":"The Isle of Bekko"},"2769":{"id":2769,"name":"Tamamizu"},"2770":{"id":2770,"name":"The Coral Banquet"},"2771":{"id":2771,"name":"Shoal Rock"},"2772":{"id":2772,"name":"Sui-no-Sato"},"2773":{"id":2773,"name":"Onokoro"},"2774":{"id":2774,"name":"Crick"},"2775":{"id":2775,"name":"Heaven-on-High","parentId":2401,"size":1},"2776":{"id":2776,"name":"Ten-thousand-year Pine"},"2777":{"id":2777,"name":"Quickscape Pier"},"2778":{"id":2778,"name":"The Turquoise Trench"},"2779":{"id":2779,"name":"Shisui of the Violet Tides","parentId":2401,"size":2},"2780":{"id":2780,"name":"The Adventure"},"2781":{"id":2781,"name":"The Kobayashi Maru"},"2782":{"id":2782,"name":"Saibai Cavern"},"2783":{"id":2783,"name":"Exile"},"2785":{"id":2785,"name":"Isari"},"2786":{"id":2786,"name":"The Isle of Zekki"},"2787":{"id":2787,"name":"The Dive"},"2788":{"id":2788,"name":"The Air of the Opulent"},"2789":{"id":2789,"name":"The Drunken Toad"},"2790":{"id":2790,"name":"Unseen Spirits Laughing"},"2791":{"id":2791,"name":"The Heron's Flight"},"2792":{"id":2792,"name":"The Heron's Way"},"2793":{"id":2793,"name":"Namai"},"2794":{"id":2794,"name":"Plum Spring"},"2796":{"id":2796,"name":"Western Ryurin Bridge"},"2797":{"id":2797,"name":"Eastern Ryurin Bridge"},"2798":{"id":2798,"name":"Kusakari"},"2799":{"id":2799,"name":"Castrum Fluminis","parentId":2401,"size":4},"2800":{"id":2800,"name":"Yuzuka Manor"},"2801":{"id":2801,"name":"The Swallow's Compass","parentId":2401,"size":2},"2804":{"id":2804,"name":"Imperial Hypersonic Assault Craft L-XXIII"},"2805":{"id":2805,"name":"The House of the Fierce","parentId":2401,"size":4,"weatherRate":84},"2806":{"id":2806,"name":"The Ribbons"},"2807":{"id":2807,"name":"Prism Lake"},"2808":{"id":2808,"name":"Monzen"},"2809":{"id":2809,"name":"Mercantile Docks"},"2810":{"id":2810,"name":"Doma Castle","parentId":2401,"size":2},"2811":{"id":2811,"name":"The Coattails"},"2813":{"id":2813,"name":"The Doman Enclave","parentId":2401,"size":4,"weatherRate":84},"2814":{"id":2814,"name":"Reunion"},"2815":{"id":2815,"name":"Ragill's Reckoning"},"2816":{"id":2816,"name":"The Path of the Craven"},"2817":{"id":2817,"name":"Hak Khaal"},"2818":{"id":2818,"name":"Rai Khaal"},"2820":{"id":2820,"name":"Kahkol Iloh"},"2821":{"id":2821,"name":"Mol Iloh"},"2822":{"id":2822,"name":"The Dawn Throne"},"2823":{"id":2823,"name":"Azim Khaat"},"2824":{"id":2824,"name":"The Bridge of the High Rule Warriors"},"2827":{"id":2827,"name":"The House of the Crooked Coin"},"2828":{"id":2828,"name":"Tao Khaal"},"2829":{"id":2829,"name":"Moonrise"},"2830":{"id":2830,"name":"The Tail Mountains"},"2832":{"id":2832,"name":"Chakha Zoh"},"2833":{"id":2833,"name":"Bardam's Mettle","parentId":2401,"size":2},"2834":{"id":2834,"name":"Ceol Aen"},"2835":{"id":2835,"name":"The Uyagir Caves"},"2836":{"id":2836,"name":"The Hundred-and-one Revelations"},"2837":{"id":2837,"name":"Qerel Iloh"},"2838":{"id":2838,"name":"The Dusk Throne"},"2842":{"id":2842,"name":"Dotharl Khaa"},"2843":{"id":2843,"name":"Mercantile Docks"},"2844":{"id":2844,"name":"Doman Enclave Docks"},"2847":{"id":2847,"name":"Kienkan","parentId":2401,"size":4},"2848":{"id":2848,"name":"Shazenkai"},"2849":{"id":2849,"name":"Doman Enclave Aetheryte Plaza"},"2850":{"id":2850,"name":"Dhoro Iloh"},"2852":{"id":2852,"name":"The Ten Thousand Stalls"},"2853":{"id":2853,"name":"The Yard"},"2854":{"id":2854,"name":"The Enclave Demesne"},"2855":{"id":2855,"name":"Rissai-juku"},"2856":{"id":2856,"name":"The Enclave Barracks"},"2857":{"id":2857,"name":"The Watchtower"},"2858":{"id":2858,"name":"The One Garden"},"2862":{"id":2862,"name":"Eorzean Alliance Headquarters","parentId":2400,"size":4},"2863":{"id":2863,"name":"Garlean Legion Tents","parentId":2400,"size":4},"2876":{"id":2876,"name":"Central Point"},"2877":{"id":2877,"name":"The West Val River Bank"},"2878":{"id":2878,"name":"The Val River Source"},"2879":{"id":2879,"name":"The East Val River Bank"},"2880":{"id":2880,"name":"Headquarters Entrance"},"2890":{"id":2890,"name":"The Crystal Dragon's Bloom"},"2906":{"id":2906,"name":"Shiokaze Hostelry"},"2907":{"id":2907,"name":"Tenkonto"},"2908":{"id":2908,"name":"Umineko Teahouse"},"2909":{"id":2909,"name":"The Statue of Zuiko"},"2910":{"id":2910,"name":"Bokairo Inn","parentId":2402,"size":4,"weatherRate":82},"2911":{"id":2911,"name":"Bokaisen Hot Springs"},"2912":{"id":2912,"name":"Matsuba Square"},"2913":{"id":2913,"name":"Matsuba Gate"},"2914":{"id":2914,"name":"Sanjo Hanamachi"},"2915":{"id":2915,"name":"Sekiseigumi Barracks"},"2917":{"id":2917,"name":"The Mujikoza"},"2918":{"id":2918,"name":"San-ban Kura"},"2919":{"id":2919,"name":"Go-ban Kura"},"2920":{"id":2920,"name":"Kokajiya"},"2921":{"id":2921,"name":"Kugane Ofunakura"},"2922":{"id":2922,"name":"The Kuroboro Maru"},"2923":{"id":2923,"name":"The Ruby Bazaar"},"2924":{"id":2924,"name":"Rakusui Gardens"},"2925":{"id":2925,"name":"Garlean Consulate"},"2926":{"id":2926,"name":"Thavnairian Consulate"},"2927":{"id":2927,"name":"Ruby Bazaar Offices","parentId":2402,"size":4},"2928":{"id":2928,"name":"Tasogare Bridge"},"2929":{"id":2929,"name":"Pier #2 Ferry Docks"},"2930":{"id":2930,"name":"Airship Landing"},"2931":{"id":2931,"name":"Kugane Aetheryte Plaza"},"2949":{"id":2949,"name":"Norvrandt","parentId":2949,"size":1},"2950":{"id":2950,"name":"Norvrandt","parentId":2950,"size":1},"2951":{"id":2951,"name":"The Crystarium","parentId":2950,"size":2,"weatherRate":112},"2952":{"id":2952,"name":"Eulmore - The Buttress","parentId":2950,"size":2,"weatherRate":113},"2953":{"id":2953,"name":"Lakeland","parentId":2950,"size":1,"weatherRate":106},"2954":{"id":2954,"name":"Kholusia","parentId":2950,"size":1,"weatherRate":107},"2955":{"id":2955,"name":"Amh Araeng","parentId":2950,"size":1,"weatherRate":108},"2956":{"id":2956,"name":"Il Mheg","parentId":2950,"size":1,"weatherRate":109},"2957":{"id":2957,"name":"The Rak'tika Greatwood","parentId":2950,"size":1,"weatherRate":110},"2958":{"id":2958,"name":"The Tempest","parentId":2950,"size":1,"weatherRate":111},"3036":{"id":3036,"name":"The Forest of the Lost Shepherd"},"3037":{"id":3037,"name":"The Exarch Gate"},"3038":{"id":3038,"name":"Weathering"},"3040":{"id":3040,"name":"Embrasure"},"3041":{"id":3041,"name":"The Accensor Gate"},"3042":{"id":3042,"name":"The Belt"},"3043":{"id":3043,"name":"The Chiliad"},"3044":{"id":3044,"name":"Fort Jobb"},"3045":{"id":3045,"name":"The Church of the First Light"},"3046":{"id":3046,"name":"The Bridges"},"3047":{"id":3047,"name":"Radisca's Round"},"3049":{"id":3049,"name":"Northern Staging Point"},"3051":{"id":3051,"name":"Clearmelt"},"3052":{"id":3052,"name":"Inviolate Witness"},"3053":{"id":3053,"name":"Laxan Loft"},"3054":{"id":3054,"name":"The Hanging Tower"},"3056":{"id":3056,"name":"Hare Among Giants"},"3057":{"id":3057,"name":"The Ostall Imperative"},"3058":{"id":3058,"name":"Wolves of Shadow"},"3060":{"id":3060,"name":"Weed"},"3061":{"id":3061,"name":"Brick"},"3062":{"id":3062,"name":"Knot"},"3063":{"id":3063,"name":"Lap"},"3064":{"id":3064,"name":"Dampsole"},"3065":{"id":3065,"name":"The Hour of Certain Durance"},"3066":{"id":3066,"name":"Mortal Irons"},"3067":{"id":3067,"name":"The Thirstless Shore"},"3068":{"id":3068,"name":"The Isle of Ken"},"3070":{"id":3070,"name":"The Bright Cliff"},"3071":{"id":3071,"name":"Shadow Fault"},"3072":{"id":3072,"name":"Scree"},"3074":{"id":3074,"name":"Cracked Shell Beach"},"3075":{"id":3075,"name":"Stilltide"},"3076":{"id":3076,"name":"The Leaky Keel"},"3077":{"id":3077,"name":"Governor's Row"},"3080":{"id":3080,"name":"Slowroad"},"3081":{"id":3081,"name":"Southern Crossing"},"3084":{"id":3084,"name":"The Codger's Crook"},"3085":{"id":3085,"name":"Gatetown"},"3086":{"id":3086,"name":"Open Arms"},"3087":{"id":3087,"name":"The Whale's Breach"},"3089":{"id":3089,"name":"The Clave"},"3090":{"id":3090,"name":"Seagazer"},"3091":{"id":3091,"name":"Stonegazer"},"3092":{"id":3092,"name":"Venmont Yards"},"3093":{"id":3093,"name":"The Split Hull"},"3094":{"id":3094,"name":"Wright"},"3096":{"id":3096,"name":"Whisperwind Cove"},"3097":{"id":3097,"name":"Bottom Rung"},"3098":{"id":3098,"name":"The Ladder"},"3100":{"id":3100,"name":"Sharptongue Drip"},"3101":{"id":3101,"name":"The Lawns"},"3102":{"id":3102,"name":"Top Rung"},"3103":{"id":3103,"name":"Amity"},"3104":{"id":3104,"name":"Pit 8"},"3105":{"id":3105,"name":"Tomra"},"3106":{"id":3106,"name":"The Quick Way"},"3107":{"id":3107,"name":"The Southern Hills of Amber"},"3108":{"id":3108,"name":"Upper Watts River"},"3109":{"id":3109,"name":"Boiled Owl Bridge"},"3110":{"id":3110,"name":"Flue Bridge"},"3111":{"id":3111,"name":"Komra"},"3112":{"id":3112,"name":"The Duergar's Tewel"},"3113":{"id":3113,"name":"Dwarven Hollows"},"3114":{"id":3114,"name":"Qasr Sharl"},"3115":{"id":3115,"name":"The Fields of Amber"},"3116":{"id":3116,"name":"The Northern Hills of Amber"},"3117":{"id":3117,"name":"The Central Hills of Amber"},"3118":{"id":3118,"name":"Nabaath Areng"},"3119":{"id":3119,"name":"The Red Serai"},"3120":{"id":3120,"name":"The River of Sand"},"3121":{"id":3121,"name":"Samiel's Backbone"},"3122":{"id":3122,"name":"Mord Souq"},"3123":{"id":3123,"name":"The Rack"},"3127":{"id":3127,"name":"Snitch"},"3128":{"id":3128,"name":"Twitch"},"3129":{"id":3129,"name":"The Inn at Journey's Head"},"3130":{"id":3130,"name":"The Derrick"},"3131":{"id":3131,"name":"The Nabaath Severance"},"3132":{"id":3132,"name":"Mount Biran Mines"},"3133":{"id":3133,"name":"Garik"},"3134":{"id":3134,"name":"The Dragging Tail"},"3135":{"id":3135,"name":"Twine"},"3136":{"id":3136,"name":"Kelk"},"3137":{"id":3137,"name":"Lift Station"},"3138":{"id":3138,"name":"Nuvy's Leavings"},"3140":{"id":3140,"name":"Ladle"},"3141":{"id":3141,"name":"Lift Station"},"3142":{"id":3142,"name":"The Pristine Palace of Amh Malik"},"3144":{"id":3144,"name":"Timh Gyeus"},"3145":{"id":3145,"name":"Longmirror Lake"},"3146":{"id":3146,"name":"Voeburtenburg"},"3147":{"id":3147,"name":"Lydha Lran"},"3148":{"id":3148,"name":"Phisor Lran"},"3150":{"id":3150,"name":"The Bookman's Shelves"},"3151":{"id":3151,"name":"Handmirror Lake"},"3153":{"id":3153,"name":"The House of the First Light"},"3155":{"id":3155,"name":"Good Jenanna's Grace"},"3156":{"id":3156,"name":"Pla Enni"},"3157":{"id":3157,"name":"Wolekdorf"},"3158":{"id":3158,"name":"Sextuplet Shallow"},"3159":{"id":3159,"name":"The Church at Dammroen Field"},"3161":{"id":3161,"name":"Saint Fathric's Temple"},"3162":{"id":3162,"name":"Anden's Airs"},"3163":{"id":3163,"name":"Old Earra Bridge"},"3164":{"id":3164,"name":"Lyhe Ghiah"},"3166":{"id":3166,"name":"Lake Tusi Mek'ta"},"3167":{"id":3167,"name":"The Blind Forest of Yx'Maja"},"3169":{"id":3169,"name":"Fort Gohn"},"3170":{"id":3170,"name":"Slitherbough"},"3171":{"id":3171,"name":"The Darker"},"3172":{"id":3172,"name":"Cleric"},"3173":{"id":3173,"name":"Lozatl's Conquest"},"3174":{"id":3174,"name":"Woven Oath"},"3175":{"id":3175,"name":"The Womb"},"3176":{"id":3176,"name":"Fruit of the Protector"},"3177":{"id":3177,"name":"The Husk"},"3178":{"id":3178,"name":"The Covered Halls of Dwatl"},"3179":{"id":3179,"name":"Fanow"},"3180":{"id":3180,"name":"Sleepaway Common"},"3181":{"id":3181,"name":"The Wild Fete"},"3182":{"id":3182,"name":"Bowrest"},"3183":{"id":3183,"name":"Mjrl's Regret"},"3185":{"id":3185,"name":"The Morning Stars"},"3186":{"id":3186,"name":"Ox'Gatorl Mul"},"3187":{"id":3187,"name":"Yx'Lokwa Mul"},"3188":{"id":3188,"name":"Ox'Charl Mul"},"3189":{"id":3189,"name":"Yx'Anpa Mul"},"3190":{"id":3190,"name":"The Great Pyramid of Ux'ner "},"3191":{"id":3191,"name":"The Confessional of Toupasa the Elder"},"3192":{"id":3192,"name":"The Norvrandt Slope"},"3193":{"id":3193,"name":"The Caliban Gorge"},"3194":{"id":3194,"name":"Amaurot"},"3195":{"id":3195,"name":"The Ondo Cups"},"3197":{"id":3197,"name":"The Workbench"},"3199":{"id":3199,"name":"Where the Dry Return"},"3200":{"id":3200,"name":"Walls of the Forgotten"},"3202":{"id":3202,"name":"The Caliban Gap"},"3203":{"id":3203,"name":"Achora Heights"},"3204":{"id":3204,"name":"The Polyleritae District"},"3205":{"id":3205,"name":"The Macarenses Angle"},"3206":{"id":3206,"name":"The Hall of Rhetoric"},"3207":{"id":3207,"name":"Bureau of the Architect"},"3208":{"id":3208,"name":"Bureau of the Administrator"},"3209":{"id":3209,"name":"Bureau of the Secretariat"},"3210":{"id":3210,"name":"The Capitol"},"3219":{"id":3219,"name":"The Crown of the Immaculate","parentId":2950,"size":1,"weatherRate":102},"3221":{"id":3221,"name":"The Syrcus Trench","parentId":26,"size":4},"3223":{"id":3223,"name":"The Ocular","parentId":2950,"size":4},"3240":{"id":3240,"name":"Tessellation"},"3241":{"id":3241,"name":"The Crystarium Aetheryte Plaza"},"3242":{"id":3242,"name":"The Exedra"},"3244":{"id":3244,"name":"The Dossal Gate"},"3246":{"id":3246,"name":"Temenos Rookery"},"3248":{"id":3248,"name":"The Crystalline Mean"},"3249":{"id":3249,"name":"Spagyrics"},"3250":{"id":3250,"name":"Ballistics"},"3251":{"id":3251,"name":"The Cabinet of Curiosity"},"3252":{"id":3252,"name":"The Whispering Gallery"},"3253":{"id":3253,"name":"The Hortorium"},"3254":{"id":3254,"name":"Musica Universalis"},"3255":{"id":3255,"name":"The Wandering Stairs"},"3256":{"id":3256,"name":"The Catenaries"},"3257":{"id":3257,"name":"Sweetsieve"},"3263":{"id":3263,"name":"The Glory Gate"},"3264":{"id":3264,"name":"Nightsoil Pots"},"3265":{"id":3265,"name":"Joyous Hall"},"3266":{"id":3266,"name":"The Bureau of Immigration"},"3267":{"id":3267,"name":"The Bureau of Registration"},"3268":{"id":3268,"name":"The Delousery"},"3269":{"id":3269,"name":"Customs Office A-1"},"3270":{"id":3270,"name":"Customs Office A-2"},"3271":{"id":3271,"name":"Customs Hold"},"3273":{"id":3273,"name":"Eulmoran Army Headquarters"},"3274":{"id":3274,"name":"The Mainstay"},"3275":{"id":3275,"name":"Eulmore Aetheryte Plaza"},"3276":{"id":3276,"name":"The Grand Dame's Parlor"},"3277":{"id":3277,"name":"The Beehive"},"3278":{"id":3278,"name":"The Crown Lift"},"3279":{"id":3279,"name":"Skyfront"},"3288":{"id":3288,"name":"The Pendants"},"3289":{"id":3289,"name":"The Trivium"},"3290":{"id":3290,"name":"The Quadrivium"},"3291":{"id":3291,"name":"Crystarium Personal Suites"},"3292":{"id":3292,"name":"The Rift of Sighs"},"3293":{"id":3293,"name":"The Rusted Reservoir"},"3294":{"id":3294,"name":"The Source"},"3295":{"id":3295,"name":"Sullen"},"3296":{"id":3296,"name":"The Isle of Ken"},"3297":{"id":3297,"name":"Upper Watts River"},"3298":{"id":3298,"name":"White Oil Falls"},"3299":{"id":3299,"name":"Lower Watts River"},"3300":{"id":3300,"name":"Sharptongue Drip"},"3301":{"id":3301,"name":"The Western Kholusian Coast"},"3302":{"id":3302,"name":"Seagazer Shoals"},"3303":{"id":3303,"name":"The Eastern Kholusian Coast"},"3304":{"id":3304,"name":"The Derelicts"},"3305":{"id":3305,"name":"The River of Sand"},"3306":{"id":3306,"name":"The Nabaath Severance"},"3307":{"id":3307,"name":"The Hills of Amber"},"3308":{"id":3308,"name":"Handmirror Lake"},"3309":{"id":3309,"name":"Longmirror Lake"},"3310":{"id":3310,"name":"The Haughty One"},"3311":{"id":3311,"name":"The Jealous One"},"3312":{"id":3312,"name":"The Spoiled One"},"3313":{"id":3313,"name":"Saint Fathric's Temple"},"3314":{"id":3314,"name":"Father Collard's Failings"},"3315":{"id":3315,"name":"Lake Tusi Mek'ta"},"3316":{"id":3316,"name":"The Red Chalice"},"3317":{"id":3317,"name":"The Rotzatl"},"3318":{"id":3318,"name":"South Mjrl's Regret"},"3319":{"id":3319,"name":"Woven Oath"},"3320":{"id":3320,"name":"The Flounders' Floor"},"3321":{"id":3321,"name":"Where the Dry Return"},"3322":{"id":3322,"name":"Northwest Caliban Gorge"},"3323":{"id":3323,"name":"West Caliban Gap"},"3324":{"id":3324,"name":"East Caliban Gap"},"3325":{"id":3325,"name":"Purpure"},"3326":{"id":3326,"name":"The Norvrandt Slope"},"3341":{"id":3341,"name":"Northeast Source"},"3342":{"id":3342,"name":"The Isle of Ken"},"3343":{"id":3343,"name":"Southeast Source"},"3344":{"id":3344,"name":"North Lyhe Ghiah"},"3345":{"id":3345,"name":"Deepwood Swim"},"3346":{"id":3346,"name":"Central Longmirror Lake"},"3347":{"id":3347,"name":"Thysm Lran"},"3348":{"id":3348,"name":"South Longmirror Lake"},"3349":{"id":3349,"name":"North Lake Tusi Mek'ta"},"3350":{"id":3350,"name":"The Covered Halls of Dwatl"},"3352":{"id":3352,"name":"The Path to Glory"},"3354":{"id":3354,"name":"Longbeard Council"},"3355":{"id":3355,"name":"The Wet Whistle"},"3356":{"id":3356,"name":"Mithai Glorianda"},"3358":{"id":3358,"name":"The Woolen Way"},"3361":{"id":3361,"name":"The Trip"},"3362":{"id":3362,"name":"Dyers' Wash"},"3363":{"id":3363,"name":"The Deliberating Doll"},"3364":{"id":3364,"name":"The Rotzatl"},"3365":{"id":3365,"name":"The Red Chalice"},"3367":{"id":3367,"name":"The Isle of Sisters"},"3369":{"id":3369,"name":"The Trinculo Shelf"},"3371":{"id":3371,"name":"The Gangway"},"3373":{"id":3373,"name":"The Ox'Dalan Gap"},"3374":{"id":3374,"name":"Amarokeep"}}
