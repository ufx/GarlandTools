gt.map = {
    dragOriginX: 0,
    dragOriginY: 0,
    dragging: null,
    pixelsPerGrid: 50,
    pageTemplate: null,

    initialize: function(data) {
        gt.map.pageTemplate = doT.template($('#page-map-template').text());
    },

    setup: function ($block) {
        var $container = $('.map-container', $block);
        if (!$container.length)
            return;

        var id = $container.data('id');
        var location = gt.location.index[id];
        var x = Number($container.data('x'));
        var y = Number($container.data('y'));
        var r = Number($container.data('r'));

        if (!gt.display.isTouchDevice) {
            // Dragging, at least, works fine with touch by default.
            $container.bind('wheel', gt.map.wheel);

            $container.bind(gt.display.downEvent, gt.map.dragDown);
            $container.bind(gt.display.moveEvent, gt.map.mousemove);
            $container.bind('mouseout', gt.map.mouseout);
        }

        $container.data('location', location);

        // Paint the image.
        var $canvas = $('canvas', $container);
        if (!$canvas.length) {
            console.error("Can't find canvas, skipping map setup.");
            return;
        }
        
        var image = new Image();
        image.src = $canvas.data('image');
        image.onload = function(e) {
            var context = $canvas[0].getContext('2d');
            if (!context)
                return; // May have disappeared.

            context.drawImage(image, 0, 0);

            // Draw a circle for the location.
            context.beginPath();
            context.arc(x, y, r, 0, Math.PI * 2, false);
            context.fillStyle = 'rgba(164, 164, 219, 0.4)';
            context.fill();
            context.closePath();

            // Draw grid.
            context.beginPath();
            context.strokeStyle = 'rgba(50, 50, 50, 0.06)';
            var size = gt.map.pixelsPerGrid * location.size;
            for (var i = 0; i < 2048; i += size) {
                for (var ii = 0; ii < 2048; ii += size)
                    context.strokeRect(i, ii, size, size);
            }
            context.closePath();

            // Outline the circle.
            // Not available on some browsers.
            if (context.setLineDash) {
                context.beginPath();
                context.setLineDash([3]);
                context.arc(x, y, r, 0, Math.PI * 2, false);
                context.strokeStyle = 'rgba(192, 192, 214, 1)';
                context.stroke();
            }

            // Load and draw the icon if applicable.
            var iconSrc = $canvas.data('icon');
            if (iconSrc) {
                var iconImage = new Image();
                iconImage.src = iconSrc;
                iconImage.onload = function(e) {
                    var iconfilter = $canvas.data('iconfilter');
                    if (iconfilter)
                        context.filter = iconfilter;
                    context.drawImage(iconImage, x - 12, y - 12, 25, 25);
                };             
            }
        };

        // Center scrollbar on the coordinates.
        // Page must be visible for this to work!
        var mapContainer = $container[0];
        mapContainer.scrollLeft = x - mapContainer.clientWidth / 2;
        mapContainer.scrollTop = y - mapContainer.clientHeight / 2;
    },

    getViewModel: function(map) {
        if (!map.location.parentId)
            return null;

        var view = {
            location: map.location,
            parent: gt.location.index[map.location.parentId],
            displayCoords: map.coords,
            icon: map.icon,
            iconfilter: map.iconfilter
        };

        var offset = map.approx ? 0.5 : 1;
        var x = (map.coords[0] - offset) * gt.map.pixelsPerGrid * map.location.size;
        var y = (map.coords[1] - offset) * gt.map.pixelsPerGrid * map.location.size;
        view.coords = [x, y];

        if (map.radius)
            view.radius = gt.map.toMapCoordinate(map.radius, map.location.size) * Math.PI * 2;
        else {
            view.radius = gt.map.pixelsPerGrid / 2;
            if (map.approx)
                view.radius *= map.location.size;
        }

        if (view.radius < 15)
            view.radius = 15

        view.image = '../files/maps/' + view.parent.name + '/' + gt.map.sanitizeLocationName(view.location.name) + '.png';

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
        $('.position', this).text(parseInt(pos.x + 1)  + ", " + parseInt(pos.y + 1));
    },

    wheel: function(e) {
        e.stopPropagation();
        e = e.originalEvent;

        var gridPos = gt.map.getGridPosition(e, this);

        var delta = gt.display.normalizeWheelDelta(e.deltaY) * .0015;

        var $map = $('.map', this);
        var currentZoom = Number($map.css('zoom') || 1);
        var zoom = Math.min(Math.max(currentZoom - delta, 0.182), 1.75);
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
        $position.text($position.data('original'));
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

    export: function() {
        var $canvas = $('.block.active canvas.map');
        if (!$canvas.length)
            return;

        var link = $('<a>Download map as image</a>')[0];
        link.href = $canvas[0].toDataURL("image/jpeg");
        link.download = $('.block.active').data('view').name;
        $('body').append(link);
        link.click();
        $(link).remove();
    }
};
