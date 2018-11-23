gt.display = {
    current: null,
    nearest: null,
    findFunc: null,
    offsetX: 0,
    offsetY: 0,
    containerOffsetX: 0,
    containerOffsetY: 0,
    isTouchDevice: false,
    downEvent: 'mousedown',
    moveEvent: 'mousemove',
    touchStartX: 0,
    touchStartY: 0,

    minimapSettingsDefault: { maxColumns: 5, maxPages: 3, maxRows: 3 },
    minimapSettingsCollapsed: { maxColumns: 2, maxPages: 1, maxRows: 6 },
    minimapSettings: null,

    initialize: function(data) {
        gt.display.minimapSettings = gt.display.minimapSettingsDefault;

        var $searchSection = $('#search-section');
        $searchSection.data('block', data.globalSearch);
        gt.display.pages($searchSection);

        var $header = $('#header');
        $header.data('block', data.header);
        gt.display.pages($header);

        $('#toggle-sidebar').click(gt.display.toggleSidebarCollapse);
        if (gt.settings.data.sidebar.collapse)
            gt.display.collapseSidebar();
    },

    // Sidebar Collapsing

    toggleSidebarCollapse: function(e) {
        if (gt.settings.data.sidebar.collapse) {
            gt.display.openSidebar(e, $(this));
            gt.settings.data.sidebar.collapse = 0;
        }
        else {
            gt.display.collapseSidebar();
            gt.settings.data.sidebar.collapse = 1;
        }

        gt.list.layout();
        gt.display.minimap();
        gt.settings.save();
    },

    collapseSidebar: function() {
        gt.display.minimapSettings = gt.display.minimapSettingsCollapsed;

        $('body').addClass('sidebar-collapsed');
    },

    openSidebar: function(e, $this) {
        gt.display.minimapSettings = gt.display.minimapSettingsDefault;

        $('body').removeClass('sidebar-collapsed');

        if ($this) {
            var pageName = $this.data('page');
            if (pageName) 
                gt.settings.data.sidebar.activePage = pageName;
        }
    },

    // Paging

    pages: function($container) {
        var $menus = $('.menu', $container);
        if (!$menus.length)
            return;

        var blockData = $container.data('block');
        for (var i = 0; i < $menus.length; i++) {
            var $menu = $($menus[i]);
            var menuData = gt.display.getMenuData($menu, blockData);

            // Find the active button.
            var $buttons = $('> .button[data-page], > .menu-ext > .button[data-page]', $menu);
            if (!$buttons.length)
                continue;

            var shouldOpenDefaultPage = !$menu.hasClass('nodefault') && ($menu.hasClass('noclose') || !gt.display.isTouchDevice || $buttons.length == 1);

            var activeButton = null;
            if (menuData.activePage != '_none') {
                var $matches = $buttons.filter('[data-page=' + menuData.activePage + ']'); 

                if ($matches.length)
                    activeButton = $matches[0];
                else if (shouldOpenDefaultPage)
                    activeButton = $buttons[0];
            }

            if (!activeButton)
                $container.addClass('menu-closed');

            // Set page visibility, configure events.
            gt.display.menuPageCheck($buttons, $container, activeButton);
            $buttons.click(gt.display.menuButtonClicked);

            $container.addClass('menu-initialized');
        }
    },

    getMenuData: function($menu, blockData) {
        var name = $menu.data('menu-name');
        if (!name)
            return blockData;

        if (blockData[name])
            return blockData[name];

        return blockData[name] = {};
    },

    menuButtonClicked: function(e) {
        var $this = $(this);
        var $menu = $this.closest('.menu');
        var $container = $menu.closest('.block, #header, #search-section');
        var blockData = $container.data('block');

        if (!blockData) {
            console.error('No block data found for element');
            return;
        }

        var menuData = gt.display.getMenuData($menu, blockData);
        if (!menuData) {
            console.error('No menu data found for element.', blockData);
            return;
        }

        var activeButton = null;
        if ($this.hasClass('active') && (!$menu.hasClass('noclose') || gt.display.isTouchDevice)) {
            menuData.activePage = '_none';
            $container.addClass('menu-closed');
        }
        else {
            activeButton = this;
            menuData.activePage = $this.data('page');
            $container.removeClass('menu-closed');
        }

        gt.display.menuPageCheck($('> .button, > .menu-ext > .button[data-page]', $menu), $container, activeButton);

        gt.list.resized($container);
        gt.settings.save();
    },

    menuPageCheck: function($buttons, $container, activeButton) {
        for (var i = 0; i < $buttons.length; i++) {
            var button = $buttons[i];
            var $button = $(button);

            var pageName = $button.data('page');
            var $page = $('.' + pageName, $container);
            if (button == activeButton) {
                $button.addClass('active');
                $page.addClass('active');
                $container.trigger({type: 'page-loaded', page: pageName});
            } else {
                $page.removeClass('active');
                $button.removeClass('active');
            }
        }
    },

    // Omniscroll

    omniscroll: function ($container) {
        $('.omniscroll', $container).bind('wheel', gt.display.omniscrollWheel);
    },

    omniscrollWheel: function(e) {
        e.stopPropagation();

        var delta = gt.display.normalizeWheelDelta(e.originalEvent.deltaY);

        var element = $(e.target).closest('.omniscroll')[0];
        element.scrollLeft += (delta / 2);

        return false;
    },

    // Collapsing

    collapsible: function($container) {
        var $collapsibleAreas = $('.collapsible', $container);
        var blockData = $container.data('block');

        for (var i = 0; i < $collapsibleAreas.length; i++) {
            var $collapsibleArea = $($collapsibleAreas[i]);
            var isDefaultVisible = !$collapsibleArea.hasClass('collapsed');
            var headerName = $collapsibleArea.data('headername');
            var isVisible = blockData && blockData.headers ? blockData.headers[headerName] : undefined;
            if (isVisible === undefined)
                isVisible = isDefaultVisible;
            gt.display.toggleCollapseState($collapsibleArea, isVisible);
        }

        var $handle = $('h3, h2', $collapsibleAreas);
        $handle.click(gt.display.collapsibleClicked);
    },

    collapsibleClicked: function(e) {
        // Sometimes an input is inside the clickable area.  Don't perform
        // collapse toggles when it's clicked.
        if (e.target.tagName == "INPUT")
            return;

        var $collapsibleArea = $(this).parent();
        var $block = $collapsibleArea.closest('.block, #sidebar');

        var blockData = $block.data('block');
        if (!blockData.headers)
            blockData.headers = {};

        var headerName = $collapsibleArea.data('headername');
        var isVisible = blockData.headers[headerName];
        if (isVisible === undefined)
            isVisible = !$collapsibleArea.hasClass('collapsed');

        gt.display.toggleCollapseState($collapsibleArea, !isVisible);

        gt.list.resized($block);

        blockData.headers[headerName] = isVisible ? false : true;
        gt.settings.save();
    },

    toggleCollapseState: function($collapsibleArea, isVisible) {
        $collapsibleArea.toggleClass('collapsed', !isVisible);
        $('.collapse-toggle', $collapsibleArea).toggle(isVisible);      
    },

    // Drag and drop

    draggable: function($element) {
        if (gt.display.isTouchDevice)
            return;

        $element.addClass('draggable');

        if ($element.hasClass('handle'))
            $element.bind(gt.display.downEvent, gt.display.draggableDown);
        else
            $('.handle', $element).bind(gt.display.downEvent, gt.display.draggableDown);
    },

    draggableDown: function(e) {
        // Don't try to drag when clicking buttons.
        if ($(e.target).hasClass('button'))
            return false;

        var pos = e.changedTouches ? e.changedTouches[0] : e;

        var $draggable = $(this).closest('.draggable');

        // Disable dragging pinned blocks.
        if ($draggable.closest('#pinned').length)
            return;

        var draggable = $draggable[0];

        // Record some useful offsets.
        gt.display.current = draggable;
        if ($draggable.css('position') == 'absolute') {
            gt.display.offsetX = pos.clientX - draggable.offsetLeft;
            gt.display.offsetY = pos.clientY - draggable.offsetTop;
        } else {
            // Relative
            gt.display.offsetX = pos.clientX;
            gt.display.offsetY = pos.clientY;

            // Reset position
            $draggable.css('top', 0).css('left', 0);
        }

        var $main = $('#main');
        gt.display.containerOffsetX = $main[0].offsetLeft;
        gt.display.containerOffsetY = $main[0].offsetTop;

        $draggable.addClass('dragging');

        gt.display.findFunc = gt.display.findBlockAtPoint;

        $('html')
            .bind('mouseup touchend', gt.display.draggableUp)
            .bind('mousemove touchmove', gt.display.draggableMove)
            .addClass('dragging');

        if ($draggable.hasClass('block'))
            gt.core.setActiveBlock($draggable);
    },

    draggableUp: function(e) {
        var pos = e.changedTouches ? e.changedTouches[0] : e;

        $('html')
            .unbind('mouseup')
            .unbind('touchend')
            .unbind('mousemove')
            .unbind('touchmove');

        function removeDragging() { $('.dragging').removeClass('dragging'); };
        $('.nearest').removeClass('nearest');

        var $current = $(gt.display.current);
        var $nearest = gt.display.nearest ? $(gt.display.nearest) : null;

        // Record distance moved.
        var preventClick = false;
        var distanceX = pos.clientX - gt.display.offsetX;
        var distanceY = pos.clientY - gt.display.offsetY;

        // Reset state.
        gt.display.current = null;
        gt.display.nearest = null;
        gt.display.offsetX = 0;
        gt.display.offsetY = 0;
        gt.display.containerOffsetX = 0;
        gt.display.containerOffsetY = 0;

        // Execute the drag target.
        if ($current.is('.block')) {
            if (!$nearest || $nearest[0] == $current[0]) {
                removeDragging();
                gt.list.layout();
                return true;
            }

            var underlyingElement = $current.data('element');
            if (underlyingElement)
                $current = $(underlyingElement);

            if ($nearest.is('#sidebar'))
                gt.core.pin($current);
            else if ($nearest.is('.list-item:not(".active")'))
                gt.list.moveBlockTo($current, $nearest.data('listname'));
            else if ($nearest.is('.group') && !$current.is('.tool'))
                gt.group.insertGroup($current, $nearest);
            else if ($nearest.is('.gearset') && $current.is('.item'))
                gt.gearset.insertItem($current, $nearest);
            else
                gt.display.reorderBlock($current, $nearest);
        } else if ($current.is('.list-item') && $nearest) {
            if ($nearest.is('.list-item')) {
                gt.display.reorderList($current, $nearest);
                preventClick = true;
            }
        }

        // Prevent clicks.
        if (preventClick || Math.abs(distanceX) > 15 || Math.abs(distanceY) > 15)
            setTimeout(removeDragging, 30);
        else
            removeDragging();
    },

    draggableMove: function(e) {
        if (!gt.display.current) 
            return;

        var pos = e.changedTouches ? e.changedTouches[0] : e;

        // Move the block to the cursor location.
        var y = pos.clientY - gt.display.offsetY;
        var x = pos.clientX - gt.display.offsetX;

        var $current = $(gt.display.current);
        $current
            .css('top', y)
            .css('left', x);

        var nearest = null;

        // Sidebar pinning: Anywhere over the sidebar.
        if (pos.clientX < gt.display.containerOffsetX && !$('body').hasClass('sidebar-collapsed')) {
            $('#pin-marker').css('height', $current.height());
            nearest = $('#sidebar')[0];
        }

        // Annotate the nearest element to provide feedback.
        if (!nearest)
            nearest = gt.display.findFunc(pos);

        if (nearest != gt.display.nearest) {
            if (gt.display.nearest) {
                var $old = $(gt.display.nearest);
                $old.removeClass('nearest');
                var mini = $old.data('mini');
                $(mini).removeClass('nearest');
            }

            if (nearest != gt.display.current) {
                gt.display.nearest = nearest;

                var $nearest = $(nearest);
                $nearest.addClass('nearest');
                var mini = $nearest.data('mini');
                $(mini).addClass('nearest');
            }
        }
    },

    reorderBlock: function($element, $nearest) {
        $element.attr('data-sort', gt.list.placeBefore($nearest));

        gt.list.blockSortingUpdated();
        gt.core.setActiveBlock($element);

        gt.display.minimap();
    },

    reorderList: function($element, $nearest) {
        var elementName = $element.data('listname');
        var nearestName = $nearest.data('listname');

        var lists = gt.settings.data.lists;
        var newLists = { };
        for (var key in lists) {
            if (key == elementName)
                continue;

            if (key == nearestName)
                newLists[elementName] = lists[elementName];

            newLists[key] = lists[key];
        }

        // Sanity check to ensure both lists have the same number of elements
        // before overwriting.
        if (_.keys(lists).length != _.keys(newLists).length) {
            console.error("List key mismatch after reorder, aborting.");
            return;
        }

        gt.settings.data.lists = newLists;
        gt.list.redisplayLists();
        gt.settings.save();
    },

    findBlockAtPoint: function(e) {
        var x = e.pageX;
        var y = e.pageY;

        // Check other lists.
        if (y < gt.display.containerOffsetY) {
            var under = gt.display.getElementUnderPoint(e);
            if (under) {
                var $under = $(under).closest('.drag-target');
                if ($under.length)
                    return $under[0];
            }

            return null;
        }

        // Check other blocks in this list.
        var items = gt.isotope.filteredItems;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var ix = item.position.x + gt.display.containerOffsetX;
            var iy = item.position.y + gt.display.containerOffsetY;

            if (x < ix || x > (ix + item.size.width))
                continue;

            if (y < iy || y > (iy + item.size.height))
                continue;

            return item.element;
        }

        return null;
    },

    getElementUnderPoint: function(e) {
        gt.display.current.style.visibility = 'hidden';
        var under = document.elementFromPoint(e.clientX, e.clientY);
        gt.display.current.style.visibility = 'visible';
        return under;
    },

    // Minimap

    minimap: function() {
        var settings = gt.display.minimapSettings;
        var row = 0;
        var column = 0;
        var page = 0;
        var pageRow = 0;
        var maxRows = settings.maxRows;
        var maxPages = settings.maxPages;
        var maxColumns = settings.maxColumns;
        var radius = 22;
        var spacer = 8;
        var maxRowHeight = 0;

        var miniblocks = [];
        var isotopeItems = gt.isotope.filteredItems;
        if (!isotopeItems)
            return;

        for (var i = 0; i < isotopeItems.length; i++) {
            var element = isotopeItems[i].element;
            var $block = $(element);
            var blockData = $block.data('block');
            var view = $block.data('view');
            if (!view || view.error)
                continue;

            var $e = $('<div class="minimap-block pointer handle circle ' + blockData.type + '"></div>');

            if (column >= maxColumns) {
                column = 0;
                row++;
                maxRowHeight = Math.min(maxRowHeight + 1, maxRows - 1);
            }

            if (row >= maxRows) {
                row = 0;
                page++;
            }

            if (page >= maxPages) {
                page = 0;
                pageRow++;
                maxRowHeight = 0;
            }

            var x = (page * maxColumns * radius) + (page * spacer) + (column * radius) + 2;
            var y = (pageRow * maxRows * radius) + (pageRow * spacer) + (row * radius) + 2;

            $e.css('left', x);
            $e.css('top', y);

            column++;

            $e.data('block', blockData);
            $e.data('element', element);
            $block.data('mini', $e[0]);
            $e.click(gt.display.minimapBlockClicked);

            var name = null;
            switch (blockData.type) {
                case 'item':
                case 'instance':
                case 'npc':
                case 'mob':
                case 'node':
                case 'fishing':
                case 'quest':
                case 'leve':
                case 'achievement':
                case 'action':
                case 'fate':
                case 'group':
                case 'skywatcher':
                case 'equip':
                case 'note':
                    $e.append('<img src="' + view.icon + '" width="' + radius + 'px">');
                    break;

                case 'browse':
                case 'patch':
                    $e.append('<img src="' + $block.data('view').browseIcon + '" width="' + (radius - 2) + '"px">');
                    break;

                case 'time':
                    $e.append('<span class="text">' + gt.time.eCurrentTime().getUTCHours() + '</span>');
                    break;

                case 'gearset':
                    $e.append('<img src="images/Main Hand.png" width="' + (radius - 2) + '"px>');
                    break;
            }

            if (name)
                $e.append('<span class="text">' + gt.util.abbr2(name) + '</span>');

            miniblocks.push($e);
        }

        var numRows = (pageRow * maxRows) + maxRowHeight + 1;
        var height = (numRows * radius) + (spacer * (pageRow + 1));
        $('#minimap').empty().append(miniblocks).css('height', height);
    },

    minimapBlockClicked: function(e) {
        var block = $(this).data('block');
        var $existing = $('.' + block.type + '.block[data-id="' + block.id + '"]');
        if ($existing.length) {
            gt.core.scrollToBlock($existing);
            gt.core.setActiveBlock($existing);
        }
    },

    // Notifications

    notifications: function($block, blockData) {
        $('.notifications-button', $block)
            .toggleClass('active', blockData.alarms ? true : false)
            .click(gt.display.alarmNotificationsClicked);

        if (blockData.alarms && window.Notification && gt.settings.data.notifications)
            window.Notification.requestPermission();
    },

    alarmNotificationsClicked: function(e) {
        var $this = $(this);
        var $block = $this.closest('.block');
        var data = $block.data('block');

        $this.toggleClass('active');
        if ($this.hasClass('active')) {
            if (window.Notification && window.Notification.permission != "granted")
                window.Notification.requestPermission();

            data.alarms = 1;
            gt.display.playAnyTone();
        }
        else
            delete data.alarms;

        gt.settings.save();
    },

    playTone: function(tone) {
        if (!tone || tone == 'none')
            return;

        var alarm = $('#' + tone)[0];
        alarm.volume = gt.settings.data.alarmVolume / 100;
        alarm.play();
    },

    playAnyTone: function() {
        if (gt.settings.data.alarmTone && gt.settings.data.alarmTone != 'none')
            gt.display.playWarningAlarm();
        else if (gt.settings.data.availableTone && gt.settings.data.availableTone != 'none')
            gt.display.playAvailableAlarm();
    },

    playWarningAlarm: function() {
        gt.display.playTone(gt.settings.data.alarmTone);
    },

    playAvailableAlarm: function() {
        gt.display.playTone(gt.settings.data.availableTone);
    },

    // Alternatives

    alternatives: function($block, blockData) {
        var $containers = $('.alternative-container', $block);
        if (!$containers.length)
            return;

        for (var i = 0; i < $containers.length; i++) {
            var $alts = $('.alternative', $containers[i]);
            if (!$alts.length)
                continue;

            // Show the first alternate per container, and hide the rest.
            $alts.hide();
            $($alts[0]).show();
            $alts.click(gt.display.alternativeClicked);
        }
    },

    alternativeClicked: function(e) {
        var $this = $(this);
        $this.hide();

        var $alts = $('.alternative', $this.closest('.alternative-container'));
        var showIndex = (_.indexOf($alts, this) + 1) % $alts.length;
        $($alts[showIndex]).show();

        gt.list.layout();
    },

    longtap: function($element, tapAction, longTapAction) {
        var threshold = 350;
        var startTime;

        $element.bind('touchstart', function(e) {
            startTime = new Date();
        });

        $element.bind('click', function(e) {
            e.stopImmediatePropagation();

            var now = new Date();
            if (now - startTime <= threshold)
                tapAction.apply(this, [e]);
            else
                longTapAction.apply(this, [e]);

            return false;
        });
    },

    normalizeWheelDelta: function(d) {
        var min = 50;

        if (d < 0 && d > -min)
            return -min;
        else if (d > 0 && d < min)
            return min;
        return d;
    },

    // Popovers

    popover: function($element, cssClass, opened, dismissed) {
        var $container = $('#popover-container');
        $container.addClass(cssClass);
        $container.empty().append($element);
        $container.show();

        var $dismiss = $('<div id="popover-dismiss"></div>');
        $('body').append($dismiss);

        $dismiss.click(function(e) {
            $container.hide();
            $container.removeClass(cssClass);
            $dismiss.remove();

            if (dismissed)
                dismissed();
        });

        $container[0].scrollTop = 0;

        if (opened)
            opened();

        return $container;
    },

    alertp: function(message) {
        var html = '<div id="popover-header">Alert</div><div>' + message + '</div><hr><div class="center"><input class="inline-block" type="button" value="OK" onclick="javascript:gt.display.promptCancel();"></div>';
        gt.display.popover($(html), 'position-center unrestricted');
    },

    promptCallback: null,
    promptp: function(message, value, callback) {
        message = gt.util.escapeHtml(message);
        value = value ? gt.util.escapeHtml(value) : "";
        var html = '<div id="popover-header">' + message + '</div><div><input id="prompt-value" type="text" value="' + value + '"> <input type="button" value="OK" onclick="javascript:gt.display.promptSubmit();"> <input type="button" value="Cancel" onclick="javascript:gt.display.promptCancel();"></div>';

        var opened = function() {
            $('#prompt-value').focus();
        };

        var dismissed = function() {
            // Clean this up just in case.
            gt.display.promptCallback = null;
            window.onkeydown = null;
        };

        window.onkeydown = gt.display.promptKeydown;

        gt.display.promptCallback = callback;
        gt.display.popover($(html), 'position-center', opened, dismissed);
    },

    promptKeydown: function(e) {
        if (e.keyCode == 27) {
            gt.display.promptCancel();
            return false;
        }

        if (e.keyCode == 13) {
            gt.display.promptSubmit();
            return false;
        }

        return true;
    },

    promptSubmit: function(e) {
        var callback = gt.display.promptCallback;
        gt.display.promptCallback = null;
        $('#popover-dismiss').click();

        if (callback) {
            var result = $('#prompt-value').val();
            callback(result);
        }
    },

    promptCancel: function(e) {
        var callback = gt.display.promptCallback;
        gt.display.promptCallback = null;
        $('#popover-dismiss').click();

        if (callback)
            callback(null);
    }
};
