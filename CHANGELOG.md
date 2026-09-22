
# [0.8.0](https://github.com/felfhenor/reform-kingdom/compare/v0.7.0...v0.8.0) (2026-09-22)


### Bug Fixes

* **bestiary:** allow all ranges of all nodes to be selected ([a7dea2e](https://github.com/felfhenor/reform-kingdom/commit/a7dea2e9e435e65c05d658fbe7a0ff8e15e0ca55))
* **core:** better error handling for gameloop ([524d255](https://github.com/felfhenor/reform-kingdom/commit/524d2553d2d5e9d26ae264fa0e8da6ac48348f5a))
* **core:** load sound as part of the loading process, rather than later, randomly ([710fa09](https://github.com/felfhenor/reform-kingdom/commit/710fa09a6d76a212856e701e49eef68a4a18fe3c))
* **core:** reset ui state when resetting game ([481d723](https://github.com/felfhenor/reform-kingdom/commit/481d723bda212bc442d8822d4069cea9cb0771a7))
* **kingdom:** kingdom can only set home if you're there ([b0813d2](https://github.com/felfhenor/reform-kingdom/commit/b0813d24bf70731bcb80e289a07e14e9eccb4bcf))
* **perf:** make maps load all at once instead of one at a time ([83c1a31](https://github.com/felfhenor/reform-kingdom/commit/83c1a3140ebe37970d3d7c0ae185cc02f4419152))
* **recipe:** actually block town recipes from being obtainable ([b392842](https://github.com/felfhenor/reform-kingdom/commit/b392842c55039e4f28a7eda8e15432a1cd808c8f))
* **recipe:** recipe drops won't happen unless you can use the recipe ([1ae8c3f](https://github.com/felfhenor/reform-kingdom/commit/1ae8c3fea1bfb6291c23a2154f7eeb2d761c3890))
* **setup:** stat display in world setup looks good again ([6b1eff0](https://github.com/felfhenor/reform-kingdom/commit/6b1eff0c2aecbecef1ed0c5456793a90795be6a5))
* **simulator:** sim works again ([5ec4782](https://github.com/felfhenor/reform-kingdom/commit/5ec4782d3dbbfe1d9f5d92e074e0d937d3344fde))
* **town:** button resizing should not jitter the ui ([0466aca](https://github.com/felfhenor/reform-kingdom/commit/0466aca9910b42bb8e5b0b91a1dda694eeb2079b))
* **town:** limit output of a similar equipment item so it can't flood the same item out ([fa49e14](https://github.com/felfhenor/reform-kingdom/commit/fa49e14623c58680720d0517a34e1307b26c7736))
* **ui:** swap kingdom/world in navbar ([77f1cf4](https://github.com/felfhenor/reform-kingdom/commit/77f1cf4a4300f4b9517df81d4b84e5331bca77d8))
* **validation:** condense validation scripts into one rather than having a dozen ([ef85ab2](https://github.com/felfhenor/reform-kingdom/commit/ef85ab2ff6b033cd1e2a0dac61bacd8284bfe4be))


### Features

* **affix:** affixes can now limit themselves by item level ([e6578c5](https://github.com/felfhenor/reform-kingdom/commit/e6578c53b66af2a2c7b9a4f527f69b4e97b044c4))
* **analysis:** add skill analysis script, make sure all content passes it ([1b6d666](https://github.com/felfhenor/reform-kingdom/commit/1b6d666ec6965e4229d6b5fb17bf0728639badf5))
* **crafting:** queuing an item will add it to an existing entry or split, if possible ([afee2f7](https://github.com/felfhenor/reform-kingdom/commit/afee2f700858076f2158db2cfae9ab29f6552e59))
* **debug:** reorganize debug output to make content gaps easier to sort through ([c7f4189](https://github.com/felfhenor/reform-kingdom/commit/c7f418903a7ec7f20f2f0117917928ebeb5332af))
* **decree:** add help info for level up party clause ([abd38a4](https://github.com/felfhenor/reform-kingdom/commit/abd38a40d44097b0774e6d476e21a1fbe7646bf5))
* **hero:** better use of space for equipment ([dfb8390](https://github.com/felfhenor/reform-kingdom/commit/dfb839087147d74d8d3ccf46decec4f21371f986))
* **home:** add a nicer home screen ([d1ada3e](https://github.com/felfhenor/reform-kingdom/commit/d1ada3e0940e191c31aefc3b717569247056933c))
* **infusion:** add infusion animation ([11e60be](https://github.com/felfhenor/reform-kingdom/commit/11e60be976af57638d9060eabb6953dfb695a37c))
* **infusion:** show # slots on infusion equipment ([80d3294](https://github.com/felfhenor/reform-kingdom/commit/80d329425527a9205687b72e27b6fab0a5c421bf))
* **items:** affixes can now improve specific spells ([4ee08a0](https://github.com/felfhenor/reform-kingdom/commit/4ee08a0d9b82046e0172b3e204d2a04a583ff83e))
* **monster:** support monsters having min/max levels on skills like they do with item drops ([b107b47](https://github.com/felfhenor/reform-kingdom/commit/b107b471b92d8a66ec4187a84ef35b743a6c02f2))
* **navbar:** highlight town separately so it doesn't blend in with the rest of the nav entries ([31d6cc7](https://github.com/felfhenor/reform-kingdom/commit/31d6cc7ddef4d0fa38cfe951cb808bc721ff0238))
* **npe:** expand heroes by default ([16737ed](https://github.com/felfhenor/reform-kingdom/commit/16737ed1ea258aa5d0a714d52130498da0648568))
* **setup:** hide stats on new run screen ([3a66cb5](https://github.com/felfhenor/reform-kingdom/commit/3a66cb509115508da36ab17734bc079fcbe95296))
* **setup:** more random hero names ([1adace5](https://github.com/felfhenor/reform-kingdom/commit/1adace5178ff1cb670c1ca3c876d912724eadc29))
* **shrine:** add mobility of the explorer so it really works ([233f29b](https://github.com/felfhenor/reform-kingdom/commit/233f29b8581d6ce0bf6a65abde5841d912653a76))
* **town:** show ETA for workers ([0eeb1e1](https://github.com/felfhenor/reform-kingdom/commit/0eeb1e1f782849410624a63e22aa00f280054a05))
* **town:** towns will sell excess materials to the player ([303bbeb](https://github.com/felfhenor/reform-kingdom/commit/303bbeb6941fb033a6d313dc20e4658dae8ddbb5))
* **tradeskill:** item recipes can now give >1 ([41178fd](https://github.com/felfhenor/reform-kingdom/commit/41178fdaf886940749b3c0d54ae5d55f2ea2b4bc))
* **tradeskill:** tradeskill ui alphabetizes resources in crafting requirements ([3e61108](https://github.com/felfhenor/reform-kingdom/commit/3e6110862f7e19cc309c973129313527fb343388))
* **ui:** add anime.js to remove some cumbersome animations ([42293f9](https://github.com/felfhenor/reform-kingdom/commit/42293f96dfb563930a384dd1c41cece5ae9e7633))
* **ui:** add more animations for bars, etc ([37e48f9](https://github.com/felfhenor/reform-kingdom/commit/37e48f9abc3e81a5460623be4f9494adaf3f9813))
* **ui:** add tutorial popups for simpler features/callouts ([0c221b1](https://github.com/felfhenor/reform-kingdom/commit/0c221b1e0e58c4070cb939b86ac3010ebaf5fc93))
* **ui:** adventure log fades in chunks at a time ([379a0e7](https://github.com/felfhenor/reform-kingdom/commit/379a0e71bef81b42e7995bd27cd2e8416e31b67c))
* **ui:** improve display of skills/techniques. fix some skill tagging. ([20029d3](https://github.com/felfhenor/reform-kingdom/commit/20029d338f7cb93ddd5ea33ddde6a525d50a3b77))
* **ui:** improve hero equipment screen layout/consistency ([17c36cd](https://github.com/felfhenor/reform-kingdom/commit/17c36cd9e15b45d6b5eb0c5e62542ba82919df45))
* **ui:** kingdom button/hotkey will go back to main kingdom page if it's the active subview ([e4def01](https://github.com/felfhenor/reform-kingdom/commit/e4def014b31ca9cbfadaeb0a27cef8928f2a4d77))
* **ui:** make more areas tabular-nums so they don't jitter as much ([3991f40](https://github.com/felfhenor/reform-kingdom/commit/3991f40fe6327bfc1b5d6b7b79f93bc2a3d91ff4))
* **ui:** show currency gains with a floating number ([c9d41e2](https://github.com/felfhenor/reform-kingdom/commit/c9d41e2e919bd8ce8507f20b8b6319141680baaf))
* **worker:** show level up icon on the worker card ([780b674](https://github.com/felfhenor/reform-kingdom/commit/780b674447abc5d0ec933513e214a494bf8894f2))

# [0.7.0](https://github.com/felfhenor/reform-kingdom/compare/v0.6.2...v0.7.0) (2026-09-15)


### Bug Fixes

* **heroes:** fix ui scrunching with progress bar ([5c7c40a](https://github.com/felfhenor/reform-kingdom/commit/5c7c40aa715bb07fdae4937ad1feac0bd8f403bb))
* **hero:** hero equipment compare area is shrunken a bit ([ae7915c](https://github.com/felfhenor/reform-kingdom/commit/ae7915c595a16a14637727d7bdc7a5b787444658))
* **recipe:** recipes should not show in adventure log when already discovered ([9b86ce7](https://github.com/felfhenor/reform-kingdom/commit/9b86ce7b5502887611296d32d39f8109cd5ab536))


### Features

* **armory:** add auto sell functionality ([9a58ad4](https://github.com/felfhenor/reform-kingdom/commit/9a58ad4801e57703dd7c72a7131ec1cbba39254e))
* **armory:** armory caps at 50 items. this will change. ([5acb6b8](https://github.com/felfhenor/reform-kingdom/commit/5acb6b8b71c1c78e0b7b010705e9d0f580182455))
* **collectible:** add decree cap/boosts to collectibles ([5474cb7](https://github.com/felfhenor/reform-kingdom/commit/5474cb7e833eeb5b59c3398a35804886f8726e92))
* **collectible:** add more collectible effects, juggle rarities ([d15ed1a](https://github.com/felfhenor/reform-kingdom/commit/d15ed1a5b4864ee0321d89d0cb16f31d10e820bf))
* **collectible:** can increase armory size ([a06235c](https://github.com/felfhenor/reform-kingdom/commit/a06235c4474703054289b234e16954b2251459a8))
* **collectible:** collectibles can increase speed off-path ([b5ac77a](https://github.com/felfhenor/reform-kingdom/commit/b5ac77ad36a23407b09996c1fa4ed3a9fa3f3d5f))
* **collectible:** make some collectibles do things ([a15c894](https://github.com/felfhenor/reform-kingdom/commit/a15c89420ad606fd6be9b4b512caf97692412c85))
* **collectible:** some collectibles can boost queue sizes for kingdom tradeskills ([a775c29](https://github.com/felfhenor/reform-kingdom/commit/a775c294b7e1a7df77ee0e3365c6d0ae3702875d))
* **debug:** add collectible unlock debug command ([905d761](https://github.com/felfhenor/reform-kingdom/commit/905d76110e16d4e13f8f745808b3f4c5073e811d))
* **docs:** add content segmentation guide so it's easier to remember what can do what (and what *should* do what) ([3a900fe](https://github.com/felfhenor/reform-kingdom/commit/3a900fe39632e2d68756c020a831b84f7babd18e))
* **kingdom:** can now reset your kingdom to home ([26a9df2](https://github.com/felfhenor/reform-kingdom/commit/26a9df2927e7b5666f4c9b106ab92e29b8dd3f02))
* **kingdom:** rework kingdom view to use bar-progress ([59ee375](https://github.com/felfhenor/reform-kingdom/commit/59ee3751651b8f988afa47e72371c4bd30e01e2a))
* **merchant:** add two new merchants ([ec3e82f](https://github.com/felfhenor/reform-kingdom/commit/ec3e82fe99b7ed57c3b8461ca7645ed9005f3197))
* **shrine:** add confirmation for praying ([3bfae26](https://github.com/felfhenor/reform-kingdom/commit/3bfae26674deb4dd55aed3b484d281dcf6743481))
* **ui:** improve toast visuals to match the rest of the ui a bit more ([72e6978](https://github.com/felfhenor/reform-kingdom/commit/72e6978ede530339f2ed5a7cd0eb8240b3dffe51))
* **ui:** sweetalert2 looks more like it fits in game ([9817a06](https://github.com/felfhenor/reform-kingdom/commit/9817a06f4dc7d8df7763ecc234f6e8a5adc76a9d))

## [0.6.2](https://github.com/felfhenor/reform-kingdom/compare/v0.6.1...v0.6.2) (2026-09-14)


### Bug Fixes

* **armory:** armory should allow search by item full name w/ affixes ([882a9dd](https://github.com/felfhenor/reform-kingdom/commit/882a9dd6559c20f2ba6b298222ae6b3bfc98ab5f))
* **astralprojector:** disable projector if no spells are learned ([402ebc8](https://github.com/felfhenor/reform-kingdom/commit/402ebc8b3863f65e23b4bcd06dbb533df5799867))
* **combat:** cap healing ignore after damage reduction rather than before, in case of debuffs ([10f15b3](https://github.com/felfhenor/reform-kingdom/commit/10f15b3ed30a6a84a853e2f096192fb42b6b0760))
* **combat:** ui card showing skill should fade skill after 750ms instead of 1500ms to allow the next skill to fade in ([64f10bd](https://github.com/felfhenor/reform-kingdom/commit/64f10bd41b262f75deeb044d52649bde67a2460e))
* **debug:** use other slots for data where applicable ([e6db5c1](https://github.com/felfhenor/reform-kingdom/commit/e6db5c176b601e0684197c34f45c8a012248fd00))
* **tests:** tests compile and reference the correct types ([69edde2](https://github.com/felfhenor/reform-kingdom/commit/69edde2ea56d4ba3e9935988a810277c0c04e3ea))
* **town:** if an item disappears from the shop when bought, the user should be notified ([fa7e453](https://github.com/felfhenor/reform-kingdom/commit/fa7e453ad4dbb21dfaf121e9bed403efac048140))
* **town:** towns should refresh their buff when rep level changes ([d4a035d](https://github.com/felfhenor/reform-kingdom/commit/d4a035d724f59fe39795e1f251e94d9d2d559a39))
* **trader:** traders should not be able to be at two different caravans at the same time ([4a08a0f](https://github.com/felfhenor/reform-kingdom/commit/4a08a0fbb7e698db0bd850dd439f405ab01aebe3))
* **ui:** add user-select none to combatant cards and craft/worker cards ([e1fad96](https://github.com/felfhenor/reform-kingdom/commit/e1fad96ab12367b25a0a61dd5f7af4c7b692b7c5))
* **ui:** disable explore again if in combat ([dbb0aae](https://github.com/felfhenor/reform-kingdom/commit/dbb0aaeb2825b27e6b4d8bbf266f16a2289969c5))
* **ui:** dont show the helpers or monsters if they're not present, to make ui more clickable ([69d9d9d](https://github.com/felfhenor/reform-kingdom/commit/69d9d9d278fcf7662bfc3bc603aa37e6a764463b))
* **ui:** hero ui should have scrollbars for skills/stats ([db1299e](https://github.com/felfhenor/reform-kingdom/commit/db1299eb77d62865eaa251c2f9fbdf72717d0078))
* **ui:** make stagger text on map more staggered ([aef6de1](https://github.com/felfhenor/reform-kingdom/commit/aef6de1bcf4aaee8790fb652304bb4a8038e4f27))
* **ui:** use background sprite for recipes ([eadd359](https://github.com/felfhenor/reform-kingdom/commit/eadd3596637edfedd874001bdf7e142db63fa329))
* **ui:** worker interface should not show stale materials when changing locations ([fa9c379](https://github.com/felfhenor/reform-kingdom/commit/fa9c3798c9cff352df4bd98e139fbcffb3b95b8d))
* **worker:** disable locations that are too high level ([71f62c1](https://github.com/felfhenor/reform-kingdom/commit/71f62c1f34feb3283e1fa695930cc92d31fbc6db))
* **world:** fix reward panel to show unified tooltip where needed ([bf77ec1](https://github.com/felfhenor/reform-kingdom/commit/bf77ec1dc342d46b369e8fe6a6395f68239e5252))


### Features

* **affix:** add some affixes that are prefixes to try to drown out some of the cursed ones ([1dda501](https://github.com/felfhenor/reform-kingdom/commit/1dda501a3318de0846f5d12cb160f32b5987aeef))
* **bestiary:** add monster types in preparation for a few new features ([e2102c9](https://github.com/felfhenor/reform-kingdom/commit/e2102c9f71e1e6523724a285d2618298ab4719ee))
* **bestiary:** improve bestiary level selection ([9ae5e0f](https://github.com/felfhenor/reform-kingdom/commit/9ae5e0f04cc2cffee9c2abe5e10ec8267ff9f3d7))
* **combatlog:** remove unnecessary no skills available line ([7975fc3](https://github.com/felfhenor/reform-kingdom/commit/7975fc344d51ef0586f10c0e696ece0221b7fbb4))
* **combatlog:** show sprites for monsters and heroes inline ([0b078ab](https://github.com/felfhenor/reform-kingdom/commit/0b078aba6e62d2a69e65fa29f6d880f0e17c1df1))
* **core:** add new gear to fill in some early gaps ([8ac9543](https://github.com/felfhenor/reform-kingdom/commit/8ac9543710bb1225f50bb34158099fa9784bba3e))
* **debug:** add debug helper to teleport to node ([3cf1a21](https://github.com/felfhenor/reform-kingdom/commit/3cf1a21946e1e838d1e39add34e2136809516064))
* **debug:** analysis tools now collapse green checks unless in expanded mode ([3db2268](https://github.com/felfhenor/reform-kingdom/commit/3db2268e3938aee40af0047dff685c7a3d342978))
* **decree:** add 'wait for energy' option to decree ([330e9d5](https://github.com/felfhenor/reform-kingdom/commit/330e9d597bdb231f6b429df7855a09e8427b41ed))
* **decree:** decree default item gather qty is 100 ([cabe925](https://github.com/felfhenor/reform-kingdom/commit/cabe9250a2e05e180ee6d3cd0c7a0231495729fc))
* **decree:** gather material will now specify the node so as to resolve ambiguity ([0f1c49d](https://github.com/felfhenor/reform-kingdom/commit/0f1c49d44ea6330011f15714837b1bc78adf3e20))
* **decree:** show active decree clause in green ([10e8e98](https://github.com/felfhenor/reform-kingdom/commit/10e8e98a2456a7077bffc03c08e3fadb3a839daa))
* **decree:** show quantity of items in decree clauses ([27cadf7](https://github.com/felfhenor/reform-kingdom/commit/27cadf7c2cf01833057764155e18727cb63c69f6))
* **gathering:** gathering node upgrade requirements are more ~diverse~ ([fbc854c](https://github.com/felfhenor/reform-kingdom/commit/fbc854ca9258ff42f47bb2e160effa3c5f6d60de))
* **item:** add gather yield bonuses to explorer trinkets ([febbc01](https://github.com/felfhenor/reform-kingdom/commit/febbc018c67db1682a4309bb62bcca6d99b4be2c))
* **item:** affixes that can boost damage to specific monster types ([46de6b5](https://github.com/felfhenor/reform-kingdom/commit/46de6b53d4ae15038bffc73ac4da27c450d1db15))
* **item:** improve display of stats and remove repetition ([063cf9f](https://github.com/felfhenor/reform-kingdom/commit/063cf9fecfa6295cd901007dd42a6c3938e55457))
* **items:** items now scale value for infusions and selling/buying based on resistances and combat stats, too ([9d25e6a](https://github.com/felfhenor/reform-kingdom/commit/9d25e6ad480606c731fa44ec0291d3579c6542d2))
* **items:** make items value scale more based on the different stats, rather than having a flat value per stat ([465c695](https://github.com/felfhenor/reform-kingdom/commit/465c695fba7d74923ab241107ebad705376cd6d7))
* **merchant:** merchants will now sell items with affixes ([e6ccde0](https://github.com/felfhenor/reform-kingdom/commit/e6ccde083f59fc37de002ec905c5603328248be9))
* **merchants:** cut down merchant swap time ([afaf621](https://github.com/felfhenor/reform-kingdom/commit/afaf6215f5710fc75c01353053936d8d9bd411e6))
* **merchant:** show currently active merchant upon visiting ([f3ca43a](https://github.com/felfhenor/reform-kingdom/commit/f3ca43a1220502b4bdd15c3c63aa49b164be5988))
* **monster:** support leveled monster drops ([d9607ab](https://github.com/felfhenor/reform-kingdom/commit/d9607abf2f56a8c608706cfac741b25ed2ffbe37))
* **node:** mystical nodes will show when they are currently cleared. also, show rewards earned count on all nodes ([09ce9b4](https://github.com/felfhenor/reform-kingdom/commit/09ce9b4a119552b2326957ab1bf45c7f5204711c))
* **shrine:** add drop rate shrine, rename some other shrines ([ce05e0a](https://github.com/felfhenor/reform-kingdom/commit/ce05e0a1b40ef4e9cd235cf64bbdb9bf83e77695))
* **shrine:** add gather buff shrine ([88c49cf](https://github.com/felfhenor/reform-kingdom/commit/88c49cfe7df1e56c24bb3f40db4864f24c4fa804))
* **skills:** allow spells to say they never miss, ever ([7962049](https://github.com/felfhenor/reform-kingdom/commit/7962049728e09fb2554282bb7636ce12dc44249b))
* **town:** rep can no longer exceed max, and shows the correct value when maxxed ([9195a48](https://github.com/felfhenor/reform-kingdom/commit/9195a4837b4fa1ef8b7384273df22b9d94838626))
* **town:** show item in craft queue with real tooltip ([fc7e2bb](https://github.com/felfhenor/reform-kingdom/commit/fc7e2bb7b5f0a9855b089154576688ae393a9d40))
* **towns:** rep quests can scale and be persistent so they aren't too much clicking ([6f7e5df](https://github.com/felfhenor/reform-kingdom/commit/6f7e5dfd38643d75571d8aafcfeb2105c25e8f05))
* **town:** towns will not craft things beyond their resource caps if applicable ([7ecb41b](https://github.com/felfhenor/reform-kingdom/commit/7ecb41b8aa48aeeb4b0afd1831a3738597b86ad2))
* **tradeskill:** recipes are more descriptive with origins ([5458f4d](https://github.com/felfhenor/reform-kingdom/commit/5458f4d1d644ce81f13b14245c25836561451575))
* **ui:** a more obvious indicator of whether or not a mystical node has been beaten ([2f4f506](https://github.com/felfhenor/reform-kingdom/commit/2f4f506ffccab6daf1948418ac1762e38cd20b8a))
* **ui:** add service worker to hopefully keep application from breaking mid-run ([4326c81](https://github.com/felfhenor/reform-kingdom/commit/4326c813bb718192600c6e3362fbc3df06859573))
* **ui:** add sfx to remaining buttons ([0118160](https://github.com/felfhenor/reform-kingdom/commit/01181609a7f600abbf71b2427a0ed8e6ec5b9d70))
* **ui:** change how recipes display their names ([7458cb2](https://github.com/felfhenor/reform-kingdom/commit/7458cb20fccaffc8c6be708790a3f18fa643902d))
* **ui:** clean up tooltip for skill display, display it in all places where it should ([76e749e](https://github.com/felfhenor/reform-kingdom/commit/76e749e509e415bc7f38093804aa52aa0d9d1a03))
* **ui:** display icons inline in combat messages ([4bab013](https://github.com/felfhenor/reform-kingdom/commit/4bab0138e61dd474ffb35393d31bfd8a8ffa4f1b))
* **ui:** improve comparison dialog ([5caeee8](https://github.com/felfhenor/reform-kingdom/commit/5caeee869a30faa60cfbb7e719cefd9795ee24a6))
* **ui:** improve gear selection screen by sorting items first by level, then raw item type ([d5acc8d](https://github.com/felfhenor/reform-kingdom/commit/d5acc8ded2e4ae56fe8b87a3fb9c220175df5f89))
* **ui:** improve sfx feel of ui ([d71ba18](https://github.com/felfhenor/reform-kingdom/commit/d71ba18900c8cb58b9e9dd6d368d49af58fc29f6))
* **ui:** item tooltip is now descriptive about all prefixes ([9eb1bb3](https://github.com/felfhenor/reform-kingdom/commit/9eb1bb36dae735fb06e87691ea6054d02633705e))
* **ui:** show EP bar for heroes, add labels, etc ([092567f](https://github.com/felfhenor/reform-kingdom/commit/092567f02cc2934843f87f63dfff27f47616d532))
* **ux:** make the bestiary/worker page resemble infusion page ([76a6acc](https://github.com/felfhenor/reform-kingdom/commit/76a6acc75aac9790d41660b4bf38cc44f26a77a7))
* **world:** add shrines ([48b6cc1](https://github.com/felfhenor/reform-kingdom/commit/48b6cc1886571e3c5294c07f4bf3ab5673b93e6a))
* **world:** mystical nodes drop a lot of gold ([7fa4788](https://github.com/felfhenor/reform-kingdom/commit/7fa4788a618d755597fd096a61876c2806c77fb3))
* **world:** mystical nodes now give infusions that increase spirit and constitution. also, added those stats ([f4d06f9](https://github.com/felfhenor/reform-kingdom/commit/f4d06f94f0b5a6ae851819516ef9f9c335bd78fa))
* **world:** show the whole gang walking around ([401a2fd](https://github.com/felfhenor/reform-kingdom/commit/401a2fd8391268d990bd8e42099b1f5281a1b534))

## [0.6.1](https://github.com/felfhenor/reform-kingdom/compare/v0.6.0...v0.6.1) (2026-09-08)


### Features

* **astralprojector:** add 2 new spells ([21cca47](https://github.com/felfhenor/reform-kingdom/commit/21cca470af4f4f130196122c05e5ba427c4fb81d))
* **commissions:** rework titles, add better lore ([40f3197](https://github.com/felfhenor/reform-kingdom/commit/40f31976d2bbe5cc20513eab35bffccfff0d78a2))
* **hero:** optimize equipment should allow higher equipment to shine through even though lower level equipment might have higher stats ([3d1c06a](https://github.com/felfhenor/reform-kingdom/commit/3d1c06aa6c595851e8684642a879b5413048bbcd))
* **hero:** show ep cost on hero skills ([08156d8](https://github.com/felfhenor/reform-kingdom/commit/08156d818300898aff9a67a03694deb651f58eb8))

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

## [0.5.4](https://github.com/felfhenor/reform-kingdom/compare/v0.5.3...v0.5.4) (2026-08-28)


### Bug Fixes

* **adventurelog:** remove text color from buffs/debuffs ([e81ad60](https://github.com/felfhenor/reform-kingdom/commit/e81ad608bbdc632e67c987c25ad5eba0121525d4))
* **analysis:** analysis scripts run independently and without errors again ([d192ac9](https://github.com/felfhenor/reform-kingdom/commit/d192ac9c0b0ebe42d95cb7f7f326bf5ab98082fa))
* **analytics:** have more in-depth analytics on some events that can support it ([c20337c](https://github.com/felfhenor/reform-kingdom/commit/c20337c1cfc544963b575786788e881cbaeff20f))
* **perf:** improve perf of pixi map ([d66dfff](https://github.com/felfhenor/reform-kingdom/commit/d66dffff0f873280773b63f68e2416cb20c72a93))


### Features

* **gathering:** gathering nodes can now be leveled up, which can unlock new materials or higher yields (or both) ([a206425](https://github.com/felfhenor/reform-kingdom/commit/a2064253778a72046a4313104682c59f0af321d1))
* **kingdom:** rework kingdom page to be a bit more friendly ([0c9cf8d](https://github.com/felfhenor/reform-kingdom/commit/0c9cf8d35bd8317da5884958b49ac3f8248d2ce1))
* **reclass:** reclassing now costs gold ([b85fe4d](https://github.com/felfhenor/reform-kingdom/commit/b85fe4da6647807be799431d884f32a5fe61b5be))
* **ui:** call out shift+click for multi select/sell ([d61f52b](https://github.com/felfhenor/reform-kingdom/commit/d61f52b1854b621eea8ebe0bde0e4cde7db84d61))
* **ui:** show colors only for the name of the combatant, rather than the whole line (confusing) ([a8271c3](https://github.com/felfhenor/reform-kingdom/commit/a8271c3e5a8e7493e00472d506214561ac80105f))
* **world:** scaffold felway ([7d69d0a](https://github.com/felfhenor/reform-kingdom/commit/7d69d0a9b6a932ffc03ad384c845320a994bee15))

## [0.5.3](https://github.com/felfhenor/reform-kingdom/compare/v0.5.2...v0.5.3) (2026-08-27)


### Features

* **core:** traders can now sell recipes ([1e6f509](https://github.com/felfhenor/reform-kingdom/commit/1e6f509f8427cd3c2e46c3361c5054527e812eec))
* **world:** add templars retreat for real. add content, new items, new monsters, new encounters, etc. update maps, content creation guide for useful guidelines ([61d0187](https://github.com/felfhenor/reform-kingdom/commit/61d01877d46f5e3197a1aba33dae17519c71880b))

## [0.5.2](https://github.com/felfhenor/reform-kingdom/compare/v0.5.1...v0.5.2) (2026-08-26)

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
