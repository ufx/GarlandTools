gt.note = {
    blockTemplate: null,
    type: 'note',

    initialize: function(data) {
        gt.note.blockTemplate = doT.template($('#block-note-template').text());

        $('#new-note').click(gt.note.newNoteClicked);
    },

    bindEvents: function($block, data, view) {
        $('.name-handle', $block).bind(gt.display.downEvent, gt.core.renameHeaderClicked);
        $('.note-text', $block).change(gt.note.notesChanged);

        gt.note.adjustHeight($block, data.notes);
    },

    newNoteClicked: function(e) {
        var name = "Note";
        var counter = 2;

        while (gt.list.getBlockData('note', name))
            name = "Note " + counter++;

        var note = { type: 'note', id: name };
        gt.list.addBlock(note);
        gt.core.activate('note', name);
    },

    notesChanged: function(e) {
        var $block = $(this).closest('.block');
        var data = $block.data('block');

        data.notes = $(this).val();
        if (!data.notes)
            delete data.notes;

        gt.note.adjustHeight($block, data.notes);
        gt.list.resized($block);

        gt.settings.saveDirty();
    },

    adjustHeight: function($block, notes) {
        var $text = $('.note-text', $block);
        $text.css('height', '');

        var height = $text[0].scrollHeight + 12;
        if (height < 159)
            height = 159 - 1;
        else if (height < 411)
            height = 411 - 1;
        else if (height < 663)
            height = 663 - 1;
        else
            height = 915 - 1;

        $('.note-text', $block).css('height', height + 'px');
    },

    getViewModel: function(note, data) {
        // todo: remove he module check.
        return {
            id: data.id,
            type: 'note',
            name: data.id,
            displayName: he.encode(data.id),
            template: gt.note.blockTemplate,
            blockClass: 'tool expand-right',
            icon: 'images/site/Note.png',
            subheader: 'Note Tool',
            tool: 1,

            text: data.notes || ''
        };
    }
};
