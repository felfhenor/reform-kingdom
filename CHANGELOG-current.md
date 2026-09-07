
# [0.6.0](https://github.com/felfhenor/reform-kingdom/compare/v0.5.4...v0.6.0) (2026-09-07)


### Bug Fixes

* **analytics:** event name consistency ([b13231e](https://github.com/felfhenor/reform-kingdom/commit/b13231e40af24b09099c9a76d3121ab0fdf1e3d5))
* **core:** perf improvement for gameloop ([9c4cd97](https://github.com/felfhenor/reform-kingdom/commit/9c4cd971f2c1b2d0d19588253dd8fdf5a8c2b2c8))
* **crafting:** tradeskill gates should be 16, not 6 for new content ([e5b07c5](https://github.com/felfhenor/reform-kingdom/commit/e5b07c5cbec68c017d625da05474d63be9c7399f))
* **pathfinding:** multi-map paths should be possible for workers/etc ([444e2fa](https://github.com/felfhenor/reform-kingdom/commit/444e2faa5163b1d57c73e88a16038d14419f59e4))
* **town:** towns will no longer generate the same commission for the player ([8730b1f](https://github.com/felfhenor/reform-kingdom/commit/8730b1f9ee6300fd6f0c178eb18a60de98b7ddab))
* **workers:** town workers are excluded from analysis script since they can't be recruited ([409c74c](https://github.com/felfhenor/reform-kingdom/commit/409c74cc93c8810ace2e95cf791b282a798dd14f))


### Features

* **combat:** improve vit/res to not just be flat reductions ([e52b625](https://github.com/felfhenor/reform-kingdom/commit/e52b625730459e39136a58b4387f3d71f6081b7f))
* **combat:** monsters can now start with combat stats too ([c8e1fe8](https://github.com/felfhenor/reform-kingdom/commit/c8e1fe88c6a03f6ac44db9c0ad0c4c73f695b127))
* **combat:** support "helpers" in combat ([48189bc](https://github.com/felfhenor/reform-kingdom/commit/48189bc076e13a97dae2368eb8b2fa20fcfab562))
* **commission:** add rarity color to commissions ([7323924](https://github.com/felfhenor/reform-kingdom/commit/73239242cdd586d9ead9a2d0a7f476d781d73b08))
* **commission:** commissions should reward "normal" rewards rather than locking specific rewards in ([c9f8a31](https://github.com/felfhenor/reform-kingdom/commit/c9f8a313e7fbaf4f577602d0b71c7c28625eb1ab))
* **commissions:** support commissions having kill quests ([1365bd8](https://github.com/felfhenor/reform-kingdom/commit/1365bd8e71056518a7ecdea2864e18a5ff077c1b))
* **content:** add some items that have negative stats ([f465f68](https://github.com/felfhenor/reform-kingdom/commit/f465f6895d45705ac44546770f396ba9c2d98c50))
* **core:** refactor display for combat stats & resistances etc to reduce a lot of code duplication ([72d40a5](https://github.com/felfhenor/reform-kingdom/commit/72d40a5af8245f5b32a83b7194b2b47263fd428c))
* **equipment:** add item affixes ([61a2fdf](https://github.com/felfhenor/reform-kingdom/commit/61a2fdf75f91f184fca0b76d33683e87c72fdce2))
* **heroes:** heroes ui tab has better layout for stats/resistances ([2a9e6aa](https://github.com/felfhenor/reform-kingdom/commit/2a9e6aaa2db8edec9134e21559313f81d2a577ed))
* **item:** add combat stats to items, infusions ([a0de4b6](https://github.com/felfhenor/reform-kingdom/commit/a0de4b6850f6404180c1da29e81b7db8cbaf2e6d))
* **job:** add 5 new skills, corresponding effects, as well as a new taunt combat stat ([ccd1f04](https://github.com/felfhenor/reform-kingdom/commit/ccd1f04c326088aeb9e72595bf2396452ecee1c4))
* **monster:** allow monsters to focus on specific jobs (if present) for targetting ([2260c26](https://github.com/felfhenor/reform-kingdom/commit/2260c26ecf1f26123aa01a2ece2e1c317b226761))
* **simulator:** add support for checkpoints + resuming states ([6d266ed](https://github.com/felfhenor/reform-kingdom/commit/6d266edc4b20b1e20db118e96369dcf27717be98))
* **town:** have raid defense requests more easily visible ([3f07ae1](https://github.com/felfhenor/reform-kingdom/commit/3f07ae1f61714ada91c50f7c86ec26d903c1e48c))
* **town:** persistent slot does not disappear from commissions ([177c233](https://github.com/felfhenor/reform-kingdom/commit/177c233be97f258fe6400d5f7e22415cc0d0a5f4))
* **town:** town specialty recipes will be the primary thing commissions ask for, and they will escalate until they manage to craft it ([4c5de50](https://github.com/felfhenor/reform-kingdom/commit/4c5de50d74ed9d15d0f72de9839f466079378747))
* **ui:** progress bar supports using raw ng-content instead of relying on a text input ([6c13a2b](https://github.com/felfhenor/reform-kingdom/commit/6c13a2b38f27022836fefd3cd6b628f17bb4e212))
* **ui:** refactor stat/combat stat/resistance display into one component ([1d6c125](https://github.com/felfhenor/reform-kingdom/commit/1d6c125fd7ea0ec73a3ef1d41e89dc7e4d3da088))
* **ui:** rework debug to include both debug buttons for easier navigation / remembering they exist ([30dea6a](https://github.com/felfhenor/reform-kingdom/commit/30dea6a8c6b1af03ef920e16ebdb9bd219aa169f))
* **workers:** workers can use teleports, but not town workers ([5532f94](https://github.com/felfhenor/reform-kingdom/commit/5532f941cf8b10ff8a26fa645bd15f85e7186fd2))
* **world:** add 5 new charm materials that are infusable, sprites, materials, etc ([48e984c](https://github.com/felfhenor/reform-kingdom/commit/48e984c453d5c2dc04a0ef0aab6cc28f9441f4b4))
* **world:** add larsia monsters, add to encounters ([e3c9dca](https://github.com/felfhenor/reform-kingdom/commit/e3c9dca7a36afd23ccc8c051b02db9cdfa00c7a6))
* **world:** add larsian gear ([2972dd7](https://github.com/felfhenor/reform-kingdom/commit/2972dd76dd419e462cd1090c47691ef461bdfc27))
* **world:** add larsian recipes ([b2cd259](https://github.com/felfhenor/reform-kingdom/commit/b2cd259a1fce0835962280f3e852e43badaa6967))
* **world:** add more collectibles/items to larsia ([370b4e0](https://github.com/felfhenor/reform-kingdom/commit/370b4e05956b060e51ed07aac1abbe63bdb61069))
* **world:** show gained items as they are gained ([a721a8b](https://github.com/felfhenor/reform-kingdom/commit/a721a8b1632baa15700f5ae3f055f926e7238f34))
* **world:** show non player kingdoms on the map with namtags ([0a1c3dd](https://github.com/felfhenor/reform-kingdom/commit/0a1c3dd9130f51e75ec3d83d855c466341f0d86b))
