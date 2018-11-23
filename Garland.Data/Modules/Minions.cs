using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Modules
{
    public class Minions : Module
    {
        public override string Name => "Minions";

        public override void Start()
        {
            foreach (var sItem in _builder.Sheet<SaintCoinach.Xiv.Item>())
            {
                var unlock = sItem.ItemAction as SaintCoinach.Xiv.ItemActions.CompanionUnlock;
                if (unlock == null)
                    continue;

                var item = _builder.Db.ItemsById[sItem.Key];
                var sCompanion = unlock.Companion;

                _builder.Localize.Strings(item, sCompanion, "MinionRace");
                _builder.Localize.Strings(item, sCompanion.CompanionTransient, "Tooltip", "MinionSkillType");
                _builder.Localize.HtmlStrings((JObject)item, sCompanion.CompanionTransient, "SpecialAction{Name}", "SpecialAction{Description}");
                item.cost = sCompanion.Cost;
                item.skill_angle = sCompanion.SpecialActionAngle;

                if (sCompanion.HasAreaAttack)
                    item.aoe = 1;

                item.strengths = new JArray();
                if (sCompanion.StrongVsEye)
                    item.strengths.Add("Eye");
                if (sCompanion.StrongVsGate)
                    item.strengths.Add("Gate");
                if (sCompanion.StrongVsShield)
                    item.strengths.Add("Shield");
                if (sCompanion.StrongVsArcana)
                    item.strengths.Add("Arcana");

                if (item.attr == null)
                    item.attr = new JObject();
                item.attr.HP = sCompanion.HP;
                item.attr["Skill Cost"] = sCompanion.SpecialActionCost;
                item.attr.Attack = sCompanion.Attack;
                item.attr.Defense = sCompanion.Defense;
                item.attr.Speed = sCompanion.Speed;

                item.models = new JArray(Utils.ModelCharaKey(sCompanion.ModelChara));
            }
        }
    }
}
