
## [0.5.1](https://github.com/felfhenor/reform-kingdom/compare/v0.5.0...v0.5.1) (2026-08-26)

# [0.5.0](https://github.com/felfhenor/reform-kingdom/compare/v0.4.0...v0.5.0) (2026-08-26)


### Bug Fixes

* **collectible:** show trader scrip collectibles ([0e40808](https://github.com/felfhenor/reform-kingdom/commit/0e4080827346b8adf2c1f34ad255b597dbf05790))
* **core:** fix race conditions that could occur by multi-hitting on buy dialogs ([54ceae7](https://github.com/felfhenor/reform-kingdom/commit/54ceae737bf2e969e0fa5d0cda9bdf4f5dfebc7c))
* **equipment:** always prefer the currently-equipped item when optimizing. also, when there is no stat priority, prefer the "better" item ([a0e3678](https://github.com/felfhenor/reform-kingdom/commit/a0e3678888eef51d78e21684ce227b7d95dbe6ae))
* **infusion:** can't infuse during combat - show users that ([8b9625f](https://github.com/felfhenor/reform-kingdom/commit/8b9625fdeb1e35c5468ea3e4c6e046c7f766c2af))
* **museum:** recipes should only show ones that are found in the world ([c1aaaa0](https://github.com/felfhenor/reform-kingdom/commit/c1aaaa0f82c17aa2419767e88b34e176cb319997))
* **options:** fix options panel to contain contents better; reorganize debug panel ([d88f67a](https://github.com/felfhenor/reform-kingdom/commit/d88f67a860cf9976da590f00ec8a9f794b5de2e9))
* **trade:** hitting buttons while at a trader should not always open the trade menu ([1c8fd0c](https://github.com/felfhenor/reform-kingdom/commit/1c8fd0cda203a7feaeac0a949d36aea415507e3d))
* **tradeskill:** address crash for edge cases with tradeskill data loading ([411b99e](https://github.com/felfhenor/reform-kingdom/commit/411b99e7a8162f4b09ca878f359aad02b623489e))
* **travel:** party can no longer travel when in combat. also, fixed a circular import w/ combat ([e2128f8](https://github.com/felfhenor/reform-kingdom/commit/e2128f807ebe74dff681fd9f942cb1b56e07c185))


### Features

* **commissions:** add commissions feature, trader scrip, etc. ([bd75750](https://github.com/felfhenor/reform-kingdom/commit/bd75750ae882e9ea3f9e88f5cfe1efec5eaf67ce))
* **core:** add template map, content creation rough guidelines ([f6538bf](https://github.com/felfhenor/reform-kingdom/commit/f6538bf837237a7ba1e51067fad1b8b2378b9438))
* **debug:** add debug buttons for content analysis that show/hide depending on debug state ([2321852](https://github.com/felfhenor/reform-kingdom/commit/23218523debf3654678041f0c83524ef0eb742f1))
* **debug:** add debug route to easily see warnings/etc at a glance ([d57a88a](https://github.com/felfhenor/reform-kingdom/commit/d57a88a72a3d4214395a9eab5b8b20c9c2c9cf48))
* **job:** add some new skills, adjust level learned for some ([be72e14](https://github.com/felfhenor/reform-kingdom/commit/be72e147186316907d410f950a8f59913a7515a4))
* **simulator:** run the simulator across as many cores as possible ([c9f4fdc](https://github.com/felfhenor/reform-kingdom/commit/c9f4fdc0c3f61ab0fb2e46badf56b1d2b432a2af))
* **tradeskill:** add "max" craft button ([ff3c3ec](https://github.com/felfhenor/reform-kingdom/commit/ff3c3eca342ade9ac3268758342496867d345374))
* **workers:** add support for workers ([f567171](https://github.com/felfhenor/reform-kingdom/commit/f5671712373c8a14c43c3ca7e47187bd98ecd926))
* **world:** add a trader to craggled mire to help fill item gaps ([1a79cfd](https://github.com/felfhenor/reform-kingdom/commit/1a79cfd117eabbff12187eb9491f1886d00552f9))
* **world:** allow for nodes to be hidden without pre-req collectibles ([5a68765](https://github.com/felfhenor/reform-kingdom/commit/5a68765cf4e35b17f4e19ed5377d0de97a408e29))
* **world:** show currently crafting items on world screen ([c5753d0](https://github.com/felfhenor/reform-kingdom/commit/c5753d011fb027b718eeed445442e50b63899598))

# [0.4.0](https://github.com/felfhenor/reform-kingdom/compare/v0.3.0...v0.4.0) (2026-08-22)


### Bug Fixes

* **bug:** hopefully fix bug with cached image swaps ([0a6195b](https://github.com/felfhenor/reform-kingdom/commit/0a6195b3a13311aaa0be7f52f79095fd2504e23b))
* **combat:** global effects might not  have subeffets which would cause things to break ([525f89a](https://github.com/felfhenor/reform-kingdom/commit/525f89a079bfb3d8280d3ec393d2914f19e41840))
* **combat:** show full names across 2 lines for monsters ([0ee3839](https://github.com/felfhenor/reform-kingdom/commit/0ee3839aaeec01cccdfdea80abe97e1a345106c9))
* **decree:** allow decree to change priorities mid-action and adjust accordingly ([33241fd](https://github.com/felfhenor/reform-kingdom/commit/33241fd2ba43b51295ba9c499c5ff397ae4d6237))
* **decree:** show icons in dropdowns ([d3400e5](https://github.com/felfhenor/reform-kingdom/commit/d3400e58144a8cbd12c4ba55dba67c6f8d7dd3f5))
* **decree:** sort dropdown for node farm rewards ([dedb536](https://github.com/felfhenor/reform-kingdom/commit/dedb53645428fa48915374459cbf8b47b6c669b0))
* **equipment:** some equipment is just Too Big so it has been expanded ([cd60a1b](https://github.com/felfhenor/reform-kingdom/commit/cd60a1becde7ff0be806a537033f146200a4021d))
* **sprite:** maybe fix armory/equipment images "shifting" ([4da0588](https://github.com/felfhenor/reform-kingdom/commit/4da05881bdf9f231d1aef19a407ef7a77c5430f8))
* **storage:** show the real quantity, and give some breathing room to it in the tooltip ([bad5192](https://github.com/felfhenor/reform-kingdom/commit/bad519231ddb67338fa71e994dd7a56613c28f48))
* **tradeskill:** actually clamp the input on keydown as well ([670ed92](https://github.com/felfhenor/reform-kingdom/commit/670ed9285419a6376fddeaa5e7b381a12c61b0ff))
* **tradeskill:** make tradeskill rows always the same height in every case ([93af07a](https://github.com/felfhenor/reform-kingdom/commit/93af07ad42418e3c24bc4bbe5ba627b31c11760f))
* **tradeskill:** min === max for level ranges for tradeskills should not give xp post-max level ([02fa0c2](https://github.com/felfhenor/reform-kingdom/commit/02fa0c22f7d5927a3c5e0910f521a95fb69a7d22))
* **ui:** fix spritesheets not loading ([b6f1817](https://github.com/felfhenor/reform-kingdom/commit/b6f18171dbf73403fe879c4c64a7fb7fff5cdc3f))
* **ux:** reduce jitter on explore panel ([eeb6a0e](https://github.com/felfhenor/reform-kingdom/commit/eeb6a0e9757038ac5b47685d0263480b366f3186))
* **world:** make map panel for gathering have level requirement in a more sensible place ([714ad96](https://github.com/felfhenor/reform-kingdom/commit/714ad962df8117564d786aeefd55c3b17de747e9))


### Features

* **analysis:** add node gap level script to see where each node fits in ([b5a7faa](https://github.com/felfhenor/reform-kingdom/commit/b5a7faa65a589950348fd893bfcb085ff436d332))
* **astralprojector:** add astral projector ([c437d90](https://github.com/felfhenor/reform-kingdom/commit/c437d90fa704c4574d9d0dbbaf121c82b0aa93b1))
* **combat:** add some nice combat visualization for current combat on world screen ([fea262b](https://github.com/felfhenor/reform-kingdom/commit/fea262b03a3d7f2d343876b811eaa5942b1b2ce9))
* **combatorders:** add support for targetting specific heroes, as well as "matching allies" where applicable ([6916924](https://github.com/felfhenor/reform-kingdom/commit/6916924b70478fddb5bb798649008824292d520d))
* **core:** add debuff resistances, infusions, gear, etc. ([228c7ab](https://github.com/felfhenor/reform-kingdom/commit/228c7ab84de96c466d1d09a29ffe9cd2a17cb0a9))
* **debug:** add debug fill bestiary command ([6dc8e13](https://github.com/felfhenor/reform-kingdom/commit/6dc8e13afe4969c60711cdc64d04f30a872c8100))
* **debug:** add learn all recipe button ([d590141](https://github.com/felfhenor/reform-kingdom/commit/d590141676c2952855c669552e291fa2921a14af))
* **heroes:** show when equipment can't be swapped ([e0af141](https://github.com/felfhenor/reform-kingdom/commit/e0af141f3840a3cf892a09dac8893493a02a19b7))
* **map:** move status progress above everything instead of having it in the panel ([20db417](https://github.com/felfhenor/reform-kingdom/commit/20db4172eb38a8d164543392acadb61d3bc179af))
* **tradeskill:** add +1/+10/-1/-10 buttons ([be1e11e](https://github.com/felfhenor/reform-kingdom/commit/be1e11e89d3b803d4c204208977ad2f7effde1d4))
* **tradeskill:** update crafting to not reset the number if that amount is still craftable ([ef9c456](https://github.com/felfhenor/reform-kingdom/commit/ef9c4562e5cbbbd1a1d112aeafe1a8884543d20e))
* **validate:** add validate script to find unused sprites ([d8f3cff](https://github.com/felfhenor/reform-kingdom/commit/d8f3cff48574eeba4324921837920a5d91e3b4f4))
* **world:** add new craggled mire items/recipes ([a373485](https://github.com/felfhenor/reform-kingdom/commit/a373485a2f853c3e9a9d4c1c510a8453c3e4bb8a))
* **world:** add new things to zone "Craggled Mire". monsters, nodes, etc ([4770cf3](https://github.com/felfhenor/reform-kingdom/commit/4770cf39f02ede8f070d7bbe24611fe394887cce))

# [0.3.0](https://github.com/felfhenor/reform-kingdom/compare/v0.2.0...v0.3.0) (2026-08-19)


### Bug Fixes

* **caravan:** fix issue where you could buy something you didn't have the gold for ([3671172](https://github.com/felfhenor/reform-kingdom/commit/367117254467e1fc1d0f6bb87712edaef29aeb39))
* **decree:** auto mode medium difficulty will no longer target nodes with a min level above the partys level ([20d58b6](https://github.com/felfhenor/reform-kingdom/commit/20d58b67f7a404b74d0b2dca8d45db13f127df56))
* **decree:** make the default decree option be return to kingdom. make it unselectable. ([cc76d9f](https://github.com/felfhenor/reform-kingdom/commit/cc76d9f6df034a3fd7e457612116236eaf0ffb5d))
* **decree:** stale decree entries get purged if they're no longer relevant. ([0c5cf5e](https://github.com/felfhenor/reform-kingdom/commit/0c5cf5e86276a42628856c83362f5a674cdab80c))
* **errors:** update rollbar token to point to correct project ([f97d5ad](https://github.com/felfhenor/reform-kingdom/commit/f97d5adc34f15225f220dc4213da125dce1bc49d))
* **navbar:** remove opacity swap on resource bar ([bc4c3fd](https://github.com/felfhenor/reform-kingdom/commit/bc4c3fdd82bc17b7af98aa9a0827ef741a13ffd7))
* **tooltip:** be more clear about tooltip in a11y area ([6c16d4d](https://github.com/felfhenor/reform-kingdom/commit/6c16d4d4093922d74c72262fa2e3fd43739a9807))
* **tradeskill:** condense tradeskill menu a bit ([ea6932b](https://github.com/felfhenor/reform-kingdom/commit/ea6932b7aa9d5681aea2e21f47a4882026d9ee6f))
* **travel:** show the node you end up at if you end up at a node and don't have one open ([733c7d0](https://github.com/felfhenor/reform-kingdom/commit/733c7d0fffa31e3f197e51bfc8528c5f9c4f0762))
* **ui:** fix modals so only one loads for changelog-all ([078bd7d](https://github.com/felfhenor/reform-kingdom/commit/078bd7d3257fbda63d7a3b4874cc845e80485fc0))
* **ui:** make item tooltips more consistent ([d6c5a71](https://github.com/felfhenor/reform-kingdom/commit/d6c5a712632fec902d0cbcca1ba9f27ab2727de6))


### Features

* **accessibility:** add zoom option for the map ([97c1a85](https://github.com/felfhenor/reform-kingdom/commit/97c1a85fb58c074b89702083862c8eba27ebc2fa))
* **analytics:** add analytics banner at bottom of screen ([0a07a43](https://github.com/felfhenor/reform-kingdom/commit/0a07a43d0dc8976679668f00a0bad2b99ad9a903))
* **core:** track discovered materials permanently ([bb3f903](https://github.com/felfhenor/reform-kingdom/commit/bb3f9036ad2cb7b60e729209de988be2151d30aa))
* **decree:** add a help tooltip for auto mode to explain it a little better ([0d25b91](https://github.com/felfhenor/reform-kingdom/commit/0d25b91af751ba380c4b687683d02106ad56a218))
* **decree:** tie risk tolerance to the specific clauses rather than have it be global ([7babbe3](https://github.com/felfhenor/reform-kingdom/commit/7babbe3aa1aff1332975c53fabc67ff9287fd686))
* **game:** make the paused indicator only on world page, and move it down ([ab7b062](https://github.com/felfhenor/reform-kingdom/commit/ab7b062a7e1099f64fa47a3e3c7d27ae0d34230a))
* **hero:** on hero stat page, add tooltips for what stats do ([eea89cd](https://github.com/felfhenor/reform-kingdom/commit/eea89cdf02c64ebe782cde4377e8f81dfd048629))
* **skill:** show skill stat scaling where applicable ([d7d95f3](https://github.com/felfhenor/reform-kingdom/commit/d7d95f365390144a4a0526fe972fb9e114c2fe5f))
* **tradeskill:** add "hide uncraftable" checkbox & give recipes stable order so they don't jump ([a6f2682](https://github.com/felfhenor/reform-kingdom/commit/a6f26820938f21c71c9ed6f1f7bb06119d4db26c))
* **tradeskill:** refactor tradeskills to be real gamedata, and also add helpful nav buttons for them in the tradeskill section ([be797f4](https://github.com/felfhenor/reform-kingdom/commit/be797f4721990bedeb6f711392410ae9f69276d2))
* **tradeskill:** show item preview in tradeskill & refactor item preview component ([bb3e964](https://github.com/felfhenor/reform-kingdom/commit/bb3e964f0ffbd2d63d954c61fa779582f1678585))
* **ui:** add option to auto collapse party ([786d0ed](https://github.com/felfhenor/reform-kingdom/commit/786d0edb74405484fffb4b67b166ad4f741c54a7))
* **ui:** improve tooltip clarity for caravans ([f779e06](https://github.com/felfhenor/reform-kingdom/commit/f779e06f1b5b6b1904ae6d77fab8bf5441500a20))
* **ui:** remember selected node when changing tabs ([16287f5](https://github.com/felfhenor/reform-kingdom/commit/16287f57b6c846979d52c5ec7a000888cefe95b8))
* **ui:** show progress bar over explores & damage numbers in bottom right for interactivity ([aaa744d](https://github.com/felfhenor/reform-kingdom/commit/aaa744d10fa24d1e77009a4a75fe73652febc90a))
* **ui:** tooltips are globally 400px ([bd4fcab](https://github.com/felfhenor/reform-kingdom/commit/bd4fcab6cf481ab4216a19c5408e323177714d9d))

# [0.2.0](https://github.com/felfhenor/reform-kingdom/compare/v0.1.3...v0.2.0) (2026-08-17)


### Bug Fixes

* **analytics:** update analytics to pass names of things that happen ([bbeaf7b](https://github.com/felfhenor/reform-kingdom/commit/bbeaf7b12bec96eb93aa26de393f6e8f4aa35b13))
* **combatorders:** combat orders should not persist when changing characters if there is something half-done ([51ece01](https://github.com/felfhenor/reform-kingdom/commit/51ece012692245345749f3a31646782216afeed3))
* **decree:** auto mode fix for gathering with a disabled gather clause while trying to do something else ([346bc44](https://github.com/felfhenor/reform-kingdom/commit/346bc44246ae3cb90ad90c4545da6ee58b9b9e82))
* **explorer:** fix luck for lucky spell ([c29abbb](https://github.com/felfhenor/reform-kingdom/commit/c29abbbcb431642ae68404142716d5572290a2e5))
* **npe:** ensure resource bar only shows if any resource > 0 ([4e16a16](https://github.com/felfhenor/reform-kingdom/commit/4e16a165a31e71f17c20d9495315c5e2c81ad40e))
* **npe:** new players should always start with an unpaused game ([ea3122c](https://github.com/felfhenor/reform-kingdom/commit/ea3122c60fd527169ef102d105126ff62220daf7))
* **sim:** the simulator should now more accurately reflect real play ([a300929](https://github.com/felfhenor/reform-kingdom/commit/a3009299bda8941a11e6656aaeb4e79eb83f5ada))
* **tradeskill:** fix cramped height on tradeskill page ([9bfa1b4](https://github.com/felfhenor/reform-kingdom/commit/9bfa1b46ee6d61bdc7e4133ed5e056ef284349aa))
* **ui:** dropdowns should expand a bit more than they do, especially with images ([d73a12a](https://github.com/felfhenor/reform-kingdom/commit/d73a12a8926e82eb4fe3a76e1def66e41838b29c))


### Features

* **combatorders:** show skill icons for consistency with decree ([cfe3508](https://github.com/felfhenor/reform-kingdom/commit/cfe3508c765a39924976b907ac11c49216ba96ce))
* **decree,combatorders:** put orders at the top of the list, not bottom ([a44f4ea](https://github.com/felfhenor/reform-kingdom/commit/a44f4ea91fd7a416dcf6ae3cba6f7f238c2e0b48))
* **decree:** decree will show monster drops in farming node drop lists ([0c65652](https://github.com/felfhenor/reform-kingdom/commit/0c656520c216cdf6556ab0c102fbb30a0145d58d))
* **exe:** discord status updates are more thorough and useful ([3b59209](https://github.com/felfhenor/reform-kingdom/commit/3b59209e4359064eb8ad2c60f143adbe19dbd71d))
* **npe:** add stat display on world setup to give players some kind of insight into what they're getting into ([8767c3d](https://github.com/felfhenor/reform-kingdom/commit/8767c3df3ec160bfadbf15e8c0d6a39a06cf3365))
* **tradeskill:** crafting area will show how many of a recipe you need, and also better highlight things that need it ([0a71688](https://github.com/felfhenor/reform-kingdom/commit/0a71688a8239f8ac2ae12b69090e464b0429c0e3))
* **ui:** add analytics toggle ([d4d44a3](https://github.com/felfhenor/reform-kingdom/commit/d4d44a3fdbc74b16db5bb7bc455a032763ba5bdb))
* **ui:** add icons in the dropdown label area so icons are visible for the selected entry ([e00635b](https://github.com/felfhenor/reform-kingdom/commit/e00635b2317a67f35b7dd6ca664e0b89011e56de))
* **ui:** add pause vignette so users can more easily see when their game is paused ([1d62c34](https://github.com/felfhenor/reform-kingdom/commit/1d62c34f95d323bd79d842391f564140bff51e32))
* **ui:** badgeify crafting, tweak caravan to have similar visuals ([69d509c](https://github.com/felfhenor/reform-kingdom/commit/69d509cab99791e135b15393420059d7b22d627c))
* **ui:** change seconds elapsed to include hours/minutes ([5ee415d](https://github.com/felfhenor/reform-kingdom/commit/5ee415dda05922bec4d6d275ad3e0df60d84b99c))
* **ui:** re-enable itch download button since it's on itch now ([4890850](https://github.com/felfhenor/reform-kingdom/commit/48908507c235082ed772bcc97c52afeceffbe9de))

## [0.1.3](https://github.com/felfhenor/reform-kingdom/compare/v0.1.2...v0.1.3) (2026-08-15)

## [0.1.2](https://github.com/felfhenor/reform-kingdom/compare/v0.1.1...v0.1.2) (2026-08-15)

## [0.1.1](https://github.com/felfhenor/reform-kingdom/compare/v0.1.0...v0.1.1) (2026-08-15)

# 0.1.0 (2026-08-15)
