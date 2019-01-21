-- Lists
CREATE TABLE `Lists` (
  Id char(10) NOT NULL,
  Name varchar(100) CHARACTER SET utf8 NOT NULL,
  Hash char(40) NOT NULL,
  IP varchar(100) NOT NULL,
  Shared datetime NOT NULL,
  List text NOT NULL,
  Uses int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Hash` (`Hash`)
);

-- ListSummary
CREATE VIEW `ListSummary` AS
select `Id` AS `Id`,`Name` AS `Name`,`Uses` AS `Uses`,`Shared` AS `Shared`,`Hash` AS `Hash`,`IP` AS `IP`,length(`List`) AS `ListLength`
from `Lists`;

-- Search
CREATE TABLE Search (
    Id varchar(15) not null,
    Type varchar(15) not null,
    Name varchar(200) character set utf8 not null,
    OriginalName varchar(200) character set utf8 not null,
    Lang char(2) not null,
    Json text character set utf8 not null,
    primary key(Id, Type, Lang),
    key Index_Name (Name),
    key Index_OriginalName (OriginalName),
    fulltext key Fulltext_Name (Name)
);

-- SearchItem
CREATE TABLE SearchItem (
    Id varchar(15) not null,
    ItemLevel smallint unsigned not null, -- uint16
    Rarity tinyint unsigned not null, -- byte
    Category smallint not null, -- int16
    Jobs tinyint unsigned not null, -- byte
    EquipLevel tinyint unsigned not null, -- byte
    IsPvP bit(1) not null, -- bool
    IsCraftable bit(1) not null, -- bool
    IsDesynthable bit(1) not null, -- bool
    IsCollectable bit(1) not null, -- bool
    primary key(Id)
);

-- SearchRecipe
CREATE TABLE SearchRecipe (
    Id varchar(15) not null,
    ItemId varchar(15) not null,
    Job tinyint unsigned not null, -- byte
    JobLevel smallint unsigned not null, -- uint16
    Stars tinyint unsigned not null, -- byte
    RecipeLevel smallint unsigned not null, -- uint16
    primary key(Id)
);

-- DataJson
CREATE TABLE DataJson (
    Id varchar(15) not null,
    Type varchar(15) not null,
    Lang char(2) not null,
    Version smallint unsigned not null,
    Json mediumtext character set utf8 not null,
    primary key (Id, Type, Lang, Version)
);

-- DataJsonTest
CREATE TABLE DataJsonTest (
    Id varchar(15) not null,
    Type varchar(15) not null,
    Lang char(2) not null,
    Version smallint unsigned not null,
    Json mediumtext character set utf8 not null,
    primary key (Id, Type, Lang, Version)
);

-- Storage
CREATE TABLE Storage (
    Account char(10) not null,
    Id varchar(16) not null,
    IP varchar(100) not null,
    Modified datetime not null,
    Value text not null,
    primary key(Account, Id)
);
