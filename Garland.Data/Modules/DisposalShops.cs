using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class DisposalShops : Module
    {
        public override string Name => "Disposal Shops";

        public override void Start()
        {
            var sNpcs = _builder.Realm.GameData.ENpcs;
            foreach (var sDisposalShop in _builder.Sheet("DisposalShop"))
            {
                var name = sDisposalShop["ShopName"].ToString();
                if (string.IsNullOrEmpty(name))
                    continue;

                var sShopNpcs = sNpcs.FindWithData(sDisposalShop.Key).ToArray();
                if (sShopNpcs.Length == 0)
                    continue; // Probably accessed another way, like via CustomTalk.

                BuildShop(_builder, sShopNpcs, sDisposalShop.Key);
            }
        }

        public static void BuildShop(DatabaseBuilder builder, Saint.ENpc[] sNpcs, int disposalShopKey)
        {
            var sDisposalShop = builder.Sheet("DisposalShop")[disposalShopKey];
            var shopName = sDisposalShop["ShopName"].ToString();
            var npcIds = sNpcs.Select(n => n.Key).ToArray();

            foreach (var sDisposalShopItem in builder.Sheet2("DisposalShopItem"))
            {
                if (sDisposalShopItem.ParentKey != disposalShopKey)
                    continue;

                var sItemReceived = (Saint.Item)sDisposalShopItem["Item{Received}"];
                if (sItemReceived == null || sItemReceived.Key == 0)
                    continue;

                var sItemDisposed = (Saint.Item)sDisposalShopItem["Item{Disposed}"];

                dynamic entry = new JObject();
                entry.amount = (int)(uint)sDisposalShopItem["Quantity{Received}"];
                entry.item = sItemReceived.Key;
                entry.shop = shopName;
                entry.npcs = new JArray(npcIds);

                var item = builder.Db.ItemsById[sItemDisposed.Key];
                if (item.disposal == null)
                    item.disposal = new JArray();
                item.disposal.Add(entry);

                builder.Db.AddReference(item, "npc", npcIds, false);
                builder.Db.AddReference(item, "item", sItemReceived.Key, false);
            }
        }
    }
}
