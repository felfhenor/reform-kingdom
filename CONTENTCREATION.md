# Content Creation

When creating content, there may sometimes be a lot of upfront data that needs to be added, or there might be a massive checklist for it. This document covers the types of content creation and what they entail.

## General Notes

Sprites come from various sprite packs, and have been pre-processed in the following ways:

- Admurins sprites have been upscaled to exactly 64x64
- Oryx sprites have been upscaled to exactly 64x64
- Spellbook icons have been downscaled to 16x16, then upscaled to 64x64 (for a pixelated look)

Currently there is no repository for these, so creating new content is harder to do if you're not someone with access to those materials.

# Content Types

## Maps

The most massive type of content, requiring a lot of design and sub-content pieces. When making a map, the easiest way is to copy the `Template.json` file, then edit from there. Maps should be a minimum of 31x31. It should have tilesets, patterns, etc already set up. After designing the map, the following things need to be created (where applicable):

- [ ] Combat Nodes
- [ ] Procgen Combat Nodes
- [ ] Gathering Nodes
- [ ] Travel Nodes
- [ ] Caravan Nodes
- [ ] Collectibles
- [ ] Gathering Materials
- [ ] Equipment
- [ ] Monsters
- [ ] Tradeskill Recipes

## Combat Nodes

These have monsters, and a level. Monsters need to exist before they can be put into combat nodes. In terms of rewards, these _always_ need a collectible. They should have some drops beyond that - spread between gathering materials, equipment, recipes, or workers. Typically, workers will drop from "hard" encounters, so, boss encounters would drop these.

## Procgen Combat Nodes

These have monsters, and a level. They're configured a bit more randomly than normal encounters. Also, they _should_ conventionally drop a worker to be rescued.

## Gathering Nodes

These need to exist for workers to level up. They should typically drop 1-3 materials - trending towards 2-3 rather than 1, with at least one drop being a rare-ish drop.

## Travel Nodes

These need to exist to travel between maps.

## Caravans

Caravans have a few levers going on: they have both valid traders (within their level range), as well as their valid commissions. Every caravan needs commissions (ideally, these should span the entire zone, but they might not). They also will need traders.

## Traders

Traders have a list of items they will buy and sell, and also, each trader _should_ have a unique collectible that can be acquired using Trader Scrip. Other Scrip trades can be added, but they should be valuable trades.

## Tradeskills

Adding a new tradeskill requires a lot of tradeskill recipes.

## Tradeskill Recipes

A tradeskill recipe should usually utilize zone-specific materials and create zone/level-appropriate equipment, or refined materials.

## Jobs

Adding a new job requires adding:

- [ ] New equipment (if needed)
- [ ] New equipment slots (if there needs to be one)
- [ ] New skills & skill paths

## Skills
