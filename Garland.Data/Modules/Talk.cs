using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Talk : Module
    {
        public override string Name => "SwitchTalk, DefaultTalk";

        public override void Start()
        {
            // Disabled for now, until we can fix this properly with new sheet
            return;
            var enpcs = _builder.Realm.GameData.ENpcs;
            var defaultTalkByNpc = new Dictionary<int, HashSet<int>>();

            foreach (var sSwitchTalk in _builder.Sheet("SwitchTalk"))
            {
                // Collect quests, talk text and NPCs.
                var quests = new List<Game.Quest>();
                for (var i = 0; i < 15; i++)
                {
                    var quest = sSwitchTalk.As<Game.Quest>(i);
                    if (quest != null)
                        quests.Add(quest);
                }

                var defaultTalk = new List<Game.XivRow>();
                for (var i = 17; i < 32; i++)
                {
                    var dt = (Game.XivRow)sSwitchTalk[i];
                    if (dt != null)
                        defaultTalk.Add(dt);
                }

                if (defaultTalk.Count == 0)
                    continue;

                var npcs = _builder.Realm.GameData.ENpcs.FindWithData(sSwitchTalk.Key).ToArray();
                if (npcs.Length == 0)
                    continue;

                // Apply to quests
                for (var i = 0; i < quests.Count; i++)
                {
                    var sQuest = quests[i];
                    if (sQuest.Name == "")
                        continue;

                    // Collect quest lines.
                    var applicableTalk = new List<Game.XivRow>();

                    if (defaultTalk.Count > 1)
                    {
                        // Some chains do not have after lines.
                        applicableTalk.Add(defaultTalk[i + 1]);
                    }

                    if (i == 0)
                    {
                        // First quest will show before lines as well.
                        applicableTalk.Insert(0, defaultTalk[0]);
                    }

                    var lines = GetDefaultTalkLines(applicableTalk.ToArray());

                    // Add to quest.
                    dynamic npcTalk = new JObject();
                    npcTalk.name = Utils.CapitalizeWords(npcs[0].Singular);
                    npcTalk.lines = new JArray(lines);
                    npcTalk.npcid = npcs[0].Key;

                    var quest = _builder.Db.QuestsById[sQuest.Key];
                    if (quest.talk == null)
                        quest.talk = new JArray();
                    quest.talk.Add(npcTalk);

                    // Apply to NPCs.
                    foreach (var sNpc in npcs)
                    {
                        if (!defaultTalkByNpc.TryGetValue(sNpc.Key, out var seenDefaultTalk))
                        {
                            seenDefaultTalk = new HashSet<int>();
                            defaultTalkByNpc[sNpc.Key] = seenDefaultTalk;
                        }

                        foreach (var talk in applicableTalk)
                            seenDefaultTalk.Add(talk.Key);

                        dynamic questTalk = new JObject();
                        questTalk.questid = sQuest.Key;
                        questTalk.lines = new JArray(lines.ToArray());

                        var npc = _builder.Db.NpcsById[sNpc.Key];
                        if (npc.talk == null)
                            npc.talk = new JArray();
                        npc.talk.Add(questTalk);

                        _builder.Db.AddReference(quest, "npc", sNpc.Key, false);
                        _builder.Db.AddReference(npc, "quest", sQuest.Key, false);
                    }
                }
            }

            // Add remaining DefaultTalk that hasn't been seen yet.
            foreach (var sDefaultTalk in _builder.Sheet("DefaultTalk"))
            {
                var npcs = _builder.Realm.GameData.ENpcs.FindWithData(sDefaultTalk.Key).ToArray();
                if (npcs.Length == 0)
                    continue;

                foreach (var sNpc in npcs)
                {
                    if (Hacks.IsNpcSkipped(sNpc))
                        continue;

                    // Check that the entry wasn't already seen by a quest SwitchTalk.
                    if (defaultTalkByNpc.TryGetValue(sNpc.Key, out var seenDefaultTalk))
                    {
                        if (seenDefaultTalk.Contains(sDefaultTalk.Key))
                            continue;
                    }

                    var npc = _builder.Db.NpcsById[sNpc.Key];

                    // No quest - add the dialogue.
                    var lines = GetDefaultTalkLines(sDefaultTalk);

                    dynamic talk = new JObject();
                    talk.lines = new JArray(lines.ToArray());

                    if (npc.talk == null)
                        npc.talk = new JArray();
                    npc.talk.Add(talk);
                }
            }
        }

        private static List<string> GetDefaultTalkLines(params Game.XivRow[] defaultTalk)
        {
            var lines = new List<string>();
            foreach (var gameTalk in defaultTalk)
            {
                for (var ii = 0; ii < 3; ii++)
                {
                    var xivstr = gameTalk.AsString("Text", ii);
                    var str = HtmlStringFormatter.Convert(xivstr);
                    if (string.IsNullOrEmpty(str) || str == "0")
                        continue;

                    lines.Add(str);
                }
            }
            return lines;
        }
    }
}
