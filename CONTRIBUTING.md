### Garland Tools Contribution Guide

This is the setup and contribution guide designed to help you setup your very own Garland Tools.  The site requires a simple LAMP stack and minimal resources to operate, even at very high visitor counts.

# Developer Setup
These are one-time steps needed to build the primary data importer and bootstrap your server.

### Important Repositories
* [Garland Tools](https://github.com/ufx/GarlandTools).  This repository.  Everything needed to build the garlandtools.org website.
* [SaintCoinach](https://github.com/ufx/SaintCoinach).  A library for building game data.
* [Sapphire](https://github.com/SapphireServer/Sapphire).  Database is used for mob data.
* [xivModdingFramework](https://github.com/liinko/xivModdingFramework).  Needed for `Garland.Graphics.Exporter` to extract 3d models.

### Build Prerequisites
* [ImageMagick](https://www.imagemagick.org/). For image compression.
* [ffmpeg](https://ffmpeg.org/). For taking audio samples.

### Optional Prerequisites
* [WinMerge](http://winmerge.org/). Or whatever diff program you like.  The UI supports opening an external diff viewer for comparing json changes.

### Server Environment
* MySQL or MariaDB.  Schema found in `Garland.Server/Schema/keystore.sql`.
* Nginx.  Anything works, but there is a sample configuration including rewrite rules and CORS headers for nginx in `Garland.Server/nginx-garlandtools.org`.  The `/files` path must point to the `gtfiles` repository.
* PHP

### Building
1. Repositories must be cloned as siblings on the filesystem, e.g. `$HOME/code/gt, $HOME/code/SaintCoinach, $HOME/code/xivModdingFramework`.
1. Open the `Garland.sln` solution in Visual Studio.
1. Set active solution platform to x64 from Any CPU.
1. Acquire a copy of Libra Eorzea's `app_data.sqlite`, and place it in `Garland.UI/External`.
1. Copy `Config.json.default` to `Config.json`.  Change everything for your setup.
1. Import `Garland.Server/Schema/keystore.sql`.
1. Import Sapphire's `schema.sql` and `inserts.sql`.
1. Build and run `Garland.UI`.

# Importing Data
Data imports occur every time a new patch is released.  This is managed primarily via SaintCoinach and Garland.UI.  Data is regenerated in full on every run.

### SaintCoinach
FFXIV data is expressed as a series of tables.  Column names are reverse-engineered and guessed by community members.  SaintCoinach's `ex.json` is the primary source of these definitions, along with some primitive structures.

1. Run `SaintCoinach.Cmd.exe` _prior_ to patch release.  An essential `SaintCoinach.History.zip` is generated.
2. Run `SaintCoinach.Cmd.exe` and select Y when prompted to update.  This compares information from history to predict definition changes.  Such changes are very common, so this is absolutely necessary on each patch.  Exit SaintCoinach.Cmd when updates are done.
3. Copy the `ex.json` in the `SaintCoinach.History.zip` root folder over `SaintCoinach/ex.json`.
4. Inspect the file manually for erroneous changes.  The updater is great but not flawless, so this requires a human touch.

### Garland.Graphics.Exporter
Uses xivModdingFramework to extract 3d assets.  Will automatically begin extracting on run.

### Garland.UI
1. In `Garland.UI`, click `Database -> Convert game client files`.  This step will not change anything on the server, and is safe to run repeatedly.
1. There is a command to download high quality icons from Lodestone.  This takes a long time to run, especially if it's your first time.
1. Conversion in step #1 generates data update packages that can be inspected for changes.  Side-by-side json document comparisons are available in the UI.
1. Individual data packages can be deployed via context menu.
    * Document data packages (i.e. Data01, Data02, etc.) first deploy to a staging test table.
    * Search data packages go straight to production, so it's best to run these last.
1. Assets are extracted to the configured `gtfiles` location.  These must be synchronized with the server before data is deployed to production.
1. After testing and synchronization, run `Database -> Deploy test data to production`.
1. Delete your data packages from the context menu.

### Supplemental Data
Some data isn't available from the client files and thus supplemental sources are required.
* Sapphire's mysql database has mob name, model and location data.
* Libra Eorzea's sqlite database has mob drops, instance loot, and shop NPC locations.
* Lodestone has 128x128px item icons and patch graphics.
* [FFXIV Data Spreadsheet](https://docs.google.com/spreadsheets/d/1hEj9KCDv0TT1NiGJ0S7afS4hfGMPb6tetqXQetYETUE/edit) has everything else:
    * Nodes: Timed node contents, slots, locations, and times.
    * Fates: Fate positions and rewards.
    * Fishing: Bait, conditions, tug types, and more.
    * Mobs: Mob locations.
    * Items: Item sources for desynth, aetherial reduction, treasure maps, ventures, concealed nodes, instances, gardening, and voyages.
    * NPCs: Event NPC indicators, used to exclude shops from complexity calculations.
* Individual sheets from the data spreadsheet are exported as TSVs and stored in `Garland.UI/Supplemental` because the Google Sheets API sucks and can't retrieve individual sheet data.

# Website
There are three main sites and a supporting API in PHP.  No resources are compressed or minified.  Running the website should be as straightforward as synchronizing the files with the server.

### Garland Database
Whenever .js changes are made, run `make.bat` to combine these into a single `gt.js`.

### Test Mode
The website can operate in a test mode pointing at an external `test.garlandtools.org` server for the API.  Fill an IP for this host in your etc/hosts file and all you will need is some way to serve files to a browser.  Test mode is automatically triggered when the site detects `localhost`.
