gt.gearset = {
    blockTemplate: null,
    slotTemplate: null,
    detailTemplate: null,
    type: 'gearset',

    initialize: function(data) {
        gt.gearset.blockTemplate = doT.template($('#block-gearset-template').text());
        gt.gearset.slotTemplate = doT.template($('#slot-gearset-template').text());
        gt.gearset.detailTemplate = doT.template($('#detail-gearset-template').text());

        $('#new-gearset').click(gt.gearset.newGearSetClicked);
    },

    newGearSetClicked: function(e) {
        gt.display.promptp("Name the new gear set:", null, function(name) {
            if (!name)
                return;
    
            var existing = gt.list.getBlockData('gearset', name);
            if (existing) {
                gt.display.alertp('A gear set with that name already exists.');
                return;
            }
    
            var gearset = { type: 'gearset', id: name, equipment: {} };
            gt.list.addBlock(gearset);
            gt.core.activate('gearset', name);
        });
    },

    getViewModel: function(gearset, data) {
        gearset = data;

        var view = {
            id: gearset.id,
            type: 'gearset',
            name: gearset.id,
            template: gt.gearset.blockTemplate,
            blockClass: 'tool noexpand',

            equipment: {}
        };

        // Setup slots.
        var deferredItemContents = [];
        for (var slot in gearset.equipment) {
            var itemData = gearset.equipment[slot];
            if (!gt.item.index[itemData.id]) {
                deferredItemContents.push(itemData);
                continue;
            }

            var item = gt.item.index[itemData.id];
            if (!item) {
                console.error('Gear Set ' + view.id + ' contains invalid item: ' + itemData.id);
                continue;
            }

            view.equipment[slot] = gt.gearset.getEquipmentViewModel(item, itemData);
        }

        if (!view.equipment['Main Hand'])
            view.equipment['Main Hand'] = { slot: 'Main Hand' };
        if (!view.equipment['Off Hand'])
            view.equipment['Off Hand'] = { slot: 'Off Hand' };
        if (!view.equipment['Head'])
            view.equipment['Head'] = { slot: 'Head' };
        if (!view.equipment['Body'])
            view.equipment['Body'] = { slot: 'Body' };
        if (!view.equipment['Hands'])
            view.equipment['Hands'] = { slot: 'Hands' };
        if (!view.equipment['Waist'])
            view.equipment['Waist'] = { slot: 'Waist' };
        if (!view.equipment['Legs'])
            view.equipment['Legs'] = { slot: 'Legs' };
        if (!view.equipment['Feet'])
            view.equipment['Feet'] = { slot: 'Feet' };
        if (!view.equipment['Neck'])
            view.equipment['Neck'] = { slot: 'Neck' };
        if (!view.equipment['Ears'])
            view.equipment['Ears'] = { slot: 'Ears' };
        if (!view.equipment['Wrists'])
            view.equipment['Wrists'] = { slot: 'Wrists' };
        if (!view.equipment['Left Ring'])
            view.equipment['Left Ring'] = { slot: 'Rings' };
        if (!view.equipment['Right Ring'])
            view.equipment['Right Ring'] = { slot: 'Rings' };
        if (!view.equipment['Soul Crystal'])
            view.equipment['Soul Crystal'] = { slot: 'Soul Crystal' };

        // Kick off a load of the deferred items.
        if (deferredItemContents.length) {
            var itemIds = _.map(deferredItemContents, function(b) { return b.id; });
            gt.core.fetch(gt.item, itemIds, function(results) {
                var $block = $('.block.gearset[data-id="' + data.id + '"][data-type="' + data.type + '"]');
                if (!$block.length)
                    return; // Group may have gone away during fetch.

                gt.core.redisplay($block);
            });
        }

        return view;
    },

    getEquipmentViewModel: function(item, itemData) {
        var view = {
            slot: gt.item.equipSlotNames[item.slot],
            item: gt.item.getViewModel(item, itemData),
            hq: 1,
            bonuses: []
        };

        for (var i = 0; i < view.item.bonuses.length; i++) {
            var bonus = view.item.bonuses[i];
            var value = view.hq && bonus.value_hq ? bonus.value_hq : bonus.value;
            view.bonuses.push({name: bonus.name, value: value});
        }

        return view;
    },

    insertItem: function($item, $gearset) {
        var gearsetData = $gearset.data('block');
        var itemData = $item.data('block');
        var itemView = $item.data('view');

        if (!itemView.equip)
            return; // Only equipment is valid.

        var slotName = gt.item.equipSlotNames[itemView.obj.slot];
        if (!slotName)
            return; // Doesn't handle multi-slot items.

        if (slotName == 'Rings') {
            if (gearsetData.equipment['Left Ring'])
                slotName = 'Right Ring';
            else
                slotName = 'Left Ring';
        }

        gearsetData.equipment[slotName] = itemData;

        if ($item.is('.active'))
            gt.core.setHash(null);

        gt.list.removeBlock(itemData);
        gt.core.removeBlockCore($item, false);

        gt.core.redisplay($gearset);
    }
};
