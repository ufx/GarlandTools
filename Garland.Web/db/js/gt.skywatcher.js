gt.skywatcher = {
    type: 'skywatcher',
    blockTemplate: null,
    weatherIndex: null,
    weatherRateIndex: null,
    regions: [
        { icon: "images/region/La Noscea.png", name: "La Noscea", page: "LaNoscea", zones: [27, 30, 31, 32, 33, 34, 350, 358, 425] },
        { icon: "images/region/Black Shroud.png", name: "The Black Shroud", page: "TheBlackShroud", zones: [39, 54, 55, 56, 57, 426] },
        { icon: "images/region/Thanalan.png", name: "Thanalan", page: "Thanalan", zones: [51, 42, 43, 44, 45, 46, 427] },
        { icon: "images/region/Ishgard.png", name: "Ishgard and Surrounds", page: "Ishgard", zones: [62, 63, 2200, 2100, 2101, 2082, 2000, 2001, 2002, 1647] },
        { icon: "images/region/Gyr Abania.png", name: "Gyr Abania", page: "GyrAbania", zones: [2403, 2406, 2407, 2408] },
        { icon: "images/region/Kugane.png", name: "Far East", page: "FarEast", zones: [513, 2412, 2409, 2410, 2411, 3534, 3662] },
        { icon: "images/region/Ilsabard.png", name: "Ilsabard", page: "Ilsabard", zones: [3707, 3709, 3710, 2414, 2462, 2530, 2545] },
        { icon: "images/region/Norvrandt.png", name: "Norvrandt", page: "Norvrandt", zones: [516, 517, 2953, 2954, 2955, 2956, 2957, 2958], },
        { icon: "images/marker/Aetheryte.png", name: "Others", page: "Others", zones: [67, 3706, 3708, 3711, 3712, 3713] }
    ],
    weatherUpdateKey: null,
    lWeatherStart: null,
    lWeatherEnd: null,

    initialize: function(settings) {
        gt.skywatcher.blockTemplate = doT.template($('#block-skywatcher-template').text());
    },

    bindEvents: function($block, data, view) {
        $('.zone .icon', $block).click(gt.skywatcher.weatherClicked);
        gt.display.notifications($block, data);
    },

    getViewModel: function(id, data) {
        gt.skywatcher.ensureWeatherUpdate();

        var maxWeather = 15;
        var view = {
            id: id,
            type: 'skywatcher',
            name: 'Skywatcher',
            template: gt.skywatcher.blockTemplate,
            blockClass: 'tool noexpand',
            icon: 'images/marker/Skywatcher.png',
            subheader: 'Weather Forecast Tool',
            tool: 1,
            settings: 1,

            regions: [],
            localTimestamps: [],
            eorzeaTimestamps: []
        };

        // Show weather by region.
        var lStart = gt.skywatcher.lWeatherStart;
        var lEnd = gt.skywatcher.lWeatherEnd;
        var eStart = gt.time.localToEorzea(lStart);
        eStart.setUTCHours(eStart.getUTCHours() - 8); // Show the previous weather for transitions.

        view.initialChangeTime = gt.time.formatTime(lEnd, gt.time.hoursMinutes);
        view.initialProgressPercent = gt.time.getPercentTimeDifference(lStart, lEnd);
        view.initialTimeRemaining = gt.time.formatCountdown(lEnd);

        for (var ri = 0; ri < gt.skywatcher.regions.length; ri++) {
            var region = gt.skywatcher.regions[ri];
            var zones = region.zones;
            var regionView = { icon: region.icon, name: region.name, page: region.page, zones: [] };
            view.regions.push(regionView);

            for (var zi = 0; zi < zones.length; zi++) {
                var zone = gt.location.index[zones[zi]];
                if (!zone)
                    continue;
                var zoneView = { id: zone.id, weather: [] };
                zoneView.name = gt.skywatcher.getShortZoneName(zone.name);
                regionView.zones.push(zoneView);

                // Now fill in the zone weather
                gt.skywatcher.iterateWeather(eStart, zone, function(weather) {
                    zoneView.weather.push(weather);
                    return zoneView.weather.length >= maxWeather;
                });
            }
        }

        // Store timestamps.
        var eCurrent = new Date(eStart);
        for (var i = 0; i < maxWeather; i++) {
            view.localTimestamps.push(gt.time.formatTime(gt.time.eorzeaToLocal(eCurrent)));
            view.eorzeaTimestamps.push(gt.time.formatEorzeaHour(eCurrent));
            eCurrent.setUTCHours(eCurrent.getUTCHours() + 8);
        }

        // Calculate the next occurrence for favorites.
        if (data.favorites) {
            view.audio = 1;
            view.favorites = [];

            for (var i = 0; i < data.favorites.length; i++) {
                var favorite = data.favorites[i];
                var zone = gt.location.index[favorite.id];
                if (zone) {
                    var favoriteView = gt.skywatcher.getFavoriteView(zone, favorite.weather)
                    view.favorites.push(favoriteView);
                }
            }

            view.favorites = _.sortBy(view.favorites, function(f) { return f.lProgressEnd; });
        }

        return view;
    },

    getFavoriteView: function(zone, weather) {
        var eStart = gt.time.localToEorzea(gt.skywatcher.lWeatherStart);
        var eNow = gt.time.eCurrentTime();

        // First find the last time this zone had that weather.  It could be active now.
        var eCurrent = new Date(eStart);
        var lProgressStart = null;
        var type = null;
        while (true) {
            var lCurrent = gt.time.eorzeaToLocal(eCurrent);
            var currentWeather = gt.skywatcher.forecast(lCurrent, zone);
            if (currentWeather == weather) {
                eCurrent.setUTCHours(eCurrent.getUTCHours() + 8);
                if (eNow < eCurrent) {
                    // The weather is currently active.  Mark when it started.
                    type = 'active';
                    lProgressStart = lCurrent;
                } else  {
                    // The weather is over.  Mark when it ended.
                    type = 'dormant';
                    lProgressStart = gt.time.eorzeaToLocal(eCurrent);
                }

                break;
            }

            eCurrent.setUTCHours(eCurrent.getUTCHours() - 8);
        }

        // Now find when the weather starts again, or the active pattern ends.
        eCurrent = new Date(eStart);
        var lProgressEnd = null;
        while (true) {
            eCurrent.setUTCHours(eCurrent.getUTCHours() + 8);
            var lCurrent = gt.time.eorzeaToLocal(eCurrent);
            var currentWeather = gt.skywatcher.forecast(lCurrent, zone);
            var isTarget = currentWeather == weather;
            if ((isTarget && type == 'dormant') || (!isTarget && type == 'active')) {
                // The weather will now occur, or active weather has ended.
                lProgressEnd = lCurrent;
                break;
            }
        }

        var view = { zone: zone, weather: weather, type: type, lProgressStart: lProgressStart, lProgressEnd: lProgressEnd };
        view.name = gt.skywatcher.getShortZoneName(zone.name);
        view.initialChangeTime = gt.time.formatTime(lProgressEnd, gt.time.hoursMinutes) + ' (ET ' + gt.time.formatTime(gt.time.localToEorzea(lProgressEnd), gt.time.hoursMinutesUTC) + ')';
        view.initialProgressPercent = gt.time.getPercentTimeDifference(lProgressStart, lProgressEnd);
        view.initialTimeRemaining = gt.time.formatCountdown(lProgressEnd);
        return view;
    },

    forecast: function(lDate, loc) {
        var weatherRate = gt.skywatcher.weatherRateIndex[loc.weatherRate];
        if (!weatherRate) {
            console.error("No weather rates for zone", loc);
            return null;
        }

        var forecastTarget = gt.skywatcher.calculateForecastTarget(lDate);
        var rate = _.find(weatherRate.rates, function(r) { return forecastTarget < r.rate; });
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

    ensureWeatherUpdate: function() {
        if (gt.skywatcher.weatherUpdateKey)
            return;

        var eStart = gt.skywatcher.getWeatherInterval();
        gt.skywatcher.lWeatherStart = gt.time.eorzeaToLocal(eStart);;

        var eEnd = new Date(eStart);
        eEnd.setUTCHours(eEnd.getUTCHours() + 8);
        gt.skywatcher.lWeatherEnd = gt.time.eorzeaToLocal(eEnd);

        gt.skywatcher.weatherUpdateKey = setInterval(gt.skywatcher.weatherUpdate, 1000);
    },
    
    weatherUpdate: function() {
        var $block = $('.skywatcher.block');
        if (!$block.length) {
            clearInterval(gt.skywatcher.weatherUpdateKey);
            gt.skywatcher.weatherUpdateKey = null;
            return;
        }

        var lChangeStart = gt.skywatcher.lWeatherStart;
        var lChangeEnd = gt.skywatcher.lWeatherEnd;

        var now = new Date();
        if (now > lChangeEnd) {
            // Rollover time!
            gt.skywatcher.lWeatherStart = lChangeEnd;

            var eEnd = gt.time.localToEorzea(lChangeEnd);
            eEnd.setUTCHours(eEnd.getUTCHours() + 8);
            gt.skywatcher.lWeatherEnd = gt.time.eorzeaToLocal(eEnd);

            gt.core.redisplay($block);
            return;
        }

        // Update change progress and countdown.
        var changePercent = gt.time.getPercentTimeDifference(lChangeStart, lChangeEnd);
        var changeCountdown = gt.time.formatCountdown(lChangeEnd);
        $('.weather-change .progress', $block).css('width', changePercent + '%');
        $('.weather-change .time-remaining', $block).text(changeCountdown);

        // Update favorites.
        var view = $block.data('view');
        if (!view || !view.favorites)
            return;

        var data = $block.data('block');

        for (var i = 0; i < view.favorites.length; i++) {
            var favorite = view.favorites[i];
            var $favorite = $('.favorite[data-zoneid=' + favorite.zone.id + '][data-weather="' + favorite.weather + '"]', $block);

            var percent = gt.time.getPercentTimeDifference(favorite.lProgressStart, favorite.lProgressEnd);
            var countdown = gt.time.formatCountdown(favorite.lProgressEnd);
            $('.time-remaining', $favorite).text(countdown);
            $('.progress', $favorite).css('width', percent + '%');

            if (data.alarms && favorite.type == 'dormant' && countdown == '2:00' && gt.settings.data.notifications) {
                gt.display.playWarningAlarm();
                gt.skywatcher.notifyWeather(favorite);
            }
        }
    },

    notifyWeather: function(favorite) {
        if (!window.Notification || window.Notification.permission != "granted")
            return;

        gt.util.showNotification(favorite.weather, {
            icon: '../files/icons/weather/' + favorite.weather + '.png',
            body: favorite.zone.name
        });
    },

    iterateWeather: function(eStart, zone, callback)  {
        var eCurrent = new Date(eStart);
        eCurrent.setUTCHours(eCurrent.getUTCHours() - 8);
        var transitionWeather = gt.skywatcher.forecast(gt.time.eorzeaToLocal(eCurrent), zone);
        for (var i = 0; i < 2000; i++) {
            eCurrent.setUTCHours(eCurrent.getUTCHours() + 8);
            var weather = gt.skywatcher.forecast(gt.time.eorzeaToLocal(eCurrent), zone);
            var result = callback(weather, transitionWeather, eCurrent);
            if (result)
                return result;

            transitionWeather = weather;
        }

        console.error('Infinite iteration detected', zone.name, eStart);
    },

    calculateWindow: function(lStart, options) {
        var zone = gt.location.index[options.zone];
        var eStart = lStart ? gt.time.localToEorzea(lStart) : gt.skywatcher.getWeatherInterval();
        eStart.setUTCHours(eStart.getUTCHours() + 8); // Advance by one iteration.

        var hourCheck = null;
        if (options.during) {
            if (options.during.start < options.during.end)
                hourCheck = function(h) { return h >= options.during.start && h < options.during.end; };
            else
                hourCheck = function(h) { return h >= options.during.start || h < options.during.end; };
        }

        var lResult = gt.skywatcher.iterateWeather(eStart, zone, function(weather, transitionWeather, eTime) {
            if (options.transition && !_.contains(options.transition, transitionWeather))
                return;

            if (options.weather && !_.contains(options.weather, weather))
                return;

            if (hourCheck) {
                var eCheckTime = new Date(eTime);
                var passes = false;
                // Check all the hours between the time this weather starts and the time it ends.
                for (var i = 0; i < 7; i++) {
                    var hour = eCheckTime.getUTCHours();
                    if (hourCheck(hour)) {
                        eTime = eCheckTime;
                        passes = true;
                        break;
                    }

                    eCheckTime.setUTCHours(hour + 1);
                }

                if (!passes)
                    return;
            }

            // All checks passed, it's happening!!

            if (options.after) {
                // Eorzea Time Transforms
                if (options.after.eorzeaHours)
                    eTime.setUTCHours(eTime.getUTCHours() + options.after.eorzeaHours);
            }

            return gt.time.eorzeaToLocal(eTime);
        });

        return lResult;
    },

    weatherClicked: function(e) {
        var $this = $(this);
        var $zone = $this.closest('.zone');
        var $block = $zone.closest('.block');

        var data = $block.data('block');
        if (!data.favorites)
            data.favorites = [];

        var weather = $this.data('weather');
        var locationid = $zone.data('zoneid');
        var index = _.findIndex(data.favorites, function(f) { return f.id == locationid && f.weather == weather; });
        if (index == -1)
            data.favorites.push({id: locationid, weather: weather});
        else
            data.favorites.splice(index, 1);

        gt.core.redisplay($block);
        gt.settings.saveDirty();
    },

    getShortZoneName: function(name) {
        if (name == "Coerthas Central Highlands")
            return "C. Central Highlands";
        if (name == "Coerthas Western Highlands")
            return "C. Western Highlands";

        return name;
    }
};
