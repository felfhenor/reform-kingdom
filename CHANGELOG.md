
## 0.12.2 (2026-10-25)


### Bug Fixes

* **analysis:** analysis script will factor in infusion materials correctly for utilization
* **analysis:** analysis script will no longer report on internal usage-only items (fluxes)
* **bug:** clicking on a commission with a monster requirement will no longer throw an error
* **bug:** fix job sprite load issue
* **ui:** fix ui collections rebuilding when they should not


### Features

* **astralprojector:** add tier 3 spells
* **content:** add 2 new demon traders, add felway smuggler node
* **content:** add new town infusions for elfheim and larsia to help smooth the curve
* **content:** add some gap-filler infusions across the game
* **content:** add some gap-filler items for slime / ghosts
* **content:** add some typing variety to monsters in fel area
* **content:** improve accessibility of agility / add some tradeoffs to existing gear
* **content:** improve slime core drop rates beyond level 10. add a new larsia node with red slimes.
* **content:** rebalance some items to include more diversity - more slayers, more resistances, etc
* **content:** rework some early game gear to give air resistance, add more fire resist in larsia
* **content:** traders now sell rarer infusions for scrip
* **rumor:** add rumor system. praying to the founder gets a whisper. rumors are buyable to just unlock them if needed, too.
* **skilltree:** add a bunch of new passives to give parity between classes and their node quantity, and to fill some space
* **skilltree:** make the top line for learning more pronounced

## 0.12.1 (2026-10-24)


### Bug Fixes

* **analytics:** analytics can only even be turned on when not embedded
* **balance:** nerf earthshake
* **caravan:** clean up buying items
* **combat:** taunt should only draw attacks, not heals or buffs
* **commission:** commissions will no longer roll if the recipe is not owned by the player (not by tradeskill level, just recipe item)
* **commissions:** only show commissions for nodes the player has discovered
* **desktop:** desktop builds will not prompt to download the game
* **item:** demon horn & wolf pelt infusions give all their stats
* **loader:** wait for version to load correctly to cache bust urls correctly
* **recipe:** recipes will always drop, but will call out when they're gated
* **ui:** discord links cannot be copied in iframe environments like galaxy
* **ui:** rework display of common things like stats to be more consistent across the board
* **ui:** worker ui has less jitter with a static height for description
* **ux:** improve load screen by taking main-thread animations and removing them or moving them


### Features

* **analysis:** add analysis script for skill trees
* **armory:** crafted equipment auto sells now
* **build:** add idb-compatible updates file
* **commission:** always have a 3-scrip commission given by default for basic trader
* **commission:** tell users what they got when turning in commissions
* **discoverability:** the game will no longer leak names of things that it shouldn't
* **loader:** add loader for fonts
* **loader:** map loader is much snappier!
* **loader:** preload interface art
* **loader:** preload more icons
* **loader:** preload ui scripts
* **loading:** add fun loading screen stuff
* **shrine:** add preview of shrine effects in the info section
* **skilltree:** add full preview to skill tree
* **skilltree:** add skill tree help text
* **skilltree:** make icons more descriptive on hover for elements, skills, and effects
* **skilltree:** show burst skill element costs
* **skilltree:** show burst skills separtely from skills
* **task:** clear the overwhelming task list and let it fold out more naturally as the player explores
* **task:** tasks now have a locator button where applicable
* **ui:** add consistent skill tooltips in other places
* **ui:** add ep to skill tree details
* **ui:** improve accessibility of monster info / consistency
* **ui:** increase consistency for equipment displays
* **ui:** log messaging for tradeskills & first town visits
* **ui:** log more player actions in the log rather than just having popups
* **ui:** log more ui actions in the logs
* **ui:** more messaging added for logs/missed actions (like raids)
* **ui:** museum recipes now display items everywhere, including town queue

# 0.12.0 (2026-10-21)


### Bug Fixes

