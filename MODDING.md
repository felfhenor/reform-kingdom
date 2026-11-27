# RFK Modding

At present, mods are data and art only - this is done in YAML. Sprites/animations/node backgrounds can also be added to mods. Tiled maps are possible, too. You can use [Tiled 1.12.2](https://www.mapeditor.org/2026/05/27/tiled-1-12-2-released.html) or newer to create maps (a template is provided). At this time, you cannot add custom scripts. Additionally, the demo cannot use mods.

## Mod Kit Structure

```
reform-modkit/
  MODDING.md                 this guide
  my-mod/                    your mod folder - rename this!
    mod.yml
    content/<type>/          one folder per content type
    sprites/<sheet>/         one folder per art sheet, plus backgrounds/
    maps/MyMap.json          a blank map to start from
    maps/tilesets/           the game's tilesets, so Tiled can open maps
  examples/showcase/         a complete mod that uses every feature below
  reference/
    content/<type>.yml       the name and id of every base-game entry
    maps.yml                 every base map, its size and its node names
    sprites/<sheet>.txt      every base sprite name, per sheet
    backgrounds.txt          every base node background name
    art/<sheet>/             one base sprite per sheet, to show size and style (look for an animation in the example showcase mod)
    art/backgrounds/         one base node background
```

In the mod kit, there are a lot of `.removeme` files that exist only to keep the folder structure of the mod kit. You should remove folders that are empty for cleanliness, but the game won't load them if there's nothing in them either way.

## Installing and Testing Mods

Mods can be managed on the "Mods" page, accessible from the home screen. On this page, there are a few actions you can take:

- Import Mod - if you zip up your mod, you can load it here
- Mods folder - in desktop mod, there is a mod folder that sits alongside the game where you can put mods (this folder accepts both zips and folders)
- mod.io - browse, install, and update published mods

Importing a zip will do a full check of the mod to make sure it works as expected. If there are errors, this screen will tell you. Mods in the mods folder will only get some basic checks applied to their setup.

To rapidly develop mods on desktop, keep your mod folder in the mods folder, start a run, and then when you make edits hit "reload mods" - this will re-read all of your mods and reload them in your current run. You don't need to change versions while doing things this way.

If you want to make map edits easier, go to Settings > Misc > Show Map Coordinates to toggle on a tooltip when you hover in the map to see x/y coordinates as well as real x/y (multiplied by 64). This will make placing things on existing maps way, way easier.

## Mods & Savefiles

- Mods that have "New Games" ticked will be used when a new game starts. These can be reordered to specify mod load order. Order is only important when it comes to edits - a later mod will apply it's changes last.
- A run will remember it's mods (id, name, version). If there are any missing, the save is not loaded or changed. You will need to install the mods and hit "Reload Game".
- A runs mods can be updated by bumping the `version` field in a mod. More can be added to a run while it's in progress, but you can never remove a mod from a run.
- Runs with mods do not earn achievements or send analytics, and will be called out in your legacy as `Modded`

## mod.yml

```yml
id: my-mod # lowercase letters, numbers and dashes. this is functionally a guid. once you publish your mod, never, ever change this.
name: My Mod
version: 1.0.0 # bump for every release
author: Your Name
description: What your mod adds or changes.
gameVersion: '0.16.3' # optional; players on another major.minor version see a warning. Make sure you keep it quoted! Unquoted, 0.20 would read as 0.2, which is not the same.
```

## Content

Look at `content/<type>/*.yml` for a list of entries. Look at `examples/showcase/content/` for working entries of the common game data types.

- Every new entry must have a unique `id` and `name`. You can, realistically, use anything you want for your ids, but guids look most normal in the game data.
- Refer to other content by `name` when doing `xId` references. Example: `monsterId: Grotto Crawler`. The linker will look up and check this for you. This can include base game content, other mod content, or your own mods content.
- Names must be unique across the whole game. No single piece of content uses the same name as another.

## Patching Base Game Content

When specifying an entry with an `id` that already exists (see `reference/content/*.yml` for existing ids), the result will be _patched_ rather than _added_ to the game. This means mods have mostly entirely free reign through the entire game since everything is content-driven. Other notes:

- Objects merge field by field
- Arrays are _replaced_ in their entirety, _not_ merged.
- Since mods apply in order, two that conflict with each other will have the _last one in order_ be the winner.
- Since patches change the _definition_ of an object, most content in game should update automatically. So if you choose to make an item have a base +15 LUK, those items should update automatically in game, rather than needing to find a new one.

A simple patch below would change the description of Copper Ore:

```yml
# content/item/patches.yml
- id: f251e6ea-bfc1-4562-b31a-492ec04d3c9f # Copper Ore
  description: A new description.
```

## Art

Art is contained in `sprites/<sheet>/<sprite>.png`, where `<sheet>` is the content type that uses it (`item`, `equipment`, `monster`, `job`, `skilltreenode`, `collectible`, ...). Use it with `sprite: <sprite>` on the entry. In the base game, things are named `0000.png` and such for spritesheeting purposes. Mods do not get spritesheets in the same way, so you can name the files anything and refer to them by name in the same fashion.

There are some specifications for art:

- Art is 64x64 _in general_ (achievements are the only different type, however, you will probably not be adding those with a mod).
- Animated sprites (monsters, workers, etc) are a horizontal slice of 64x64 sprites. On the content entry, you set `frames: X` to indicate how many frames it should be.
- A sprite named like a base sprite (see these in `references/sprites/*.txt`) will replace that art in the base game, too.
- When shipping an update to base game sprites, make it an X by 64 spritesheet named after the _first_ frame. So, if you wanted to replace the goblin art, make a sprite called `0000.png`, 256x64, and put it in `sprites/monster`.

### Node Backgrounds

An addendum to the above. Node backgrounds are a unique type of art that have different specifications. These go in `sprites/backgrounds/`, and must be 1920x1080. You can then use `background: yourbgname` on relevant content entries: encounters, node overrides, gathering nodes, towns, shrines, etc. You can see the base names in the reference folder and override them similarly to how you would other things.

## Maps

Maps are made in [Tiled 1.12.2](https://www.mapeditor.org/2026/05/27/tiled-1-12-2-released.html). Open `maps/*.json` in Tiled, rename it, and fill in the details. Here is some base information about maps:

- Tilesets in `maps/tilesets` are what the game has by default, and the game will always use it's tilesets. If you want to add custom art, you need to make a new tileset and draw from that.
- Other `tsj` files can be your custom art (as above). Do not name them like the existing games `tsj` files.
- Mod maps cannot use names of existing maps. If you want to patch a map, add content like how the `showcase` mod does it: `<map>.patch.yml` and put the new entries in there.
- Add a `region` entry with `mapName` set to the maps file name (without `.json`), then give it a description and such.

### Map Layers

Layers are blended top-down when rendering the map. You can dissect existing maps to see the tricks used to do some visual things (like path bridges), but they're fairly simple. This layer explanation will likely illustrate:

- Explore Nodes - All of the nodes that heroes can visit (towns, explores, gathers, etc). See Map Nodes (below) for a full list.
- Path Objects - Similar to Path Tiles below, but for one-off paths. Often used when making bridges.
- Decorative Objects - Similar to Decorative Tiles below, but for one-off decorative objects.
- Dense Objects - Similar to Dense Tiles below, but for one-off dense objects.
- Path Tiles - Tiles that the game should use when routing heroes through the world.
- Decorative Tiles - Decorative tiles that are only rendered, can be walked over, etc. Examples: flowers.
- Dense Tiles - Tiles that are not able to be passed through for pathing.
- Blending Tiles - A second layer of tiles that can blend terrain types, like if you want snow on top of grass, for example.
- World Tiles - The base coat of paint. Usually a splash of something in `terrain`, like green or whatever.

### Map Nodes

| Node type           | Content type                         |
| ------------------- | ------------------------------------ |
| `ExploreNode`       | `encounter`                          |
| `ExploreRandomNode` | `encounterrandom`                    |
| `GatherNode`        | `gathering`                          |
| `CaravanNode`       | `caravan`                            |
| `ExchangeNode`      | `exchangenode`                       |
| `Shrine`            | `shrine`                             |
| `Trainer`           | `trainer`                            |
| `Outpost`           | `outpost`                            |
| `NonPlayerKingdom`  | `town`                               |
| `CollectibleGate`   | `collectiblegate`                    |
| `TeleportNode`      | `nodeoverride` (for its description) |

A node must be on a walkable tile, or it can't be explored.

### Map Connections

Maps connect via a `TeleportNode` with `tag` and `toTag` set. This means you place two teleport nodes, and the game will route the heroes accordingly. Since teleport nodes don't really have their own data type, use `nodeoverride` to change properties like the background and description of a teleport. `tag`/`toTag` should be set in Tiled custom properties.

To add an entrance to a map off of a base map (likely required for your use case), you would add a map patch (`maps/<mapname>.patch.yml`) that looks like this:

```yml
# maps/Carrina.patch.yml
- name: Grotto Entrance
  type: TeleportNode
  gid: 442
  x: 1920 # from Show Map Coordinates
  y: 2048
  width: 64
  height: 64
  visible: true
  properties:
    - name: tag
      type: string
      value: CarrinaToGrotto
    - name: toTag
      type: string
      value: GrottoToCarrina
```

`gid` is the "global id" in Tiled. The easiest way to figure out the `gid` for the tile sprite you want is to place one on the Explore Nodes on the map and look at the `gid` property in the resulting JSON file. Tiled does not seem to display this information anywhere in the editor, at least nowhere easily accessible.

## Publishing on mod.io

Zip up the resulting mod directory when you're happy with it, set the mod.io mod version to be the same as your `version` in the `mod.yml` file, and get your metadata filled in on `mod.io`. Players will see an "Update" button whenever their mod version is different from what's on mod.io.
