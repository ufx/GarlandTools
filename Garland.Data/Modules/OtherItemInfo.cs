using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using SaintCoinach.Xiv;
using SaintCoinach.Xiv.ItemActions;

namespace Garland.Data.Modules
{
    public class OtherItemInfo : Module
    {
        public override string Name => "Other Item Information";

        // this is magic, be sure to change it when patch changes.
        const int ORNAMENT_OFFSET = 59000;

        public override void Start()
        {
            foreach (var sItem in _builder.Sheet<Item>())
            {
                if (sItem.ItemAction == null)
                    continue;

                if (sItem.ItemAction is FieldNoteUnlock sFieldUnlock)
                {
                    BuildFieldNote(sItem, sFieldUnlock);
                }
                else if (sItem.ItemAction is OrnamentUnlock sOrnamentUnlock)
                {
                    BuildOrnament(sItem, sOrnamentUnlock);
                }
                else if (sItem.ItemAction is AchievementScroll sAchievementUnlock)
                {
                    BuildAchievement(sItem, sAchievementUnlock);
                }
            }
        }

        private void BuildFieldNote(Item sItem, FieldNoteUnlock sFieldUnlock)
        {
            var sFieldNote = sFieldUnlock.FieldNote;
            if (sFieldNote == null)
                return;

            var item = _builder.Db.ItemsById[sItem.Key];
            dynamic fieldNote = new JObject();
            fieldNote.id = sFieldNote.Key;
            fieldNote.name = sFieldNote.Name.ToString();
            fieldNote.description = sFieldNote.Description.ToString();
            fieldNote.icon = IconDatabase.EnsureEntryHQ("fieldnote", sFieldNote.Icon, _builder.Realm);
            fieldNote.image = IconDatabase.EnsureEntry("fieldnote/image", sFieldNote.Image);
            fieldNote.rarity = sFieldNote.Rarity;

            item.fieldnote = fieldNote;
        }
        private void BuildOrnament(Item sItem, OrnamentUnlock sOrnamentUnlock)
        {
            var sOrnament = sOrnamentUnlock.Ornament;
            if (sOrnament == null)
                return;

            var item = _builder.Db.ItemsById[sItem.Key];
            dynamic ornament = new JObject();
            ornament.name = sOrnament.Singular.ToString();

            var sOrnamentTransient = _builder.Sheet("OrnamentTransient")[sOrnament.Key];
            ornament.id = sOrnament.Key;
            ornament.description = sOrnamentTransient[0].ToString();
            ornament.icon = IconDatabase.EnsureEntryHQ("ornament", sOrnament.Icon, _builder.Realm);
            ornament.image = IconDatabase.EnsureEntry("ornament/image",
                SaintCoinach.Imaging.IconHelper.GetIcon(_builder.Realm.Packs, ORNAMENT_OFFSET + ornament.icon.Value));

            item.ornament = ornament;
        }

        private void BuildAchievement(Item sItem, AchievementScroll sAchievementUnlock)
        {
            var sAchievement = sAchievementUnlock.Achievement;
            if (sAchievement == null)
                return;

            var item = _builder.Db.ItemsById[sItem.Key];
            item.achievement = sAchievement.Key;
            _builder.Db.AddReference(item, "achievement", sAchievement.Key, true);
        }
    }
}