* **combat:** buffs can never miss
* **combat:** buffs should never be able to miss based on target LUK
* **dx:** invalid asset files won't crash the file watcher anymore
* **hero:** promoting a hero will no longer cause that hero to disappear from the list
* **ui:** be more explicit about what duchy actions / combat actions are
* **ui:** region intros will sit in place rather than jump around while typing


### Features

* **combat:** support "cover" combat stat
* **combat:** support EP draining
* **decree:** decree should show gray background on items for readability
* **discord:** add a few more discord statuses
* **job:** add cover, follow up, and monster research passives
* **job:** add ranger scavenger ability
* **skills:** add 'prefers heroes' in prep for ultimate skills
* **skill:** shields are now a thing skills can do. add aegis.
* **skilltree:** add hero spec icons/labels
* **town:** add 'buy max' to town materials
* **ui:** caravans have buy max too
* **ui:** show quantity of owned materials on gather nodes and rewards
* **ui:** support ui scale in game
* **world:** can double click to travel to a location
* **world:** make wergen sticks more common by default

## 0.11.1 (2026-10-14)


### Bug Fixes

* **content:** remove extraneous cost entries that don't apply to current content
* **dx:** clean up # of writes/reloads when saving a data file
* **map:** map should add commas to quantities, too
* **ui:** combat orders should always show icons - even in regalias!
* **ui:** hero page now correctly lines up skills with other parts of the ui
* **ui:** smoke puff should only trigger when looking at the screen where it's active
* **ux:** less jank/jitter on world setup page
* **world:** labels should render above heroes


### Features

* **armory:** add some color to the otherwise blank-background while selling
* **combat:** log shows hp/ep remaining for target
* **heroes:** add hero abilities based on jobs
* **lore:** add lore
* **lore:** lore popups shatter now
* **merchant:** trades remaining -> stock
* **npe:** new players will get some default combat orders (hidden until level 3), as well as a starting item to make sure every class has something they can use to use those orders with
* **setup:** hide analytics when hitting new game
* **ui:** show # owned items in worker page
* **ui:** show when hero skills are blocked by inability to use a skill
* **ux:** add icons for each kingdom location/action so it's not a weird mix
* **ux:** rework the entire application to have a simpler, more consistent UX
* **ux:** rework ux of heroes page so it isn't button hell in random places
* **world:** add timers to developable nodes
* **world:** gathering nodes will now show tradeskills corresponding with each gather material

# 0.11.0 (2026-10-12)


### Bug Fixes

* **analysis:** lifesurge should not give analysis warnings
* **armory:** loot filters now have white text buttons
* **ci:** CI should show the correct errors now
* **content:** felway monsters should drop fel essence
* **core:** add build-barrels, add a bunch of barrels, lazy-load helpers since it's not urgent
* **decree:** raid defense will travel through nodes
* **decree:** should reset to 100 even after submitting a clause
* **tradeskill:** adjust math slightly for what recipes should give so the gradient works as expected
* **ui:** ensure tooltips on disabled currency row actions show
* **ui:** Lv. text consistency in more of the game
* **ui:** savefile panels are all the same height
* **validate:** add validation to make sure monster drops are not 0%
* **world:** diurtar level range fix - prevent this with validation
* **world:** no more 1 xp, always 0 xp if too overleveled
* **world:** traveling in the world should not look so janky


### Features

* **commission:** commissions now let you click on the icon to navigate to the tradeskill
* **content:** felrock -> copper ore is now 5s
* **decree:** add a "gather material" that is "gather from node" but in reverse
* **equipment:** reroll will now have some unique affixes
* **museum:** museum now has spoilers for unseen map nodes
* **nav:** add a quick action for trainer access
* **nav:** rework navbar to have bigger/more readable buttons + move the town button to the right side
* **regalia:** add regalias
* **setup:** show job shorthand in world setup since it's used everywhere in game
* **skill:** add burst skills, add a lot of new skills to enemies, bosses, heroes, trainers
* **skill:** add tag for reflectable skills
* **ui:** add "clean text" option
* **ui:** add a side rail for quicker nav in kingdom area
* **ui:** add detailed material sources for tradeskill crafting/astral projector/commissions/general requirement slots
* **ui:** currency rows will display sources for items to make them easier to find
* **ui:** display icons for source nodes in material tooltips
* **ui:** show sprites in class dropdowns for reclass/new game
* **ui:** support 'difficulty colors' for a more consistent UX in anything that requries difficulty
* **ux:** consistent hint/etc messages
* **ux:** improve tab ux
* **ux:** remove outlined badges everywhere
* **ux:** rework 'reforge' and 'infuse' into 'workshop' - add tutorials, fix other tutorials for bursts
* **worker:** workers can now craft materials
* **world:** add a little background noise to the map
* **world:** duchy node should have an action

