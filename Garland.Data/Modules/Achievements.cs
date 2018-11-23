using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Achievements : Module
    {
        public override string Name => "Achievements";

        public override void Start()
        {
            foreach (var sAchievement in _builder.Sheet<Game.Achievement>())
            {
                if (sAchievement.Key == 0 || sAchievement.AchievementCategory.Key == 0)
                    continue;

                if (sAchievement.AchievementCategory.AchievementKind.Name == "Legacy")
                    continue;

                dynamic achievement = new JObject();
                achievement.id = sAchievement.Key;
                _builder.Localize.Strings((JObject)achievement, sAchievement, "Name", "Description");
                achievement.patch = PatchDatabase.Get("achievement", sAchievement.Key);
                achievement.points = sAchievement.Points;
                achievement.category = sAchievement.AchievementCategory.Key;

                if (sAchievement.Title.Key != 0)
                {
                    if (sAchievement.Title.Feminine == sAchievement.Title.Masculine)
                        achievement.title = sAchievement.Title.Masculine.ToString();
                    else
                        achievement.title = sAchievement.Title.ToString();
                }

                if (sAchievement.Item.Key != 0)
                {
                    achievement.item = sAchievement.Item.Key;
                    var item = _builder.Db.ItemsById[sAchievement.Item.Key];
                    if (item.achievements == null)
                        item.achievements = new JArray();
                    item.achievements.Add(sAchievement.Key);
                    _builder.Db.AddReference(achievement, "item", sAchievement.Item.Key, false);
                    _builder.Db.AddReference(item, "achievement", sAchievement.Key, false);
                }

                achievement.icon = IconDatabase.EnsureEntry("achievement", sAchievement.Icon);

                _builder.Db.Achievements.Add(achievement);
            }

            foreach (var sAchievementCategory in _builder.Sheet<Game.AchievementCategory>())
            {
                if (sAchievementCategory.Key == 0 || sAchievementCategory.Name == "")
                    continue;

                dynamic category = new JObject();
                category.id = sAchievementCategory.Key;
                category.name = sAchievementCategory.Name.ToString();
                category.kind = sAchievementCategory.AchievementKind.Name.ToString();

                _builder.Db.AchievementCategories.Add(category);
            }
        }
    }
}
