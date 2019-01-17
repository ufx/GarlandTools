// Node Types
gt.nodeTypes = ['Mineral Deposit', 'Rocky Outcropping', 'Mature Tree', 'Lush Vegetation', 'Spearfishing'];
gt.nodeJobAbbreviations = ['MIN', 'MIN', 'BTN', 'BTN', 'FSH'];
gt.fishingSpotCategories = ['Ocean Fishing', 'Freshwater Fishing', 'Dunefishing', 'Skyfishing', 'Cloudfishing', 'Hellfishing', 'Aetherfishing', 'Saltfishing'];

// Base Parameters
gt.baseParamAbbreviations = {
    'Magic Damage': 'Damage',
    'Physical Damage': 'Damage',
    'Reduced Durability Loss': 'Red. Dur. Loss',
    'Increased Spiritbond Gain': 'Inc. Spr. Gain',
    'Careful Desynthesis': 'C. Desynthesis',
    'Critical Hit Rate': 'Critical Rate'
};

gt.baseParamValues = {
    CP: 180
};

// Materia
gt.hqMateriaMeldRates = [
    // Sockets
    //2, 3,  4,  5     // Tier
    [45, 24, 14, 8],   // I
    [41, 22, 13, 8],   // II
    [35, 19, 11, 7],   // III
    [29, 16, 10, 6],   // IV
    [17, 10, 7,  5],   // V
    [17, 0,  0,  0]    // VI
];

gt.nqMateriaMeldRates = [
    // Sockets
    //2, 3,  4,  5      // Tier
    [40, 20, 10, 5],    // I
    [36, 18, 9,  5],    // II
    [30, 15, 8,  4],    // III
    [24, 12, 6,  3],    // IV
    [12, 6,  3,  2],    // V
    [12, 0,  0,  0]     // VI
];

// Grand Companies
gt.grandCompanies = { "1": "Maelstrom", "2": "Twin Adders", "3": "Immortal Flames" };

// Leve categories
gt.leve.category = {
    "Disciples of War or Magic": 'Battlecraft',
    MIN: 'Gathering',
    BTN: 'Gathering',
    FSH: 'Gathering',
    CRP: 'Crafting',
    BSM: 'Crafting',
    ARM: 'Crafting',
    GSM: 'Crafting',
    LTW: 'Crafting',
    WVR: 'Crafting',
    ALC: 'Crafting',
    CUL: 'Crafting',
    "Brotherhood of the Broken Blade": 'Legacy',
    "Azeyma's Shields": 'Legacy',
    "The Horn and Hand": 'Legacy',
    "The Maelstrom": 'Grand Company',
    "Order of the Twin Adder": 'Grand Company',
    "Immortal Flames": 'Grand Company'
};

// Special list icons
gt.list.specialIcons = {
    ALC: 'ALC', ALCHEMIST: 'ALC',
    ARM: 'ARM', ARMORER: 'ARM',
    BSM: 'BSM', BLACKSMITH: 'BSM',
    CRP: 'CRP', CARPENTER: 'CRP',
    CUL: 'CUL', CULINARIAN: 'CUL',
    GSM: 'GSM', GOLDSMITH: 'GSM',
    LTW: 'LTW', LEATHERWORKER: 'LTW',
    WVR: 'WVR', WEAVER: 'WVR',

    BLM: 'BLM', BLACK: 'BLM',
    ACN: 'ACN', ARC: 'ACN',
    SMN: 'SMN', SUMMONER: 'SMN',
    RDM: 'RDM', 'RED MAGE': 'RDM',
    BLU: 'BLU', 'BLUE MAGE': 'BLU',

    BRD: 'BRD', BARD: 'BRD',
    MCN: 'MCH', MCH: 'MCH', MACHINIST: 'MCH',

    DRG: 'DRG', DRAGOON: 'DRG',
    MNK: 'MNK', MONK: 'MNK',
    NIN: 'NIN', NINJA: 'NIN',
    SAM: 'SAM', SAMURAI: 'SAM',

    PLD: 'PLD', PALADIN: 'PLD',
    DRK: 'DRK', DARK: 'DRK',
    WAR: 'WAR', WARRIOR: 'WAR',

    AST: 'AST', ASTROLOGIAN: 'AST', ASTRO: 'AST',
    SCH: 'SCH', SCHOLAR: 'SCH',
    WHM: 'WHM', WHITE: 'WHM',

    MIN: 'MIN', MINER: 'MIN',
    BTN: 'BTN', BOTANIST: 'BTN',
    FIS: 'FSH', FSH: 'FSH', FISHER: 'FSH', FISH: 'FSH',

    DOL: 'DOL', GATHER: 'DOL', GATHERING: 'DOL', GATHERER: 'DOL',
    DOH: 'DOH', CRAFT: 'DOH', CRAFTING: 'DOH', CRAFTER: 'DOH',

    SCRIP: '../files/icons/item/11091.png', SCRIPS: '../files/icons/item/11091.png',
    'RED SCRIP': '../files/icons/item/7553.png', 'RED SCRIPS': '../files/icons/item/7553.png',
    'YELLOW SCRIP': '../files/icons/item/11091.png',

    EUREKA: '../files/icons/item/12032.png', RELIC: '../files/icons/item/12032.png',

    GLAMOUR: '../files/icons/item/11717.png', GLAM: '../files/icons/item/11717.png', FASHION: '../files/icons/item/11717.png',

    SPIRITBOND: 'images/Convert.png', SPIRITBONDING: 'images/Convert.png',

    VOYAGE: 'images/Voyage.png', VOYAGES: 'images/Voyage.png',
    AIRSHIP: 'images/Voyage.png', AIRSHIPS: 'images/Voyage.png',
    SUB: 'images/Voyage.png', SUBS: 'images/Voyage.png',
    SUBMARINE: 'images/Voyage.png', SUBMARINES: 'images/Voyage.png',

    HOUSE: 'images/House.png', HOUSING: 'images/House.png',
    MANSION: 'images/House.png', COTTAGE: 'images/House.png',
    APARTMENT: 'images/House.png',
    DECORATION: 'images/House.png', DECORATIONS: 'images/House.png',
    FURNISHING: 'images/House.png', FURNISHINGS: 'images/House.png',

    PATCH: 'LatestPatch',
    DAILY: '../files/icons/event/71222.png', DAILIES: '../files/icons/event/71222.png',
    QUEST: '../files/icons/event/71221.png', QUESTS: '../files/icons/event/71221.png',
    ORCHESTRION: '../files/icons/item/7977.png', ORCH: '../files/icons/item/7977.png',
    SATISFACTION: 'Satisfaction', DELIVERY: 'Satisfaction',
};

// Equipment slots
gt.item.equipSlotNames = [null, 'Main Hand', 'Off Hand', 'Head', 'Body', 'Hands', 'Waist', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrists', 'Rings', 'Main Hand', 'Main Hand', null, null, 'Soul Crystal'];