# 0.10.0 (2026-10-09)


### Bug Fixes

* **adventurelog:** display should be a bit less jank for longer messages
* **analysis:** fix obtainability when granting an item from a higher level to lower level recipe
* **analysis:** outposts should count as routable for workers in analysis tools
* **bestiary:** add better number formatting to bestiary
* **bestiary:** bestiary ??? nodes are not clickable if the creature is not discovered
* **combat:** final encounter of combat should always give combined rewards rather than showing multiple log lines for them
* **combat:** rework status effect ticking & downscale stun chance on sonic screech
* **commission:** commission turn in should resync the encumbered effects
* **crafting:** crafting with an item will now refund that specific item, rather than a generic one
* **data:** item rewards will always have a min/max of 1, rather than 0
* **decree:** decree now supports mystical nodes for "farm node" with appropriate warnings
* **decree:** decree will no longer try to finish an area with a recipe that can't drop
* **decree:** decree will not go to mystic nodes that have no rewards available
* **decree:** finish unfinished nodes should explore mystical nodes, too
* **decree:** nodes like spiders tower are no longer inaccessible via decree
* **decree:** priority change fixes for decree
* **hero:** fix compare tooltip to have a min width too
* **hero:** only show items for a lot when it is the primary of that slot
* **hero:** optimizer will better support multi-slot items
* **item:** display gather yield with more description so it makes more sense
* **item:** rename hawk feather collectible so it isn't so close to hawk feather item
* **map:** progress bar indicator should allow 3 lines of text below it
* **party:** mismatched party levels will not ruin xp gain for the lowest levels
* **reset:** resetting game should reset adventure log state
* **tasks:** add a little margin to space bar & text out
* **town:** craft pick on first visit should be equipment, not materials
* **tradeskill:** recenter the uncraftable checkbox
* **tradeskill:** reduce dependence on red slimes cores significantly
* **tradeskill:** remove ui jitter when tradeskill requirements exist
* **tradeskill:** tradeskill chips should use # with a comma
* **tradeskill:** tradeskill ui should fold a bit better
* **ui:** back button on left, now an icon. rework spacing on most pages to fit the ui better
* **ui:** fix small collision with top right cards & currency
* **ui:** local storage for some things is dumb and shouldn't be
* **ui:** optimize all should also be disabled in combat
* **ui:** remove redundancy in pause menu
* **ui:** slight misalignment with combat orders
* **ui:** worker/hero page xp bars are now the right color, show "XP", and have similar widths
* **vfx:** disable vfx when page is hidden
* **world:** rebalance gathering nodes in larsia to be 10 second gathers


### Features

