gt.time = {
    epochTimeFactor: 20.571428571428573, // 60 * 24 Eorzean minutes (one day) per 70 real-world minutes.
    millisecondsPerEorzeaMinute: (2 + 11/12) * 1000,
    millisecondsPerDay: 24 * 60 * 60 * 1000,
    moons: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'],
    hours: {hour: '2-digit'},
    hoursMinutes: {hour: '2-digit', minute: '2-digit'},
    hoursMinutesUTC: {hour: '2-digit', minute: '2-digit', timeZone: 'UTC'},
    hoursMinutesSeconds: {hour: '2-digit', minute: '2-digit', second: '2-digit'},
    monthDay: {month: 'numeric', day: 'numeric'},
    blockTemplate: null,
    timeUpdateKey: null,
    timerUpdateKey: null,
    is24Hour: false,
    languageCode: "en-US",

    initialize: function(settings) {
        gt.time.blockTemplate = doT.template($('#block-time-template').text());

        try {
            var sample = (new Date()).toLocaleTimeString(navigator.language);
            if (sample.indexOf('M') == -1)
                gt.time.is24Hour = true;

            gt.time.languageCode = navigator.language;
        } catch (ex) {
            console.error("Time formatting failure.  Defaulting to en-US.  navigator.language: ", navigator.language, ex);
            // Sometimes the language here doesn't work.  Fall back to en-US.
        }

        if (settings.eorzeaTimeInTitle)
            gt.time.ensureTimeUpdate();       
    },

    getViewModel: function(id, data) {
        gt.time.ensureTimeUpdate();

        var eTime = gt.time.eCurrentTime();
        var phase = gt.time.moonPhase(eTime);

        return {
            id: id,
            type: 'time',
            name: 'Eorzea Time',
            template: gt.time.blockTemplate,
            blockClass: 'tool noexpand',
            icon: '../files/icons/moon/' + phase.moon + '.png',
            subheader: 'Time Tool',
            tool: 1,

            initialTime: gt.time.formatTime(eTime, gt.time.hoursMinutesUTC),
            initialPeriod: gt.time.getTimePeriod(eTime),
            moon: phase.moon,
            moonPercent: phase.percent
        };
    },

    getTimePeriod: function(eTime) {
        var hours = eTime.getUTCHours();
        if (hours < 6)
            return 'night';
        else if (hours < 12)
            return 'morning';
        else if (hours < 18)
            return 'day';
        else
            return 'dusk';
    },

    ensureTimeUpdate: function() {
        if (gt.time.timeUpdateKey)
            return;

        gt.time.timeUpdateKey = setInterval(gt.time.timeUpdate, gt.time.millisecondsPerEorzeaMinute);
    },

    timeUpdate: function() {
        var $blocks = $('.time.block');
        if (!gt.settings.data.eorzeaTimeInTitle && !$blocks.length)
            return;

        var eTime = gt.time.eCurrentTime();
        var time = gt.time.formatTime(eTime, gt.time.hoursMinutesUTC);

        if (gt.settings.data.eorzeaTimeInTitle)
            $('title').text(time + ' Garland Tools Database');

        if (!$blocks.length)
            return;

        var period = gt.time.getTimePeriod(eTime);

        $('.current-time', $blocks).text(time);

        var $period = $('.time-period', $blocks);
        if (!$period.hasClass(period)) {
            $('.time-period', $blocks).removeClass('night day dusk morning').addClass(period);

            var phase = gt.time.moonPhase(eTime);
            $('.moon, .title-icon', $blocks)
                .attr('src', '../files/icons/moon/' + phase.moon + '.png')
                .attr('title', phase.moon + ", " + phase.percent + "%");
        }

        if (eTime.getUTCMinutes() == 0)
            gt.display.minimap();
    },

    now: function() {
        var date = new Date();
        if (gt.time.timeOffset)
            date.setTime(date.getTime() + gt.time.timeOffset);
        return date;
    },

    localToEorzea: function(date) {
        return new Date(date.getTime() * gt.time.epochTimeFactor);
    },

    eorzeaToLocal: function(date) {
        return new Date(date.getTime() / gt.time.epochTimeFactor);
    },

    eCurrentTime: function() {
        return gt.time.localToEorzea(new Date());
    },

    formatTime: function(date, options) {
        try {
            return date.toLocaleTimeString(gt.time.languageCode, options || gt.time.hoursMinutesSeconds);
        } catch (ex) {
            // Chrome has an undefined timezone problem with some
            // configurations.  Fall back to date.toLocaleTimeString() with no
            // args.  Probably breaks some formatting.
            return date.toLocaleTimeString();
        }
    },

    formatDateTime: function(date) {
        if (!date)
            return '(error)';
        
        return date.toLocaleDateString(gt.time.languageCode, gt.time.monthDay) + ' ' + gt.time.formatTime(date);
    },

    formatEorzeaHour: function(eDate) {
        return gt.util.zeroPad(eDate.getUTCHours(), 2);
    },

    formatHours: function(hour) {
        if (gt.time.is24Hour)
            return hour;

        if (hour == 0)
            hour = 24;

        return ((hour - 1) % 12 + 1) + ' ' + (hour > 11 && hour < 24 ? 'PM' : 'AM');
    },

    getPercentTimeDifference: function(start, end) {
        var start = start.getTime();
        var end = end.getTime();
        var now = (gt.time.now()).getTime();
        return ((now - start) / (end - start)) * 100;
    },

    formatCountdown: function(end) {
        var remainingSeconds = (end.getTime() - (new Date()).getTime()) / 1000;
        if (remainingSeconds <= 0)
            return '0:00';

        var hours = Math.floor(remainingSeconds / 3600);
        var minutes = Math.floor((remainingSeconds % 3600) / 60);
        var seconds = Math.floor((remainingSeconds % 3600) % 60);

        if (hours)
            return hours + ':' + gt.util.zeroPad(minutes, 2) + ':' + gt.util.zeroPad(seconds, 2);
        else
            return minutes + ':' + gt.util.zeroPad(seconds, 2);
    },

    moonPhase: function(eDate) {
        var daysIntoCycle = gt.time.daysIntoLunarCycle(eDate);
        // 16 days until new or full moon.
        var percent = Math.round(((daysIntoCycle % 16) / 16) * 100);
        // 4 days per moon.
        var index = Math.floor(daysIntoCycle / 4);
        return { moon: gt.time.moons[index], percent: percent };
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
    },

    progress: function(current, timer) {
        var period = timer.period;

        // Start from a position of dormancy.
        var progress = {
            start: period.lastExpire,
            end: period.active,
            change: period.active,
            percent: null,
            time: null,
            countdown: null
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

        progress.text = timer.availabilityStateText[progress.state];
        progress.percent = gt.time.getPercentTimeDifference(progress.start, progress.end);
        progress.countdown = gt.time.formatCountdown(progress.start > progress.end ? progress.start : progress.end);

        return progress;
    },

    update: function() {
        var now = gt.time.now();
        var update = false;

        var $timers = $('.block.timer');
        for (var i = 0; i < $timers.length; i++) {
            var $timer = $($timers[i]);
            var view = $timer.data('view');
            var timer = view.timer;

            // Update progress
            if (now > timer.progress.change) {
                timer.next(now);
                timer.progress = gt.time.progress(now, timer);

                $('.progress', $timer).removeClass('spawning active dormant').addClass(timer.progress.state);
            }

            // Update the progress bar.
            timer.progress.percent = gt.time.getPercentTimeDifference(timer.progress.start, timer.progress.end);
            $('.progress', $timer).css('width', timer.progress.percent + '%');

            // Update the remaining time.
            timer.progress.countdown = gt.time.formatCountdown(timer.progress.start > timer.progress.end ? timer.progress.start : timer.progress.end);
            $('.spawn-text', $timer).text(timer.availabilityStateText[timer.progress.state]);
            $('.spawn-time', $timer).text(timer.progress.time);
            $('.spawn-countdown', $timer).text(timer.progress.countdown);

            // Play an alarm if spawning node is a favorite.
            var data = $timer.data('block');
            if (!data || !data.alarms)
                continue;

            if (timer.progress.state == 'spawning') {
                var notify = false;
                if (timer.progress.countdown == '2:00') {
                    gt.display.playWarningAlarm();
                    notify = true;
                } else if (timer.progress.countdown == '0:01') {
                    gt.display.playAvailableAlarm();
                    notify = true;
                }

                if (notify && gt.settings.data.notifications && window.Notification && window.Notification.permission == "granted")
                    timer.notify();
            }
        }
    },

    removeOffset: function(offsetDate) {
        if (!gt.time.timeOffset)
            return offsetDate;

        var date = new Date(offsetDate);
        date.setTime(date.getTime() - gt.time.timeOffset);
        return date;
    },

    ensureTimerUpdate: function() {
        if (!gt.time.timerUpdateKey)
            gt.time.timerUpdateKey = setInterval(gt.time.update, 1000);
    }
};
