
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