* **adventurelog:** allow searching in adventure log
* **adventurelog:** better display of messages when raid loss happens
* **combatorders:** add support for 'enemy health vs %', matching enemies, and fix targetting related to that
* **combat:** show debuffs/buffs in combat per combatant
* **commissions:** move badge to better page location
* **content:** add an infusion to kor'ratha
* **decree:** workers & heroes using decree can use outposts for teleports
* **equipment:** equipment has elemental resistances, buffs, etc now. so do monsters!
* **infusion:** infusion can now infuse items in armory
* **infusion:** rework infusion ui to be laid out similar to reforge
* **map:** map should use the same font as the game
* **outpost:** +5 outposts can teleport between each other
* **outposts:** add outposts
* **reforge:** add reforge feature
* **reforge:** move reforge button to new action area
* **savefile:** add better backup resilience for savefiles
* **skill:** skills support accuracy now
* **town:** allow raids to be resolved in other ways - more coming
* **town:** put raids on cooldown the moment a town is visited to give some grace time
* **town:** start crafts and give town some starter items when visiting for the first time
* **town:** towns get a default set of materials when you visit them the first time so they don't start from scratch, which is unrealistic
* **tradeskill:** be much more clear about how tradeskill xp works
* **tradeskill:** the max queueable for a recipe is different from max craftable - this is reflected correctly
* **trainer:** rebalance need for buyable only infusions
* **tutorial:** add a tutorial for when players are struggling
* **ui:** add click-to-navigate for crafting cards too
* **ui:** add tooltips to optimize to instruct on what it does and how it works
* **ui:** can use shift+click to bypass some modals in game
* **ui:** move all search bars to a common location
* **ui:** show when something requires a tradeskill level to drop
* **ui:** unite icons under a similar component, add colors to other stat-related things
* **ui:** worker level up indicator goes to the worker ui
* **ux:** kill border radius globally
* **workers:** show whether or not workers get XP on a node, show level range on the current assignment to track it better
* **world:** add a worker to kor'ratha
* **world:** add exchange nodes that can swap items
* **world:** gathering nodes get a time reduction for leveling them up

# 0.9.0 (2026-09-27)


### Bug Fixes

* **core:** adventure log xp gain message + real xp gain message were desynced
* **heroes:** re-align gear/equip col/skill col so they line up better
* **loading:** loading screen doesn't jank out before the bar is filled
* **tradeskill:** fix perf of tradeskill ui
* **ui:** fix jank animation of numbers on hero page
* **ui:** make sure adventure log overlay always sits in the same spot
* **ui:** remove confetti animation and use gold swoosh for workers


### Features

* **combat:** better damage numbers for combat
* **combat:** damage numbers ~pop~
* **heroes:** add ability to promote and demote heroes at the duchy
* **heroes:** add optimize all button
* **heroes:** rework 'equippable by' to include class names rather than hero names
* **tasks:** add an icon!
* **tasks:** add tasks to help with player onboarding
* **tradeskill:** add filter to tradeskills
* **ui:** add a gold burst anim for leveling up heroes
* **ui:** add a small stagger-in anim for bestiary
* **ui:** add a world log overlay on thescreen that gives an at-a-glance view of what's going on
* **ui:** add animation for monster entry in combat
* **ui:** add animations for lists
* **ui:** add animations to hero panel stats
* **ui:** add same animations to combat orders
* **ui:** add some more number tweening
* **ui:** animation for modal
* **ui:** bars support shimmer, loading screen has shimmer now
* **ui:** cap size of central game panels
* **ui:** decorate decree clauses a bit
* **ui:** disabled buttons can have tooltips (duchy actions now have them)
* **ui:** flyTo animation added for crafting
* **ui:** improve display for worker level up to be consistent. add a fun pop!
* **ui:** remove transition, fade in pages
* **ui:** show energy/xp gain numbers too
* **ui:** task animations
* **ui:** tutorial has an animation
* **world:** add trainers. they can teach you new things that persiste beyond class changes

# 0.8.0 (2026-09-22)


### Bug Fixes

* **bestiary:** allow all ranges of all nodes to be selected
* **core:** better error handling for gameloop
* **core:** load sound as part of the loading process, rather than later, randomly
* **core:** reset ui state when resetting game
* **kingdom:** kingdom can only set home if you're there
* **perf:** make maps load all at once instead of one at a time
* **recipe:** actually block town recipes from being obtainable
* **recipe:** recipe drops won't happen unless you can use the recipe
* **setup:** stat display in world setup looks good again
* **simulator:** sim works again
* **town:** button resizing should not jitter the ui
* **town:** limit output of a similar equipment item so it can't flood the same item out
* **ui:** swap kingdom/world in navbar
* **validation:** condense validation scripts into one rather than having a dozen


