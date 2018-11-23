using SaintCoinach;
using SaintCoinach.Graphics.Viewer;
using SaintCoinach.Xiv;
using SaintCoinach.Xiv.Items;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data
{
    public class RenderCapture
    {
        private ARealmReversed _realm;

        public RenderCapture(ARealmReversed realm)
        {
            _realm = realm;
        }

        public void Run()
        {
            var equ = _realm.GameData.GetSheet<Item>()
                .OfType<SaintCoinach.Xiv.Items.Weapon>()
                .ToArray();

            var source = new GarlandEquipmentRendererSource(equ);
            var renderer = new SaintCoinach.Graphics.Viewer.ImageRenderer(source, 1024, 768);
            renderer.Run();
        }

        private class GarlandEquipmentRendererSource : SaintCoinach.Graphics.Viewer.RendererSources.EquipmentImageRendererSource
        {
            public GarlandEquipmentRendererSource(IEnumerable<Equipment> equipment)
                : base(equipment) { }

            protected override System.IO.FileInfo GetTargetFile(Equipment item, Stain stain)
            {
                const int DirectorySeperationInterval = 1000;

                var fileName = string.Format("{0}", item.Key);
                if (stain != null)
                    fileName += string.Format(" (s{0:D4} {1})", stain.Key, stain.Name);
                return new System.IO.FileInfo(System.IO.Path.Combine("output\\Renders", (item.Key - item.Key % DirectorySeperationInterval).ToString(), fileName));
            }
        }

        private class GarlandFurnitureRendererSource : IImageRendererSource
        {
            IEnumerator<HousingItem> _iterator;
            Engine _engine;

            public GarlandFurnitureRendererSource(IEnumerable<HousingItem> items)
            {
                _iterator = items.ToList().GetEnumerator();
            }

            public IComponent CurrentComponent { get; private set; }
            public SaintCoinach.Graphics.BoundingBox CurrentBoundingBox { get; private set; }
            public System.IO.FileInfo CurrentTargetFile { get; private set; }
            public string CurrentName { get; private set; }

            public bool RenderFromOppositeSide { get; private set; }

            public bool MoveNext()
            {
                while (_iterator.MoveNext())
                {
                    var item = _iterator.Current;
                    //var model = item.m
                    CurrentName = item.Item.Name.ToString();

                    return true;
                }
                return false;
            }

            public void Reset(Engine engine)
            {
                _engine = engine;
                _iterator.Reset();
            }
        }
    }
}
