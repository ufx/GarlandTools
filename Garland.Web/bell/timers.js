gt.bell.timers = [
    {
        title: "GATEs 1",
        func: "GATE",
        minute: 0,
        uptime: 20,
        desc: "Cliffhanger, The Time of My Life, Leap of Faith",
        id: "t1",
        zone: "The Gold Saucer"
    },
    {
        title: "GATEs 2",
        func: "GATE",
        minute: 20,
        uptime: 20,
        desc: "Any Way the Wind Blows, The Time of My Life, Leap of Faith",
        id: "t2"
    },
    {
        title: "GATEs 3",
        func: "GATE",
        minute: 40,
        uptime: 20,
        desc: "Any Way the Wind Blows, Skinchange We Can Believe In, Leap of Faith",
        id: "t3"
    },
    {
        id: "h1",
        title: "Central Shroud",
        func: "hunt",
        name: "Laideronnette",
        transition: ['Rain'],
        weather: ['Rain'],
        after: { eorzeaHours: 2 },
        cooldown: "43 - 48",
        maintenanceCooldown: "25 - 29",
        conditions: "After 10 Eorzean hours of rain (two cycles.)",
        patch: 2.3
    },
    {
        id: "h2",
        title: "South Shroud",
        func: "hunt",
        name: "Mindflayer",
        moon: { phase: 0, offset: 12 },
        cooldown: "50",
        maintenanceCooldown: "30",
        conditions: "Midnight during new moon.",
        patch: 2.3
    },
    {
        id: "h3",
        title: "Lower La Noscea",
        func: "hunt",
        name: "Croakadile",
        moon: { phase: 4, offset: 5 },
        cooldown: "50",
        maintenanceCooldown: "30",
        conditions: "First day of full moon after 5PM ET.",
        patch: 2.3
    },
    {
        id: "h4",
        title: "Eastern La Noscea",
        func: "hunt",
        name: "The Garlok",
        cooldown: "42 - 48",
        maintenanceCooldown: "21 - 29",
        conditions: "200m of dry weather after showers or rain.",
        patch: 2.3
    },
    {
        id: "h5",
        title: "Western Thanalan",
        func: "hunt",
        name: "Zona Seeker",
        cooldown: "58 - 68",
        maintenanceCooldown: "35 - 41",
        conditions: "Catch a Glimmerscale.",
        weather: ['Clear Skies', 'Fair Skies'],
        fish: {
            "name": "Glimmerscale",
            "patch": 2.2,
            "cbh": 237,
            "bait": [
              "Butterworm"
            ],
            "weather": [
              "Clear Skies",
              "Fair Skies"
            ],
            "id": 7714,
            "icon": 29339,
            "func": "fish",
            "title": "Nophica's Wells",
            "category": "Freshwater Fishing",
            "lvl": 5,
            "coords": [
              24.5,
              21.58
            ],
            "radius": 400,
            "zone": "Western Thanalan"
        },
        patch: 2.3
    },
    {
        id: "h6",
        title: "North Shroud",
        func: "hunt",
        name: "Thousand-Cast Theda",
        cooldown: "58 - 68",
        maintenanceCooldown: "35 - 41",
        conditions: "Catch a Judgeray.",
        during: { start: 17, end: 21 },
        fish: {
            "name": "Judgeray",
            "patch": 2.2,
            "cbh": 218,
            "bait": [
              "Wildfowl Fly"
            ],
            "during": {
              "start": 17,
              "end": 21
            },
            "id": 7695,
            "icon": 29340,
            "func": "fish",
            "title": "Fallgourd Float",
            "category": "Freshwater Fishing",
            "lvl": 15,
            "coords": [
              21.02,
              24.66
            ],
            "radius": 400,
            "zone": "North Shroud"
        },
        patch: 2.3
    },
    {
        id: "h8",
        title: "The Churning Mists",
        func: "hunt",
        name: "Gandarewa",
        time: [2, 14],
        uptime: 240,
        cooldown: "80 - 132",
        maintenanceCooldown: "80",
        conditions: "Gather Seventh Heaven [slot 1] or Aurum Regis Ore [6].",
        patch: 3.0
    },
    {
        id: "h9",
        title: "The Ruby Sea",
        func: "hunt",
        name: "Okina",
        moon: { phase: 4, offset: 0 },
        cooldown: "?",
        maintenanceCooldown: "?",
        conditions: "Full moon",
        patch: 4.0
    },
    {
        id: "h10",
        title: "Western La Noscea",
        func: "hunt",
        name: "Bonnacon",
        time: [8],
        uptime: 180,
        cooldown: "62 - 75",
        maintenanceCooldown: "39 - 45",
        conditions: "Gather La Noscean Leak [slot 6].",
        patch: 3.0
    },
    {
        id: "h11",
        title: "Middle La Noscea",
        func: "hunt",
        name: "Croque-Mitaine",
        time: [19],
        uptime: 180,
        cooldown: "62 - 75",
        maintenanceCooldown: "39 - 45",
        conditions: "Gather Grade 3 La Noscean Topsoil [slot 8].",
        patch: 3.0
    },
];