### Features

* **affix:** affixes can now limit themselves by item level
* **analysis:** add skill analysis script, make sure all content passes it
* **crafting:** queuing an item will add it to an existing entry or split, if possible
* **debug:** reorganize debug output to make content gaps easier to sort through
* **decree:** add help info for level up party clause
* **hero:** better use of space for equipment
* **home:** add a nicer home screen
* **infusion:** add infusion animation
* **infusion:** show # slots on infusion equipment
* **items:** affixes can now improve specific spells
* **monster:** support monsters having min/max levels on skills like they do with item drops
* **navbar:** highlight town separately so it doesn't blend in with the rest of the nav entries
* **npe:** expand heroes by default
* **setup:** hide stats on new run screen
* **setup:** more random hero names
* **shrine:** add mobility of the explorer so it really works
* **town:** show ETA for workers
* **town:** towns will sell excess materials to the player
* **tradeskill:** item recipes can now give >1
* **tradeskill:** tradeskill ui alphabetizes resources in crafting requirements
* **ui:** add anime.js to remove some cumbersome animations
* **ui:** add more animations for bars, etc
* **ui:** add tutorial popups for simpler features/callouts
* **ui:** adventure log fades in chunks at a time
* **ui:** improve display of skills/techniques. fix some skill tagging.
* **ui:** improve hero equipment screen layout/consistency
* **ui:** kingdom button/hotkey will go back to main kingdom page if it's the active subview
* **ui:** make more areas tabular-nums so they don't jitter as much
* **ui:** show currency gains with a floating number
* **worker:** show level up icon on the worker card

# 0.7.0 (2026-09-15)


### Bug Fixes

* **heroes:** fix ui scrunching with progress bar
* **hero:** hero equipment compare area is shrunken a bit
* **recipe:** recipes should not show in adventure log when already discovered


### Features

* **armory:** add auto sell functionality
* **armory:** armory caps at 50 items. this will change.
* **collectible:** add decree cap/boosts to collectibles
* **collectible:** add more collectible effects, juggle rarities
* **collectible:** can increase armory size
* **collectible:** collectibles can increase speed off-path
* **collectible:** make some collectibles do things
* **collectible:** some collectibles can boost queue sizes for kingdom tradeskills
* **debug:** add collectible unlock debug command
* **docs:** add content segmentation guide so it's easier to remember what can do what (and what *should* do what)
* **kingdom:** can now reset your kingdom to home
* **kingdom:** rework kingdom view to use bar-progress
* **merchant:** add two new merchants
* **shrine:** add confirmation for praying
* **ui:** improve toast visuals to match the rest of the ui a bit more
* **ui:** sweetalert2 looks more like it fits in game

## 0.6.2 (2026-09-14)


### Bug Fixes

* **armory:** armory should allow search by item full name w/ affixes
* **astralprojector:** disable projector if no spells are learned
* **combat:** cap healing ignore after damage reduction rather than before, in case of debuffs
* **combat:** ui card showing skill should fade skill after 750ms instead of 1500ms to allow the next skill to fade in
* **debug:** use other slots for data where applicable
* **tests:** tests compile and reference the correct types
* **town:** if an item disappears from the shop when bought, the user should be notified
* **town:** towns should refresh their buff when rep level changes
* **trader:** traders should not be able to be at two different caravans at the same time
* **ui:** add user-select none to combatant cards and craft/worker cards
* **ui:** disable explore again if in combat
* **ui:** dont show the helpers or monsters if they're not present, to make ui more clickable
* **ui:** hero ui should have scrollbars for skills/stats
* **ui:** make stagger text on map more staggered
* **ui:** use background sprite for recipes
* **ui:** worker interface should not show stale materials when changing locations
* **worker:** disable locations that are too high level
* **world:** fix reward panel to show unified tooltip where needed


### Features

