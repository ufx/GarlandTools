gt.settings = {
    languageFlagsExpanded: false,
    dirty: false,
    syncTime: 120 * 1000,
    initialSyncTime: 1 * 1000,
    syncDirtyTime: 20 * 1000,
    syncKey: null,

    defaultSearchFilters:  {
        ilvlMin: 0, ilvlMax: 0,
        craftable: 0, desynthable: 0,
        pvp: 0, rarity: 0,
        equippable: 0, category: 0,

        activeSearch: 0
    },

    data: {
        account: null,
        syncModified: null,
        syncEnabled: 0,
        search: null,
        filtersOpen: 0,
        globalSearch: { activePage: '_none', 'filters-menu': { activePage: '_none' } },
        header: { activePage: '_none' },
        current: 'Default',
        lists: { Default: [] },
        path: '',
        items: { },
        craftDepth: 10,
        shorterNames: 1,
        alarmVolume: 50,
        alarmTone: 'alarm1',
        notifications: 1,
        welcome: 0,
        filters: null,
        lang: 'en',
        listHeaderCollapsed: false,
        disableTouch: false,
        colorblind: 0,
        sortMelds: 0,
        unlockHeights: 0,
        craftCategories: { Vendor: 1, Other: 1 },
        minerVentures: 0,
        botanyVentures: 0,
        fisherVentures: 0,
        combatVentures: 0
    },

    getItem: function(id) {
        return gt.settings.data.items[id] || {};
    },

    setItem: function(id, item) {
        if (_.keys(item).length)
            gt.settings.data.items[id] = item;
        else
            delete gt.settings.data.items[id];
        gt.settings.saveDirty();
    },

    saveClean: function(changes) {
        gt.settings.saveCore(changes, false);
    },

    saveDirty: function(changes) {
        gt.settings.saveCore(changes, true);
        console.log('*** Saved dirty change');
    },

    saveCore: function(changes, markDirty) {
        if (changes)
            gt.settings.data = $.extend(gt.settings.data, changes);

        try {
            localStorage.dbSettings = JSON.stringify(gt.settings.data);

            if (markDirty && gt.settings.data.syncEnabled) {
                gt.settings.dirty = true;
                $('body').addClass('dirty');

                gt.settings.startSync(gt.settings.syncDirtyTime);
            }
        } catch (ex) {
            // Ignore.  Can be caused by users blocking access to localStorage, and private browsing modes.
        }
    },

    load: function() {
        var data = null;
        try {
            if (localStorage.dbSettings)
                data = JSON.parse(localStorage.dbSettings);
        } catch (ex) {
            // Ignore.  Can be caused by users blocking access to localStorage, and private browsing modes.
        }

        if (data)
            gt.settings.data = data;
        else
            data = gt.settings.data;

        if (!data.lists)
            data.lists = { Default: [] };

        if (!data.current || !data.lists[data.current]) {
            data.current = _.keys(data.lists)[0];
            if (!data.current || !data.lists[data.current]) {
                data.current = "Default";
                data.lists = { Default: [] };
            }
        }

        if (!data.items)
            data.items = { };

        if (!data.sidebar)
            data.sidebar = { activePage: '_none' };

        if (!data.globalSearch)
            data.globalSearch = { activePage: '_none', 'filters-menu': { activePage: '_none' } };

        if (!data.header)
            data.header = { activePage: '_none' };

        if (!data.craftDepth)
            data.craftDepth = 5;

        if (data.shorterNames === undefined)
            data.shorterNames = 1;

        if (data.alarmVolume === undefined)
            data.alarmVolume = 50;

        if (data.alarmTone === undefined)
            data.alarmTone = 'alarm1';

        if (data.notifications === undefined)
            data.notifications = 1;

        if (!data.filters) // Applied here for new settings too.
            data.filters = $.extend({}, gt.settings.defaultSearchFilters);

        if (!data.lang)
            data.lang = 'en';
            
        if (!data.craftCategories)
            data.craftCategories = { Vendor: 1, Other: 1 };

        gt.settings.bindEvents(data);

        return data;
    },

    // Events

    bindEvents: function(data) {
        $('#craft-depth-setting')
            .val(data.craftDepth)
            .change(gt.settings.craftDepthChanged);

        $('#shorter-names-setting')
            .prop('checked', data.shorterNames)
            .change(gt.settings.shorterNamesChanged);

        $('#alarm-volume')
            .val(data.alarmVolume)
            .change(gt.settings.alarmVolumeChanged);

        $('#warning-tone')
            .val(data.alarmTone)
            .change(gt.settings.alarmToneChanged);

        $('#available-tone')
            .val(data.availableTone)
            .change(gt.settings.availableToneChanged);

        $('#desktop-notifications')
            .prop('checked', data.notifications)
            .change(gt.settings.desktopNotificationsChanged);

        $('#eorzea-time-in-title')
            .prop('checked', data.eorzeaTimeInTitle)
            .change(gt.settings.eorzeaTimeInTitleChanged);

        $('#disable-touch')
            .prop('checked', data.disableTouch)
            .change(gt.settings.disableTouchChanged);

        $('#colorblind-setting')
            .prop('checked', data.colorblind)
            .change(gt.settings.colorblindChanged);

        $('#sort-melds')
            .prop('checked', data.sortMelds)
            .change(gt.settings.sortMeldsChanged);

        $('#unlock-heights')
            .prop('checked', data.unlockHeights)
            .change(gt.settings.unlockHeightsChanged);

        $('#prefer-miner-ventures-setting')
            .prop('checked', data.minerVentures)
            .change(gt.settings.preferMinerVenturesChanged);

        $('#prefer-botany-ventures-setting')
            .prop('checked', data.botanyVentures)
            .change(gt.settings.preferBotanyVenturesChanged);

        $('#prefer-fisher-ventures-setting')
            .prop('checked', data.fisherVentures)
            .change(gt.settings.preferFisherVenturesChanged);

        $('#prefer-combat-ventures-setting')
            .prop('checked', data.combatVentures)
            .change(gt.settings.preferCombatVenturesChanged);

        if (data.colorblind)
            $('body').addClass('colorblind');

        if (data.unlockHeights)
            $('body').addClass('unlock-heights');

        if (!data.shorterNames)
            $('body').addClass('long-names');

        $('.language-flag').click(gt.settings.languageFlagClicked);
        $('.language-flag.' + data.lang).addClass('visible');
        
        $('.settings-page .craft-category')
            .change(gt.settings.craftCategoryChanged);

        var checkboxesByCategory = _.indexBy($('.settings-page .craft-category'), function(c) { return $(c).data('category'); });
        for (var key in data.craftCategories) {
            var checkbox = checkboxesByCategory[key];
            if (checkbox)
                $(checkbox).prop('checked', 1);
        }

        $('#account-key')
            .val(data.account)
            .change(gt.settings.accountKeyChanged);

        if (gt.settings.syncTime)
            $('#last-sync-time').text(data.syncModified);

        $('.sync-page').toggleClass('enabled', data.syncEnabled ? true : false);
        $('#upload-sync').click(gt.settings.uploadSyncClicked);
        $('#download-sync').click(gt.settings.downloadSyncClicked);
        $('#stop-sync').click(gt.settings.stopSyncClicked);
    },

    unlockHeightsChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ unlockHeights: value ? 1 : 0 });
        $('body').toggleClass('unlock-heights', value);
        gt.list.layout();
    },

    shorterNamesChanged: function(e) {
        var value = $(this).is(':checked');
        $('body').toggleClass('long-names', !value);
        gt.settings.saveDirty({ shorterNames: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    craftDepthChanged: function(e) {
        var value = $(this).val();
        gt.settings.saveDirty({ craftDepth: parseInt(value) });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    alarmVolumeChanged: function(e) {
        var value = $(this).val();
        gt.settings.saveDirty({ alarmVolume: parseInt(value) });
        gt.display.playAnyTone();
    },

    alarmToneChanged: function(e) {
        var value = $(this).val();
        gt.settings.saveDirty({ alarmTone: value });
        gt.display.playWarningAlarm();
    },

    availableToneChanged: function(e) {
        var value = $(this).val();
        gt.settings.saveDirty({ availableTone: value });
        gt.display.playAvailableAlarm();
    },

    desktopNotificationsChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ notifications: value ? 1 : 0 });
    },

    eorzeaTimeInTitleChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ eorzeaTimeInTitle: value ? 1 : 0 });

        if (value)
            gt.time.ensureTimeUpdate();
        else
            $('title').text('Garland Tools Database');
    },

    disableTouchChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ disableTouch: value ? 1 : 0 });

        window.location.reload(true);
    },

    colorblindChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ colorblind: value ? 1 : 0 });

        $('body').toggleClass('colorblind', value);
    },

    sortMeldsChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ sortMelds: value ? 1 : 0 });
    },

    languageFlagClicked: function(e) {
        if (gt.settings.languageFlagsExpanded) {
            gt.settings.data.lang = $(this).data('lang');
            gt.settings.saveDirty();
            window.location.reload();
        } else
            $('.language-flag').addClass('visible');

        gt.settings.languageFlagsExpanded = !gt.settings.languageFlagsExpanded;
    },

    craftCategoryChanged: function(e) {
        var $this = $(this);
        var value = $this.is(':checked');
        var category = $this.data('category');
        
        var craftCategories = gt.settings.data.craftCategories;
        if (craftCategories[category])
            delete craftCategories[category];
        else
            craftCategories[category] = 1;

        gt.settings.saveDirty();
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    preferMinerVenturesChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ minerVentures: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    preferBotanyVenturesChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ botanyVentures: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    preferFisherVenturesChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ fisherVentures: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    preferCombatVenturesChanged: function(e) {
        var value = $(this).is(':checked');
        gt.settings.saveDirty({ combatVentures: value ? 1 : 0 });
        gt.settings.redisplayMatchingBlocks('.crafting-page');
    },

    redisplayMatchingBlocks: function(selector) {
        var $matches = $(selector).closest('.block');
        for (var i = 0; i < $matches.length; i++) {
            var $block = $($matches[i]);
            gt.core.redisplay($block);
        }
    },

    accountKeyChanged: function(e) {
        var value = $(this).val();
        gt.settings.saveClean({ account: value });
    },

    downloadSyncClicked: function(e) {
        $('.sync-page').addClass('enabled');
        gt.settings.saveClean({ syncEnabled: 1 });
        gt.settings.dirty = false;
        gt.settings.syncRead();
    },

    uploadSyncClicked: function(e) {
        if (!gt.settings.data.account) {
            // Create an account key.
            gt.settings.saveClean({ account: gt.util.makeId(10) });
            $('#account-key').val(gt.settings.data.account);
        } else if (gt.settings.data.account.length != 10) {
            gt.display.alertp('Account Key must be 10 characters or blank.');
            return;
        }
        
        $('.sync-page').addClass('enabled');
        gt.settings.saveClean({ syncEnabled: 1 });
        gt.settings.dirty = true;
        gt.settings.syncWrite();
    },

    stopSyncClicked: function(e) {
        if (gt.settings.syncKey) {
            clearTimeout(gt.settings.syncKey);
            gt.settings.syncKey = null;
        }

        gt.settings.saveClean({ syncEnabled: 0 });
        $('.sync-page').removeClass('enabled');
    },

    startSync: function(time) {
        if (gt.settings.syncKey)
            clearTimeout(gt.settings.syncKey);
        
        gt.settings.syncKey = setTimeout(gt.settings.sync, time);
    },

    sync: function() {
        if (gt.settings.dirty)
            gt.settings.syncWrite();
        else
            gt.settings.syncRead();
    },

    syncWrite: function() {
        if (!gt.settings.hasValidAccount())
            return;

        var writeData = {
            method: 'write',
            id: 'sync-db',
            account: gt.settings.data.account,
            value: localStorage.dbSettings
        };

        // Clear dirty flag before I/O, in case more work happens
        // during call.
        gt.settings.dirty = false;
        $('body').removeClass('dirty');
        gt.util.post('/api/storage.php', writeData, function(result, error) {
            if (error) {
                gt.display.alertp("Sync write failed: " + error);
                return;
            }

            gt.settings.saveClean({ syncModified: result.modified });
            $('#last-sync-time').text(result.modified);
            gt.settings.startSync(gt.settings.syncTime);
        });
    },

    syncRead: function() {
        if (!gt.settings.hasValidAccount())
            return;

        var readData = {
            method: 'read',
            id: 'sync-db',
            account: gt.settings.data.account,
            modified: gt.settings.data.syncModified || '1900-01-01'
        };

        function onSyncReadResult(result) {
            var oldList = gt.settings.data.current;

            var newData = JSON.parse(result.value);
            newData.syncModified = result.modified;
            console.log('New sync data received', result.modified);
            $('#last-sync-time').text(result.modified);

            gt.settings.data = newData;

            // Preserve the last list this device was on.
            gt.list.current = newData.lists[oldList];
            if (gt.list.current) {
                newData.current = oldList;
                gt.list.reinitialize();
            }
            else {
                // Last list doesn't exist anymore.
                // Switch to the current list in settings.
                gt.list.switchToList(newData.current);
            }

            localStorage.dbSettings = JSON.stringify(newData);
        }

        gt.util.post('/api/storage.php', readData, function(result) {
            try {
                if (result.status == 'ok')
                    onSyncReadResult(result);

                gt.settings.startSync(gt.settings.syncTime);
            } catch (ex) {
                console.error(ex);
                console.error('Sync read error.', result);
            }
        });
    },

    hasValidAccount: function() {
        var data = gt.settings.data;
        return data.account && data.account.length == 10;
    }
};
