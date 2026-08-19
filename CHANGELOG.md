
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
