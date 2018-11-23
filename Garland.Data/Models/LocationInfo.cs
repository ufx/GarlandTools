using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Game = SaintCoinach.Xiv;

namespace Garland.Data.Models
{
    public class LocationInfo
    {
        public Game.PlaceName PlaceName;
        public string Name;
        public string FullName;
        public SaintCoinach.Xiv.Map Map;
        public dynamic Location;

        public LocationInfo(Game.PlaceName placeName, string fullName)
        {
            Name = placeName.Name;
            FullName = fullName;
            PlaceName = placeName;
        }
        
        public override string ToString()
        {
            return FullName;
        }
    }
}
