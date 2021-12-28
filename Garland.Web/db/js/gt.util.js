gt.util = {
    abbrDict: {
        "Lakeland": "Lk",
        "Labyrinthos": "Lb",
    },
    abbrCache: {},

    pascalCase: function(str) {
        return str.replace(/(\w)(\w*)/g,
            function(g0,g1,g2) { return g1.toUpperCase() + g2.toLowerCase(); });
    },

    zeroPad: function(num, digits) {
        return ("00000000" + num).slice(-digits);
    },

    repeat: function(str, times) {
        var result = "";
        for (var i = 0; i < times; i++)
            result += str;
        return result;
    },

    stars: function(stars) {
        return stars ? (' ' + gt.util.repeat('&#x2605', stars)) : '';
    },

    abbr2: function(str) {
        if (gt.util.abbrDict[str])
            return gt.util.abbrDict[str];

        var parts = str.trim().replace('(', '').split(' ');
        var a = parts[0].length ? parts[0][0] : '';
        if (parts.length == 1)
            return a;
        var b = parts[1].length ? parts[1][0] : '';
        return a + b;
    },

    abbr: function(str) {
        if (!str)
            return '';

        if (gt.util.abbrDict[str])
            return gt.util.abbrDict[str];

        if (gt.util.abbrCache[str])
            return gt.util.abbrCache[str];

        var parts = str.replace('(', '').split(' ');
        var result = _.map(parts, function(p) { return p[0]; }).join('');
        gt.util.abbrCache[str] = result;
        return result;      
    },

    pushAll: function(src, dest) {
        for (var i = 0; i < src.length; i++)
            dest.push(src[i]);
        return dest;
    },

    sum: function(arr, selector) {
        return _.reduce(arr, function(m, i) { return m + selector(i); }, 0);
    },

    average: function(arr, selector) {
        return gt.util.sum(arr, selector) / arr.length;
    },

    plural: function(str, arr) {
        return str + ((arr.length > 1) ? 's' : '');
    },

    pluralNum: function(str, num) {
        return str + ((num > 1) ? 's' : '');
    },

    floor2: function(num) {
        return Math.floor(num * 100) / 100;;
    },

    round2: function(num) {
        return Math.round(num * 100) / 100;
    },

    round1: function(num) {
        return Math.round(num * 10) / 10;
    },

    uint: function(num) {
        return (num << 32) >>> 0;
    },

    sanitize: function(str) {
        return str.replace(/[\s'\?\(\)\.\:/\!"<>\\\+&,]/g, '');
    },

    check: function($checkbox, val) {
        $checkbox.prop('checked', val ? true : false);
    },

    distance: function(x, y, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x, 2) + Math.pow(y2 - y, 2));
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

    post: function(url, data, callback) {
        $.post(gt.serverPath + url, data, function(result) {
            if (!result)
                callback(null, "No result.");
            else if (result.error)
                callback(null, result.error);
            else
                callback(result);
        }, "json");
    },

    api: function(data, callback) {
        gt.util.post("/api.php", data, callback);
    },

    mapByIndex: function(map, indexes) {
        var result = [];
        for (var i = 0; i < indexes.length; i++) {
            var entry = map[indexes[i]];
            if (entry)
                result.push(entry);
        }
        return result.length ? result : null;
    },

    // HTML escaping from mustache.js
    htmlEntityMap: {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    },
      
    escapeHtml: function(string) {
        return String(string).replace(/[&<>"'`=\/]/g, function (s) {
            return gt.util.htmlEntityMap[s];
        });
    },

    makeId: function(len) {
        var keyspace = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var values = crypto.getRandomValues(new Uint8Array(len));
        return Array.from(values, function(i) { return keyspace.charAt(i % keyspace.length); }).join('');
    }
};

// Natural Sort algorithm for Javascript - Version 0.7 - Released under MIT license
// Author: Jim Palmer (based on chunking idea from Dave Koelle)
// https://github.com/overset/javascript-natural-sort
function naturalSort (a, b) {
    var re = /(^-?[0-9]+(\.?[0-9]*)[df]?e?[0-9]?$|^0x[0-9a-f]+$|[0-9]+)/gi,
        sre = /(^[ ]*|[ ]*$)/g,
        dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/,
        hre = /^0x[0-9a-f]+$/i,
        ore = /^0/,
        i = function(s) { return naturalSort.insensitive && (''+s).toLowerCase() || ''+s },
        // convert all to strings strip whitespace
        x = i(a).replace(sre, '') || '',
        y = i(b).replace(sre, '') || '',
        // chunk/tokenize
        xN = x.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
        yN = y.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
        // numeric, hex or date detection
        xD = parseInt(x.match(hre)) || (xN.length != 1 && x.match(dre) && Date.parse(x)),
        yD = parseInt(y.match(hre)) || xD && y.match(dre) && Date.parse(y) || null,
        oFxNcL, oFyNcL;
    // first try and sort Hex codes or Dates
    if (yD)
        if ( xD < yD ) return -1;
        else if ( xD > yD ) return 1;
    // natural sorting through split numeric strings and default strings
    for(var cLoc=0, numS=Math.max(xN.length, yN.length); cLoc < numS; cLoc++) {
        // find floats not starting with '0', string or 0 if not defined (Clint Priest)
        oFxNcL = !(xN[cLoc] || '').match(ore) && parseFloat(xN[cLoc]) || xN[cLoc] || 0;
        oFyNcL = !(yN[cLoc] || '').match(ore) && parseFloat(yN[cLoc]) || yN[cLoc] || 0;
        // handle numeric vs string comparison - number < string - (Kyle Adams)
        if (isNaN(oFxNcL) !== isNaN(oFyNcL)) { return (isNaN(oFxNcL)) ? 1 : -1; }
        // rely on string comparison if different types - i.e. '02' < 2 != '02' < '2'
        else if (typeof oFxNcL !== typeof oFyNcL) {
            oFxNcL += '';
            oFyNcL += '';
        }
        if (oFxNcL < oFyNcL) return -1;
        if (oFxNcL > oFyNcL) return 1;
    }
    return 0;
}