* **affix:** add some affixes that are prefixes to try to drown out some of the cursed ones
* **bestiary:** add monster types in preparation for a few new features
* **bestiary:** improve bestiary level selection
* **combatlog:** remove unnecessary no skills available line
* **combatlog:** show sprites for monsters and heroes inline
* **core:** add new gear to fill in some early gaps
* **debug:** add debug helper to teleport to node
* **debug:** analysis tools now collapse green checks unless in expanded mode
* **decree:** add 'wait for energy' option to decree
* **decree:** decree default item gather qty is 100
* **decree:** gather material will now specify the node so as to resolve ambiguity
* **decree:** show active decree clause in green
* **decree:** show quantity of items in decree clauses
* **gathering:** gathering node upgrade requirements are more ~diverse~
* **item:** add gather yield bonuses to explorer trinkets
* **item:** affixes that can boost damage to specific monster types
* **item:** improve display of stats and remove repetition
* **items:** items now scale value for infusions and selling/buying based on resistances and combat stats, too
* **items:** make items value scale more based on the different stats, rather than having a flat value per stat
* **merchant:** merchants will now sell items with affixes
* **merchants:** cut down merchant swap time
* **merchant:** show currently active merchant upon visiting
* **monster:** support leveled monster drops
* **node:** mystical nodes will show when they are currently cleared. also, show rewards earned count on all nodes
* **shrine:** add drop rate shrine, rename some other shrines
* **shrine:** add gather buff shrine
* **skills:** allow spells to say they never miss, ever
* **town:** rep can no longer exceed max, and shows the correct value when maxxed
* **town:** show item in craft queue with real tooltip
* **towns:** rep quests can scale and be persistent so they aren't too much clicking
* **town:** towns will not craft things beyond their resource caps if applicable
* **tradeskill:** recipes are more descriptive with origins
* **ui:** a more obvious indicator of whether or not a mystical node has been beaten
* **ui:** add service worker to hopefully keep application from breaking mid-run
* **ui:** add sfx to remaining buttons
* **ui:** change how recipes display their names
* **ui:** clean up tooltip for skill display, display it in all places where it should
* **ui:** display icons inline in combat messages
* **ui:** improve comparison dialog
* **ui:** improve gear selection screen by sorting items first by level, then raw item type
* **ui:** improve sfx feel of ui
* **ui:** item tooltip is now descriptive about all prefixes
* **ui:** show EP bar for heroes, add labels, etc
* **ux:** make the bestiary/worker page resemble infusion page
* **world:** add shrines
* **world:** mystical nodes drop a lot of gold
* **world:** mystical nodes now give infusions that increase spirit and constitution. also, added those stats
* **world:** show the whole gang walking around

## 0.6.1 (2026-09-08)


### Features

* **astralprojector:** add 2 new spells
* **commissions:** rework titles, add better lore
* **hero:** optimize equipment should allow higher equipment to shine through even though lower level equipment might have higher stats
* **hero:** show ep cost on hero skills

# 0.6.0 (2026-09-07)


### Bug Fixes

* **analytics:** event name consistency
* **core:** perf improvement for gameloop
* **crafting:** tradeskill gates should be 16, not 6 for new content
* **pathfinding:** multi-map paths should be possible for workers/etc
* **town:** towns will no longer generate the same commission for the player
* **workers:** town workers are excluded from analysis script since they can't be recruited


### Features

* **combat:** improve vit/res to not just be flat reductions
* **combat:** monsters can now start with combat stats too
* **combat:** support "helpers" in combat
* **commission:** add rarity color to commissions
* **commission:** commissions should reward "normal" rewards rather than locking specific rewards in
* **commissions:** support commissions having kill quests
* **content:** add some items that have negative stats
* **core:** refactor display for combat stats & resistances etc to reduce a lot of code duplication
* **equipment:** add item affixes
* **heroes:** heroes ui tab has better layout for stats/resistances
* **item:** add combat stats to items, infusions
* **job:** add 5 new skills, corresponding effects, as well as a new taunt combat stat
* **monster:** allow monsters to focus on specific jobs (if present) for targetting
* **simulator:** add support for checkpoints + resuming states
* **town:** have raid defense requests more easily visible
* **town:** persistent slot does not disappear from commissions
* **town:** town specialty recipes will be the primary thing commissions ask for, and they will escalate until they manage to craft it
* **ui:** progress bar supports using raw ng-content instead of relying on a text input
* **ui:** refactor stat/combat stat/resistance display into one component
* **ui:** rework debug to include both debug buttons for easier navigation / remembering they exist
* **workers:** workers can use teleports, but not town workers
* **world:** add 5 new charm materials that are infusable, sprites, materials, etc
* **world:** add larsia monsters, add to encounters
* **world:** add larsian gear
* **world:** add larsian recipes
* **world:** add more collectibles/items to larsia
* **world:** show gained items as they are gained
* **world:** show non player kingdoms on the map with namtags

