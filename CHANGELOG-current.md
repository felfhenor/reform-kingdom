
# 0.13.0 (2026-11-02)


### Bug Fixes

* **astralprojector:** astral projector should not shrink spells
* **balance:** downscale sell values dramatically
* **bestiary:** bestiary should include creatures that can defend town if they're also enemies
* **combat:** combat now does not give XP until after the last fight
* **combat:** show skill use always for combatants, rather than swallowing every other
* **decree:** decree should let slimes be farmable in jelly fields for cores
* **tradeskill:** tradeskills with equipment requirements will have those requirements discovered (if they're not already) when the recipe is learned
* **ui:** adventure log perf improved substantially
* **ui:** armory 'no equipment found' is now properly centered
* **ui:** attention badges should have white on yellow text, rather than black. also, worker badge converted to attention badge
* **ui:** bestiary ui jitter is gone
* **ui:** bestiary will now alphabetize hybrid types
* **ui:** burst skill glow will no longer fade off the side of the screen
* **ui:** clean up options so things aren't everywhere all at once - options & labels have comparable lengths
* **ui:** combatant status will no longer cut off icons
* **ui:** default world background should be black, not transparent
* **ui:** dont show analytics banner on the loading screen
* **ui:** fullscreen should not have a horiz scrollbar for skill tree
* **ui:** rework main ui components to shrink/grow better for different resolutions
* **ui:** skill tree detail area should not stretch boxes and should generally fit better
* **ui:** skill tree oaths now have white-on-color like the rest of the game
* **worker:** changing from gathering to crafting will call the worker home immediately
* **worker:** fix janky ux around gathering/crafting selections


### Features

* **armory:** auto sell now lets you choose where to sell from (combat or crafting or both)
* **armory:** explain what current loot filter set means
* **bgm:** use the other two bgm tracks
* **desktop:** export savefile + logs for quick packaging of bug reports
* **electron:** support single instance lock to prevent multiple instances of the game from starting and fighting each other
* **hero:** add one new skill for each of the classes
* **heroes:** show equip animation!
* **logging:** dramatically improve logging for electron environments
* **optimizer:** rework optimizer to have separate layouts per spec, since they can vary dramatically
* **remembrance:** unlock new feature post-game to track incomplete things
* **rumor:** add popup to check old rumors
* **savefile:** better handling of savefiles in electron
* **sfx:** add death sfx, add some sfx to other parts of the ui/game
* **ui:** add colorblind support
* **ui:** add decree quick-toggle with right click
* **ui:** add master sound slider
* **ui:** add performance settings for map frame rate
* **ui:** add reduced motion option
* **ui:** add status dots to armory in side rail to indicate current encumberance tier
* **ui:** click on 'task complete' popups to open the tasks modal
* **ui:** electron supports common window sizes/settings (borderless, window, fullscreen)
* **ui:** electron supports fullscreen keys (f11/alt+enter)
* **ui:** expose save interval to players, and let them customize it
* **ui:** expose some debug options for running in background / muting in background
* **ui:** highlight craft time in tradeskill area
* **ui:** improve clarity of what is sold in auto-sell
* **ui:** much better indicators for skill trees being selected, learned, or unlearned
* **ui:** rework layout of options panel - consolidate options, make layout match the vibe
* **ui:** show at-a-glance for decree in tooltip
* **ui:** skill tree - right click to unlearn a staged ability
* **ux:** rework ux for badge/buttons to not merge them in similar areas - cleans up town, decree, combat orders, and armory especially
* **world:** add a cool effect to a cool place
* **world:** add collectible gate support
* **world:** pop in animation for newly discovered nodes
