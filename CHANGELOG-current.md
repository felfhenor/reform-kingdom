
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