## 0.5.4 (2026-08-28)


### Bug Fixes

* **adventurelog:** remove text color from buffs/debuffs
* **analysis:** analysis scripts run independently and without errors again
* **analytics:** have more in-depth analytics on some events that can support it
* **perf:** improve perf of pixi map


### Features

* **gathering:** gathering nodes can now be leveled up, which can unlock new materials or higher yields (or both)
* **kingdom:** rework kingdom page to be a bit more friendly
* **reclass:** reclassing now costs gold
* **ui:** call out shift+click for multi select/sell
* **ui:** show colors only for the name of the combatant, rather than the whole line (confusing)
* **world:** scaffold felway

## 0.5.3 (2026-08-27)


### Features

* **core:** traders can now sell recipes
* **world:** add templars retreat for real. add content, new items, new monsters, new encounters, etc. update maps, content creation guide for useful guidelines

## 0.5.2 (2026-08-26)

## 0.5.1 (2026-08-26)

# 0.5.0 (2026-08-26)


### Bug Fixes

* **collectible:** show trader scrip collectibles
* **core:** fix race conditions that could occur by multi-hitting on buy dialogs
* **equipment:** always prefer the currently-equipped item when optimizing. also, when there is no stat priority, prefer the "better" item
* **infusion:** can't infuse during combat - show users that
* **museum:** recipes should only show ones that are found in the world
* **options:** fix options panel to contain contents better; reorganize debug panel
* **trade:** hitting buttons while at a trader should not always open the trade menu
* **tradeskill:** address crash for edge cases with tradeskill data loading
* **travel:** party can no longer travel when in combat. also, fixed a circular import w/ combat


### Features

* **commissions:** add commissions feature, trader scrip, etc.
* **core:** add template map, content creation rough guidelines
* **debug:** add debug buttons for content analysis that show/hide depending on debug state
* **debug:** add debug route to easily see warnings/etc at a glance
* **job:** add some new skills, adjust level learned for some
* **simulator:** run the simulator across as many cores as possible
* **tradeskill:** add "max" craft button
* **workers:** add support for workers
* **world:** add a trader to craggled mire to help fill item gaps
* **world:** allow for nodes to be hidden without pre-req collectibles
* **world:** show currently crafting items on world screen

# 0.4.0 (2026-08-22)


### Bug Fixes

* **bug:** hopefully fix bug with cached image swaps
* **combat:** global effects might not  have subeffets which would cause things to break
* **combat:** show full names across 2 lines for monsters
* **decree:** allow decree to change priorities mid-action and adjust accordingly
* **decree:** show icons in dropdowns
* **decree:** sort dropdown for node farm rewards
* **equipment:** some equipment is just Too Big so it has been expanded
* **sprite:** maybe fix armory/equipment images "shifting"
* **storage:** show the real quantity, and give some breathing room to it in the tooltip
* **tradeskill:** actually clamp the input on keydown as well
* **tradeskill:** make tradeskill rows always the same height in every case
* **tradeskill:** min === max for level ranges for tradeskills should not give xp post-max level
* **ui:** fix spritesheets not loading
* **ux:** reduce jitter on explore panel
* **world:** make map panel for gathering have level requirement in a more sensible place


### Features

