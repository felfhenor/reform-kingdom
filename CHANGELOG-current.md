
# 0.14.0 (2026-11-14)


### Bug Fixes

* **combat:** manual combat should drain HP when the creature dies, rather than waiting to poof them
* **core:** remove the assumption that the party will always be 4 heroes
* **export:** don't export tmp files in dump
* **hero:** reclassing into a new class will give that hero the basic combat orders, if applicable
* **museum:** paged grids will now correctly measure columns
* **museum:** show equipment/material sources more fully
* **perf:** combat perf improved
* **perf:** pathfinding adjustments to improve performance
* **perf:** performance improvements for background/etc
* **savefile:** deleting savefile while in a game should not have the pause menu open in main menu, or be paused
* **savefile:** fix migrator for global effect sums
* **savefile:** visitedWorldNode rename broke savefiles and didn't migrate correctly
* **ui:** bestiary will properly display summon-only creature levels
* **ui:** electron quit button finally works
* **ui:** move progress bar up a little higher on nodes so it doesn't overlap with text
* **ui:** resupport color in checkboxes
* **ui:** rework padding/spacing in equipment cards. also, show all bonuses in equip area
* **worker:** clear out old data when confirming a different job
* **world:** heroes will update their overworld sprites when reclassing
* **world:** improve gutters on maps so ui doesn't cover up edges


### Features

* **armory:** add 'equip these' button
* **armory:** add loot filter 'except' section
* **bestiary:** rework spacing on columns so they don't push
* **bestiary:** show debuff resistances in bestiary
* **caravan:** caravans only will no longer roll cursed items
* **content:** add new bosses, new collectibles, new items for capstone challenges per zone
* **core:** update favicon
* **death:** rework death penalties to be much, much lower
* **decree:** add 'farm material' to mirror the node->location pattern for gathering
* **edict:** add completion rewards that are slowly usable throughout a playthrough
* **edict:** add pickable edicts, in-game display, etc
* **edict:** add taskmaster edict
* **edict:** edicts can now give you starting items
* **exchange:** improve exchange visuals for item exchanges. add one to carrina
* **exchange:** sort exchange nodes by name
* **kingdom:** add 'improvements' modal to track all nodes that still have outstanding material requirements
* **legacy:** support showing legacies
* **museum:** add materials tab
* **museum:** better display of unknown things
* **museum:** give materials the same 'crafted' placeholder
* **museum:** improve recognition of  unknown spots by sorting alphabetically
* **museum:** show equipment for completionists
* **museum:** show vow collectibles as faded so you can browse them
* **raid:** raids are now retryable
* **raids:** show estimated difficulty indicators
* **score:** support region seals
* **shrine:** buff shrine durations by default
* **shrine:** shrine of medina now gives more items on base gather + lucky gather
* **skill:** analyze now serves a purpose
* **skilltree:** skill tree nodes can have multiple ranks now
* **summary:** show overall score
* **summary:** support new global stat tracks for a run
* **summary:** support run stats
* **town:** substantially increase raid warning times
* **town:** town workers can now do combat too
* **ui:** add better indicator in siderail of what view is being looked at
* **ui:** add option to skip tutorials in game
* **ui:** add trepidation effect to explain the partys inability to pray for 5m
* **ui:** decree now shows a button that indicates how to interact with it; fix checkbox interaction
* **ui:** develop-able nodes will now signal what you don't have to upgrade, if applicable
* **ui:** improve armory search to search by any dimension represented on an item
* **ui:** more clarity on what is reachable / stamina costs for workers
* **ui:** requirements will now show 'k' indicators if a requested value >=1000
* **ui:** signal that outposts, at max level, become teleportable
* **ui:** trainings modal will now show costs for seen trainings
* **worker:** workers can now get combat materials
* **world:** add 'auto farm' for nodes so you can farm just that node on repeat
* **world:** add crafting shrine in fel summit
* **world:** develop-able areas now show a star when they're maxed out
* **world:** exchange nodes show what they accept, currency rows use the red/tooltip pattern
* **world:** outposts now give global move speed buffs for the region