* **analysis:** add node gap level script to see where each node fits in
* **astralprojector:** add astral projector
* **combat:** add some nice combat visualization for current combat on world screen
* **combatorders:** add support for targetting specific heroes, as well as "matching allies" where applicable
* **core:** add debuff resistances, infusions, gear, etc.
* **debug:** add debug fill bestiary command
* **debug:** add learn all recipe button
* **heroes:** show when equipment can't be swapped
* **map:** move status progress above everything instead of having it in the panel
* **tradeskill:** add +1/+10/-1/-10 buttons
* **tradeskill:** update crafting to not reset the number if that amount is still craftable
* **validate:** add validate script to find unused sprites
* **world:** add new craggled mire items/recipes
* **world:** add new things to zone "Craggled Mire". monsters, nodes, etc

# 0.3.0 (2026-08-19)


### Bug Fixes

* **caravan:** fix issue where you could buy something you didn't have the gold for
* **decree:** auto mode medium difficulty will no longer target nodes with a min level above the partys level
* **decree:** make the default decree option be return to kingdom. make it unselectable.
* **decree:** stale decree entries get purged if they're no longer relevant.
* **errors:** update rollbar token to point to correct project
* **navbar:** remove opacity swap on resource bar
* **tooltip:** be more clear about tooltip in a11y area
* **tradeskill:** condense tradeskill menu a bit
* **travel:** show the node you end up at if you end up at a node and don't have one open
* **ui:** fix modals so only one loads for changelog-all
* **ui:** make item tooltips more consistent


### Features

* **accessibility:** add zoom option for the map
* **analytics:** add analytics banner at bottom of screen
* **core:** track discovered materials permanently
* **decree:** add a help tooltip for auto mode to explain it a little better
* **decree:** tie risk tolerance to the specific clauses rather than have it be global
* **game:** make the paused indicator only on world page, and move it down
* **hero:** on hero stat page, add tooltips for what stats do
* **skill:** show skill stat scaling where applicable
* **tradeskill:** add "hide uncraftable" checkbox & give recipes stable order so they don't jump
* **tradeskill:** refactor tradeskills to be real gamedata, and also add helpful nav buttons for them in the tradeskill section
* **tradeskill:** show item preview in tradeskill & refactor item preview component
* **ui:** add option to auto collapse party
* **ui:** improve tooltip clarity for caravans
* **ui:** remember selected node when changing tabs
* **ui:** show progress bar over explores & damage numbers in bottom right for interactivity
* **ui:** tooltips are globally 400px

# 0.2.0 (2026-08-17)


### Bug Fixes

* **analytics:** update analytics to pass names of things that happen
* **combatorders:** combat orders should not persist when changing characters if there is something half-done
* **decree:** auto mode fix for gathering with a disabled gather clause while trying to do something else
* **explorer:** fix luck for lucky spell
* **npe:** ensure resource bar only shows if any resource > 0
* **npe:** new players should always start with an unpaused game
* **sim:** the simulator should now more accurately reflect real play
* **tradeskill:** fix cramped height on tradeskill page
* **ui:** dropdowns should expand a bit more than they do, especially with images


### Features

* **combatorders:** show skill icons for consistency with decree
* **decree,combatorders:** put orders at the top of the list, not bottom
* **decree:** decree will show monster drops in farming node drop lists
* **exe:** discord status updates are more thorough and useful
* **npe:** add stat display on world setup to give players some kind of insight into what they're getting into
* **tradeskill:** crafting area will show how many of a recipe you need, and also better highlight things that need it
* **ui:** add analytics toggle
* **ui:** add icons in the dropdown label area so icons are visible for the selected entry
* **ui:** add pause vignette so users can more easily see when their game is paused
* **ui:** badgeify crafting, tweak caravan to have similar visuals
* **ui:** change seconds elapsed to include hours/minutes
* **ui:** re-enable itch download button since it's on itch now

## 0.1.3 (2026-08-15)

## 0.1.2 (2026-08-15)

## 0.1.1 (2026-08-15)

# 0.1.0 (2026-08-15)
