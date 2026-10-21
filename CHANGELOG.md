
# [0.12.0](https://github.com/felfhenor/reform-kingdom/compare/v0.11.1...v0.12.0) (2026-10-21)


### Bug Fixes

* **combat:** buffs can never miss ([4f80357](https://github.com/felfhenor/reform-kingdom/commit/4f8035759f90ab74677ff74fd726f11e9ceca9dd))
* **combat:** buffs should never be able to miss based on target LUK ([35469a7](https://github.com/felfhenor/reform-kingdom/commit/35469a76a4616c34ace276e9ce19e9451c59303d))
* **dx:** invalid asset files won't crash the file watcher anymore ([8c0b757](https://github.com/felfhenor/reform-kingdom/commit/8c0b757c013cbb3450af1038e8355da7c62dbca2))
* **hero:** promoting a hero will no longer cause that hero to disappear from the list ([7604e9c](https://github.com/felfhenor/reform-kingdom/commit/7604e9c9caa589d10bf047b2c2563b986cc8b64f))
* **ui:** be more explicit about what duchy actions / combat actions are ([dc6b336](https://github.com/felfhenor/reform-kingdom/commit/dc6b3362133954059460df3eda9fb7b61fb9a852))
* **ui:** region intros will sit in place rather than jump around while typing ([efa7f07](https://github.com/felfhenor/reform-kingdom/commit/efa7f07b0069c2117109c8f942b368be630381dc))


### Features

* **combat:** support "cover" combat stat ([3fd749c](https://github.com/felfhenor/reform-kingdom/commit/3fd749cf64240f32b09eae1c18767cb07da5d7d8))
* **combat:** support EP draining ([ebee95b](https://github.com/felfhenor/reform-kingdom/commit/ebee95b373090d316ad29131544f04767854db82))
* **decree:** decree should show gray background on items for readability ([1afce79](https://github.com/felfhenor/reform-kingdom/commit/1afce79e004aac4ddf6f3c20a05349e666cbab8e))
* **discord:** add a few more discord statuses ([1435860](https://github.com/felfhenor/reform-kingdom/commit/14358606f575c01ed87686c0aec5472975890979))
* **job:** add cover, follow up, and monster research passives ([f0d8b21](https://github.com/felfhenor/reform-kingdom/commit/f0d8b21dcd8b40168c4c6bae37c21bc034c704e7))
* **job:** add ranger scavenger ability ([5254a4d](https://github.com/felfhenor/reform-kingdom/commit/5254a4db02fe6e26f55c5cbec627fa969caba11c))
* **skills:** add 'prefers heroes' in prep for ultimate skills ([7cc05f7](https://github.com/felfhenor/reform-kingdom/commit/7cc05f798ed42895901074d870eebc055d34db2f))
* **skill:** shields are now a thing skills can do. add aegis. ([8ff2474](https://github.com/felfhenor/reform-kingdom/commit/8ff247440e5e5cacb808ec06a6ab1a10b9f9d744))
* **skilltree:** add hero spec icons/labels ([a817c78](https://github.com/felfhenor/reform-kingdom/commit/a817c783071aff7e683b5ea8294c2d030d144ddd))
* **town:** add 'buy max' to town materials ([9db4deb](https://github.com/felfhenor/reform-kingdom/commit/9db4deb2e41fabf7b504bd02062839541cfadd61))
* **ui:** caravans have buy max too ([924fe40](https://github.com/felfhenor/reform-kingdom/commit/924fe40ee0587da64b3874348a916737952b76b1))
* **ui:** show quantity of owned materials on gather nodes and rewards ([9de7122](https://github.com/felfhenor/reform-kingdom/commit/9de7122d2aab82995f4635e7357ec7d9f94c104d))
* **ui:** support ui scale in game ([c68f9c4](https://github.com/felfhenor/reform-kingdom/commit/c68f9c4f81f3abdfcf8334da0e55e6e7223fddf6))
* **world:** can double click to travel to a location ([4da389b](https://github.com/felfhenor/reform-kingdom/commit/4da389bae765eb69d020e5c1d46dcdb359c75816))
* **world:** make wergen sticks more common by default ([6b678e8](https://github.com/felfhenor/reform-kingdom/commit/6b678e8012f2806f7adfe7ae21af6a7e09b92e87))

## [0.11.1](https://github.com/felfhenor/reform-kingdom/compare/v0.11.0...v0.11.1) (2026-10-14)


### Bug Fixes

* **content:** remove extraneous cost entries that don't apply to current content ([a6467cf](https://github.com/felfhenor/reform-kingdom/commit/a6467cfb26ffe885514d7cbbf465f818259028ef))
* **dx:** clean up # of writes/reloads when saving a data file ([441f7d8](https://github.com/felfhenor/reform-kingdom/commit/441f7d8aa2fdaf0342536f5cc007fb3a82873be1))
* **map:** map should add commas to quantities, too ([a6b7380](https://github.com/felfhenor/reform-kingdom/commit/a6b738001510a3ec3235726b75b246d9dc7b8898))
* **ui:** combat orders should always show icons - even in regalias! ([58f0f20](https://github.com/felfhenor/reform-kingdom/commit/58f0f20b4775cc76c110af10331111e4af63e319))
* **ui:** hero page now correctly lines up skills with other parts of the ui ([24ef18a](https://github.com/felfhenor/reform-kingdom/commit/24ef18a4159a82768c2e9694c36c4651c0712f7c))
* **ui:** smoke puff should only trigger when looking at the screen where it's active ([4883d2b](https://github.com/felfhenor/reform-kingdom/commit/4883d2b24f30f62a8fe7d674fc28ddfa077b6b12))
* **ux:** less jank/jitter on world setup page ([95bfb3a](https://github.com/felfhenor/reform-kingdom/commit/95bfb3aeec9a37d475bbc5d99c7f73ab927dd121))
* **world:** labels should render above heroes ([ca70da9](https://github.com/felfhenor/reform-kingdom/commit/ca70da92fad530264e03081cd6a26a9d093f15a9))


### Features

* **armory:** add some color to the otherwise blank-background while selling ([f1d484e](https://github.com/felfhenor/reform-kingdom/commit/f1d484e47f88005d4d5c13d5a5d9e9335c11fe6f))
* **combat:** log shows hp/ep remaining for target ([348c6ca](https://github.com/felfhenor/reform-kingdom/commit/348c6ca1669c34b1581656906a77fbbaf86900d3))
* **heroes:** add hero abilities based on jobs ([7d56ac9](https://github.com/felfhenor/reform-kingdom/commit/7d56ac9366af97ad301d7f34f180e994dc74ac0d))
* **lore:** add lore ([a1119a2](https://github.com/felfhenor/reform-kingdom/commit/a1119a273ed5577281b6e2392b6620d66ab76af6))
* **lore:** lore popups shatter now ([5c10f3f](https://github.com/felfhenor/reform-kingdom/commit/5c10f3f9f7fb71803cab5872feaa62f2dd8b99d6))
* **merchant:** trades remaining -> stock ([b19e871](https://github.com/felfhenor/reform-kingdom/commit/b19e871b58da99089111392e9632ec9282b57294))
* **npe:** new players will get some default combat orders (hidden until level 3), as well as a starting item to make sure every class has something they can use to use those orders with ([c5bbacb](https://github.com/felfhenor/reform-kingdom/commit/c5bbacbf73cac130c86b83fd23c54deed0155f09))
* **setup:** hide analytics when hitting new game ([ba34395](https://github.com/felfhenor/reform-kingdom/commit/ba34395cbf1531e38e2c71eed19dc0e6c04ec49c))
* **ui:** show # owned items in worker page ([68cd6f3](https://github.com/felfhenor/reform-kingdom/commit/68cd6f3a7e2f0ee0ead3d6948895a9098fdaf54d))
* **ui:** show when hero skills are blocked by inability to use a skill ([6dcc622](https://github.com/felfhenor/reform-kingdom/commit/6dcc62262799d4b8071ace7d0cc732de6170fc86))
* **ux:** add icons for each kingdom location/action so it's not a weird mix ([7528a14](https://github.com/felfhenor/reform-kingdom/commit/7528a1425c6e6104a0fc9ca7872bc2baa77954c8))
* **ux:** rework the entire application to have a simpler, more consistent UX ([ece0426](https://github.com/felfhenor/reform-kingdom/commit/ece0426f3612f1543073afc6c7a36b7dfc160d7d))
* **ux:** rework ux of heroes page so it isn't button hell in random places ([28ae8f8](https://github.com/felfhenor/reform-kingdom/commit/28ae8f8da2459cf4bccd372c6446a149b97ec4c7))
* **world:** add timers to developable nodes ([5a7d18e](https://github.com/felfhenor/reform-kingdom/commit/5a7d18e5391fd693e843113f620417042f4b66dc))
* **world:** gathering nodes will now show tradeskills corresponding with each gather material ([0e74190](https://github.com/felfhenor/reform-kingdom/commit/0e74190aced7626d986d1cf1d9791cd06c309f98))

# [0.11.0](https://github.com/felfhenor/reform-kingdom/compare/v0.10.0...v0.11.0) (2026-10-12)


### Bug Fixes

* **analysis:** lifesurge should not give analysis warnings ([f599795](https://github.com/felfhenor/reform-kingdom/commit/f599795a772141dfdfafac21628af4c5cee30873))
* **armory:** loot filters now have white text buttons ([7409dd9](https://github.com/felfhenor/reform-kingdom/commit/7409dd955cc1c9f2c8f01dc57ee4c19c9ac6e6ec))
* **ci:** CI should show the correct errors now ([41ceb35](https://github.com/felfhenor/reform-kingdom/commit/41ceb35b7810c346e1f2db98c9810feba5d96f7b))
* **content:** felway monsters should drop fel essence ([4eebac7](https://github.com/felfhenor/reform-kingdom/commit/4eebac7d8b241b6b4056088ee5733da2c71be173))
* **core:** add build-barrels, add a bunch of barrels, lazy-load helpers since it's not urgent ([3d4c19a](https://github.com/felfhenor/reform-kingdom/commit/3d4c19a52c2b6d4fc01a24583c74072842d73cd9))
* **decree:** raid defense will travel through nodes ([121160f](https://github.com/felfhenor/reform-kingdom/commit/121160f7ec349c1fbe59a4f76757432f3a8ed187))
* **decree:** should reset to 100 even after submitting a clause ([4909eac](https://github.com/felfhenor/reform-kingdom/commit/4909eac7e3bd0f508c0c5705295b8de8ec0194bf))
* **tradeskill:** adjust math slightly for what recipes should give so the gradient works as expected ([e620394](https://github.com/felfhenor/reform-kingdom/commit/e620394f91e0e8fc5c755656b50cccd6f0017f73))
* **ui:** ensure tooltips on disabled currency row actions show ([5e65aad](https://github.com/felfhenor/reform-kingdom/commit/5e65aadc7759eaf9df6a3b2401e4abf2043142a2))
* **ui:** Lv. text consistency in more of the game ([ab8ac9a](https://github.com/felfhenor/reform-kingdom/commit/ab8ac9a26b6ccd291632a370271dd3a3670360d0))
* **ui:** savefile panels are all the same height ([0a3c91a](https://github.com/felfhenor/reform-kingdom/commit/0a3c91aa1ea7db9a415a76ea642bcd8b9cd250a4))
* **validate:** add validation to make sure monster drops are not 0% ([f79d3ec](https://github.com/felfhenor/reform-kingdom/commit/f79d3ecc3e56b135e6813952d61e026209e578a3))
* **world:** diurtar level range fix - prevent this with validation ([1ed8869](https://github.com/felfhenor/reform-kingdom/commit/1ed88697dccd919016a3777a24427c8e585c56b9))
* **world:** no more 1 xp, always 0 xp if too overleveled ([20ccd86](https://github.com/felfhenor/reform-kingdom/commit/20ccd86e10df9090f7f45c1734ba4f821648f44e))
* **world:** traveling in the world should not look so janky ([aec707a](https://github.com/felfhenor/reform-kingdom/commit/aec707ac4e5890bc6783072d8a105085f4fd89eb))


### Features

* **commission:** commissions now let you click on the icon to navigate to the tradeskill ([b5f0a03](https://github.com/felfhenor/reform-kingdom/commit/b5f0a03bb78d040a7a72c2aa8a743fdd4d1ac847))
* **content:** felrock -> copper ore is now 5s ([4152b7d](https://github.com/felfhenor/reform-kingdom/commit/4152b7dcd35ce2a8a59c34eef8fb668ec4d67c72))
* **decree:** add a "gather material" that is "gather from node" but in reverse ([c15fb61](https://github.com/felfhenor/reform-kingdom/commit/c15fb615cf5f2a6d26861ea41d66959e53f47ae3))
* **equipment:** reroll will now have some unique affixes ([de7f15b](https://github.com/felfhenor/reform-kingdom/commit/de7f15be1797eb5c1554892b3ddc2dd19d13a391))
* **museum:** museum now has spoilers for unseen map nodes ([56ad2ce](https://github.com/felfhenor/reform-kingdom/commit/56ad2cec6a62c210aed337b87a23af6a80817366))
* **nav:** add a quick action for trainer access ([8a020d5](https://github.com/felfhenor/reform-kingdom/commit/8a020d5c9cca3335a3e0582e46453ae622f79983))
* **nav:** rework navbar to have bigger/more readable buttons + move the town button to the right side ([34f5c99](https://github.com/felfhenor/reform-kingdom/commit/34f5c992d5a817c772a4a0d526d3720ec9ab161b))
* **regalia:** add regalias ([672c6b1](https://github.com/felfhenor/reform-kingdom/commit/672c6b16af56ce8536f5b97484cf6e4716863260))
* **setup:** show job shorthand in world setup since it's used everywhere in game ([4b953b3](https://github.com/felfhenor/reform-kingdom/commit/4b953b33868a172ba48c3161088a4c5dfb944361))
* **skill:** add burst skills, add a lot of new skills to enemies, bosses, heroes, trainers ([77c0ad9](https://github.com/felfhenor/reform-kingdom/commit/77c0ad96e95c3eadb111208bac6efa3ef08c6230))
* **skill:** add tag for reflectable skills ([9f19659](https://github.com/felfhenor/reform-kingdom/commit/9f19659f73d882bde11f8d579d090808dfdeaaab))
* **ui:** add "clean text" option ([20d8b72](https://github.com/felfhenor/reform-kingdom/commit/20d8b7259791369e724309210e7668fcedbf92e9))
* **ui:** add a side rail for quicker nav in kingdom area ([5ac0156](https://github.com/felfhenor/reform-kingdom/commit/5ac015639c4f0cdabee3e3ca35377717c9ee3ba5))
* **ui:** add detailed material sources for tradeskill crafting/astral projector/commissions/general requirement slots ([1e35f93](https://github.com/felfhenor/reform-kingdom/commit/1e35f93aca1b6b32d211c05ea8f8fb455eb82c45))
* **ui:** currency rows will display sources for items to make them easier to find ([de8a741](https://github.com/felfhenor/reform-kingdom/commit/de8a741a1c616de32fd561db7656baf5580a1fbb))
* **ui:** display icons for source nodes in material tooltips ([e95d5ca](https://github.com/felfhenor/reform-kingdom/commit/e95d5ca19b7c010438e1bca08800209c79fde278))
* **ui:** show sprites in class dropdowns for reclass/new game ([1710de3](https://github.com/felfhenor/reform-kingdom/commit/1710de329ab46076788edc5ab0b15cfaad896ea7))
* **ui:** support 'difficulty colors' for a more consistent UX in anything that requries difficulty ([4142574](https://github.com/felfhenor/reform-kingdom/commit/4142574ccbd639223bb35a1c97c8b30c85435ace))
* **ux:** consistent hint/etc messages ([f930c00](https://github.com/felfhenor/reform-kingdom/commit/f930c00a593233e120834ef1a609b6a1530e5c26))
* **ux:** improve tab ux ([77d721b](https://github.com/felfhenor/reform-kingdom/commit/77d721b44051c1eb7643dccc059860742a8232ba))
* **ux:** remove outlined badges everywhere ([3d1987a](https://github.com/felfhenor/reform-kingdom/commit/3d1987af1c3c439bbabdc8db9d9c7e7e620de96e))
* **ux:** rework 'reforge' and 'infuse' into 'workshop' - add tutorials, fix other tutorials for bursts ([5fe6c2c](https://github.com/felfhenor/reform-kingdom/commit/5fe6c2c780c9ed6fcd0bd59ea062da3ce107c8a9))
* **worker:** workers can now craft materials ([92d7abf](https://github.com/felfhenor/reform-kingdom/commit/92d7abfa32dc3b15cc1c8ebe8e75391e144e2748))
* **world:** add a little background noise to the map ([861f3df](https://github.com/felfhenor/reform-kingdom/commit/861f3dff95325f5d7a578e1002af596e15c252e0))
* **world:** duchy node should have an action ([866b83f](https://github.com/felfhenor/reform-kingdom/commit/866b83fbe712fa32fdd9714b50dffedcb4b5532d))

# [0.10.0](https://github.com/felfhenor/reform-kingdom/compare/v0.9.0...v0.10.0) (2026-10-09)


### Bug Fixes

* **adventurelog:** display should be a bit less jank for longer messages ([d8cca39](https://github.com/felfhenor/reform-kingdom/commit/d8cca39c1cfb65479be3dc901b657cf20e6a13af))
* **analysis:** fix obtainability when granting an item from a higher level to lower level recipe ([7235649](https://github.com/felfhenor/reform-kingdom/commit/723564903d9ba1c9efdbb3f1e52e0e7e8794147f))
* **analysis:** outposts should count as routable for workers in analysis tools ([4f0d2de](https://github.com/felfhenor/reform-kingdom/commit/4f0d2de5ac91e9b4fa7dfbdec43c4e0e224ca73b))
* **bestiary:** add better number formatting to bestiary ([5026bed](https://github.com/felfhenor/reform-kingdom/commit/5026bed27b4e45f944c3b0e8b8658201e3429e88))
* **bestiary:** bestiary ??? nodes are not clickable if the creature is not discovered ([ef6fd47](https://github.com/felfhenor/reform-kingdom/commit/ef6fd47214115a3f72eccc4e475fc4003d624385))
* **combat:** final encounter of combat should always give combined rewards rather than showing multiple log lines for them ([79c34ae](https://github.com/felfhenor/reform-kingdom/commit/79c34aeba93c85cf9a818da9c79ddd2c8a4d3092))
* **combat:** rework status effect ticking & downscale stun chance on sonic screech ([aea3be7](https://github.com/felfhenor/reform-kingdom/commit/aea3be7a2e0fa19db6ec4ae9d86b799123e0c958))
* **commission:** commission turn in should resync the encumbered effects ([9a30312](https://github.com/felfhenor/reform-kingdom/commit/9a30312183da26573fd4d9d9ad7ecd986a1ddcd8))
* **crafting:** crafting with an item will now refund that specific item, rather than a generic one ([1539895](https://github.com/felfhenor/reform-kingdom/commit/15398955369fe381f9e1d4f32d2b260bb799af99))
* **data:** item rewards will always have a min/max of 1, rather than 0 ([da4b558](https://github.com/felfhenor/reform-kingdom/commit/da4b5588368e84ec2873927127b62c608a38ea64))
* **decree:** decree now supports mystical nodes for "farm node" with appropriate warnings ([e9c5345](https://github.com/felfhenor/reform-kingdom/commit/e9c5345d10feed8622dbc9b4145272b1480ffbb5))
* **decree:** decree will no longer try to finish an area with a recipe that can't drop ([6a78f22](https://github.com/felfhenor/reform-kingdom/commit/6a78f22252d677820f130fd27acac6215b3fadd1))
* **decree:** decree will not go to mystic nodes that have no rewards available ([75d23e9](https://github.com/felfhenor/reform-kingdom/commit/75d23e930aff1bc382f2b338df31c0b34c3e5cce))
* **decree:** finish unfinished nodes should explore mystical nodes, too ([001bf59](https://github.com/felfhenor/reform-kingdom/commit/001bf59426bba2fe9ddcea59b2c2c7a2786ff241))
* **decree:** nodes like spiders tower are no longer inaccessible via decree ([15cda08](https://github.com/felfhenor/reform-kingdom/commit/15cda08cda37631a11b0ac510b748ab0adf752ac))
* **decree:** priority change fixes for decree ([1c7c812](https://github.com/felfhenor/reform-kingdom/commit/1c7c8123a8c56975369f1c4198f29c6136c5890c))
* **hero:** fix compare tooltip to have a min width too ([389144b](https://github.com/felfhenor/reform-kingdom/commit/389144bb6bab0e4ace1a7067a77272d66d171e88))
* **hero:** only show items for a lot when it is the primary of that slot ([baa8665](https://github.com/felfhenor/reform-kingdom/commit/baa8665acefa3fcb595830954922bc5d214ec5bc))
* **hero:** optimizer will better support multi-slot items ([dccd14d](https://github.com/felfhenor/reform-kingdom/commit/dccd14d15b52b6fffaf11c31afdaee0123fe2e9d))
* **item:** display gather yield with more description so it makes more sense ([ce6c6bf](https://github.com/felfhenor/reform-kingdom/commit/ce6c6bfb0f52240d822f90a083fbf4b7de7d01b1))
* **item:** rename hawk feather collectible so it isn't so close to hawk feather item ([d10ebb6](https://github.com/felfhenor/reform-kingdom/commit/d10ebb6c5f994f87141265933acc30edef323fd6))
* **map:** progress bar indicator should allow 3 lines of text below it ([a5c65c7](https://github.com/felfhenor/reform-kingdom/commit/a5c65c709bc25e39400bf42d59cef035eb517c43))
* **party:** mismatched party levels will not ruin xp gain for the lowest levels ([5d12cb4](https://github.com/felfhenor/reform-kingdom/commit/5d12cb416a1824316046d2d0f434165a5c2f8ff2))
* **reset:** resetting game should reset adventure log state ([f4ea943](https://github.com/felfhenor/reform-kingdom/commit/f4ea9438579efc87e3792202f5339315548d0d5d))
* **tasks:** add a little margin to space bar & text out ([b1f6782](https://github.com/felfhenor/reform-kingdom/commit/b1f6782ab3b69b9ac10e6c9da0262c51ed4245b6))
* **town:** craft pick on first visit should be equipment, not materials ([e8cfdf9](https://github.com/felfhenor/reform-kingdom/commit/e8cfdf937565171e6ffc4b7da78edd66bdf76255))
* **tradeskill:** recenter the uncraftable checkbox ([1c91c2e](https://github.com/felfhenor/reform-kingdom/commit/1c91c2e86f75bc5fd767a3e57e8b62ba5809ec34))
* **tradeskill:** reduce dependence on red slimes cores significantly ([492b353](https://github.com/felfhenor/reform-kingdom/commit/492b3534968b7004b938da25bcc1614e73754daa))
* **tradeskill:** remove ui jitter when tradeskill requirements exist ([522df7b](https://github.com/felfhenor/reform-kingdom/commit/522df7bae774f0b1e76b3cdc1d18e835060ce346))
* **tradeskill:** tradeskill chips should use # with a comma ([4b8df6b](https://github.com/felfhenor/reform-kingdom/commit/4b8df6b4e32d09a0a311dc74028b674a700d124a))
* **tradeskill:** tradeskill ui should fold a bit better ([b6df2c7](https://github.com/felfhenor/reform-kingdom/commit/b6df2c78586461f0af5d98d9f83717f65c306ad6))
* **ui:** back button on left, now an icon. rework spacing on most pages to fit the ui better ([c3317df](https://github.com/felfhenor/reform-kingdom/commit/c3317df3da75d6c6ba18e71722de189f4060122e))
* **ui:** fix small collision with top right cards & currency ([966ea58](https://github.com/felfhenor/reform-kingdom/commit/966ea5877b8ee63d10c9a4b862c6b3f9956d786f))
* **ui:** local storage for some things is dumb and shouldn't be ([1d4ddff](https://github.com/felfhenor/reform-kingdom/commit/1d4ddffc53020f82151d0584609edc0692a88bf1))
* **ui:** optimize all should also be disabled in combat ([b22b610](https://github.com/felfhenor/reform-kingdom/commit/b22b610a04e453e5e06c937399fcc9443b0491bd))
* **ui:** remove redundancy in pause menu ([9bd8ce7](https://github.com/felfhenor/reform-kingdom/commit/9bd8ce779be8e1e015dfcf6ef89caf3898f6a86d))
* **ui:** slight misalignment with combat orders ([94b0b43](https://github.com/felfhenor/reform-kingdom/commit/94b0b431014edd34ed86fa0672dd7502c9fe2427))
* **ui:** worker/hero page xp bars are now the right color, show "XP", and have similar widths ([718d312](https://github.com/felfhenor/reform-kingdom/commit/718d31259456abad6b22752bde8a2487ece4c276))
* **vfx:** disable vfx when page is hidden ([7d87723](https://github.com/felfhenor/reform-kingdom/commit/7d877235ab549c29f1146285adcd56d32b52593a))
* **world:** rebalance gathering nodes in larsia to be 10 second gathers ([34fac5d](https://github.com/felfhenor/reform-kingdom/commit/34fac5d7bb4469a88900d920283112574fe104dc))


### Features

* **adventurelog:** allow searching in adventure log ([9e7768b](https://github.com/felfhenor/reform-kingdom/commit/9e7768b84c437811829326f1cd6c043d4aad263a))
* **adventurelog:** better display of messages when raid loss happens ([d0a5531](https://github.com/felfhenor/reform-kingdom/commit/d0a553123fb5f2570de557a747e547e6b2543f65))
* **combatorders:** add support for 'enemy health vs %', matching enemies, and fix targetting related to that ([5072a2e](https://github.com/felfhenor/reform-kingdom/commit/5072a2ec2e2b48f898d73e0408a690642f55f8a8))
* **combat:** show debuffs/buffs in combat per combatant ([32c7148](https://github.com/felfhenor/reform-kingdom/commit/32c71485820317164d0ab915434bd11497638349))
* **commissions:** move badge to better page location ([4368c32](https://github.com/felfhenor/reform-kingdom/commit/4368c32b8aeaa619dc70f42a11c0e2249613e74c))
* **content:** add an infusion to kor'ratha ([8da78f0](https://github.com/felfhenor/reform-kingdom/commit/8da78f0b2ab98cd1d3118bb034a1e625e436d19c))
* **decree:** workers & heroes using decree can use outposts for teleports ([554cd33](https://github.com/felfhenor/reform-kingdom/commit/554cd3356845147999fd48d714d22ad877199927))
* **equipment:** equipment has elemental resistances, buffs, etc now. so do monsters! ([0054b48](https://github.com/felfhenor/reform-kingdom/commit/0054b48bd99f7f8573dc76dae265542860658195))
* **infusion:** infusion can now infuse items in armory ([ff46223](https://github.com/felfhenor/reform-kingdom/commit/ff46223d713f27c1e5c03e8a84b6d0d41a784f99))
* **infusion:** rework infusion ui to be laid out similar to reforge ([423e20d](https://github.com/felfhenor/reform-kingdom/commit/423e20dd90294f578b751812184808e7517347ed))
* **map:** map should use the same font as the game ([ba853a4](https://github.com/felfhenor/reform-kingdom/commit/ba853a4de9356b4624cb66572e076b1dfd44e8e8))
* **outpost:** +5 outposts can teleport between each other ([3e6fbc7](https://github.com/felfhenor/reform-kingdom/commit/3e6fbc71114241502ab329fb035d0552a9b53fe3))
* **outposts:** add outposts ([807882e](https://github.com/felfhenor/reform-kingdom/commit/807882e2c031e56d3b06b21e65925089ccda8b05))
* **reforge:** add reforge feature ([a3437b4](https://github.com/felfhenor/reform-kingdom/commit/a3437b4ecc53f8f8eb775498c378e03b85c06930))
* **reforge:** move reforge button to new action area ([303620d](https://github.com/felfhenor/reform-kingdom/commit/303620da0cd2843a8b7ec1fd4c395f90f05b5e0a))
* **savefile:** add better backup resilience for savefiles ([a23d621](https://github.com/felfhenor/reform-kingdom/commit/a23d621565638f584735ea1ef2dc685d3617f8a6))
* **skill:** skills support accuracy now ([83844f6](https://github.com/felfhenor/reform-kingdom/commit/83844f60bdafecdcec06ddadd38205d9205733e4))
* **town:** allow raids to be resolved in other ways - more coming ([dd6b9e0](https://github.com/felfhenor/reform-kingdom/commit/dd6b9e0e3f7b8f0d3e216e0392ccf5a4da70ef3a))
* **town:** put raids on cooldown the moment a town is visited to give some grace time ([8a9b8d9](https://github.com/felfhenor/reform-kingdom/commit/8a9b8d97ca5c2f6d60c0adbe513f40379128cbf6))
* **town:** start crafts and give town some starter items when visiting for the first time ([76b54ca](https://github.com/felfhenor/reform-kingdom/commit/76b54caf23fc61a1b8d068956bc8826ad3b32da9))
* **town:** towns get a default set of materials when you visit them the first time so they don't start from scratch, which is unrealistic ([7f76483](https://github.com/felfhenor/reform-kingdom/commit/7f7648352a2c06dca78c5995f7ce8cb52b4ba0ec))
* **tradeskill:** be much more clear about how tradeskill xp works ([71ac917](https://github.com/felfhenor/reform-kingdom/commit/71ac91700689c8467828d8bb6eaa104cd529a64f))
* **tradeskill:** the max queueable for a recipe is different from max craftable - this is reflected correctly ([1953b4c](https://github.com/felfhenor/reform-kingdom/commit/1953b4c7e1f2c1bf151c84a238c83f5483a55258))
* **trainer:** rebalance need for buyable only infusions ([18c38f5](https://github.com/felfhenor/reform-kingdom/commit/18c38f5e419aeddad1951fb85178db129d0a9987))
* **tutorial:** add a tutorial for when players are struggling ([590f04b](https://github.com/felfhenor/reform-kingdom/commit/590f04b40a427effce7c249bbe5fbf76e6a429bf))
* **ui:** add click-to-navigate for crafting cards too ([805c2cb](https://github.com/felfhenor/reform-kingdom/commit/805c2cb9c9876561a4f23d50ff7eabeda2c7308b))
* **ui:** add tooltips to optimize to instruct on what it does and how it works ([4cd4b06](https://github.com/felfhenor/reform-kingdom/commit/4cd4b0617bce98411183dec7718e2555598098c3))
* **ui:** can use shift+click to bypass some modals in game ([02a18db](https://github.com/felfhenor/reform-kingdom/commit/02a18dbfa3d2090e82043b30056206f1dfa5ed7d))
* **ui:** move all search bars to a common location ([e4b033d](https://github.com/felfhenor/reform-kingdom/commit/e4b033db8fc70ccedaa4e868a1b6bb6918ce3117))
* **ui:** show when something requires a tradeskill level to drop ([42bbd3e](https://github.com/felfhenor/reform-kingdom/commit/42bbd3e6faf9edae37c04b5daf9574856cfe2a24))
* **ui:** unite icons under a similar component, add colors to other stat-related things ([3a09ab6](https://github.com/felfhenor/reform-kingdom/commit/3a09ab6fe12ea6f7eb08fef36bb00ae1d9d6ffe1))
* **ui:** worker level up indicator goes to the worker ui ([d5eb878](https://github.com/felfhenor/reform-kingdom/commit/d5eb878252ff523b7310e24adb6f5652b01dba0a))
* **ux:** kill border radius globally ([8fdaf0a](https://github.com/felfhenor/reform-kingdom/commit/8fdaf0ae8216d659b5faa28a603d1b68ee436e70))
* **workers:** show whether or not workers get XP on a node, show level range on the current assignment to track it better ([c182046](https://github.com/felfhenor/reform-kingdom/commit/c1820465a83a39f107cf03212ac9613b837d37ff))
* **world:** add a worker to kor'ratha ([714ed52](https://github.com/felfhenor/reform-kingdom/commit/714ed520768b263a274bc9bc93a8082f890740ee))
* **world:** add exchange nodes that can swap items ([95bd8f3](https://github.com/felfhenor/reform-kingdom/commit/95bd8f3f404771c672ada279b4294d8e989abb8c))
* **world:** gathering nodes get a time reduction for leveling them up ([8c7a3e9](https://github.com/felfhenor/reform-kingdom/commit/8c7a3e9338a8374e7f53b0fbeed3a8d1441aab65))

# [0.9.0](https://github.com/felfhenor/reform-kingdom/compare/v0.8.0...v0.9.0) (2026-09-27)


### Bug Fixes

* **core:** adventure log xp gain message + real xp gain message were desynced ([cbbd3d3](https://github.com/felfhenor/reform-kingdom/commit/cbbd3d379dd157d806dbb9859ce9a50f11a0e3bc))
* **heroes:** re-align gear/equip col/skill col so they line up better ([264e3ba](https://github.com/felfhenor/reform-kingdom/commit/264e3bab3b2c33fa2fdb53cb51fb1b2e04d3a177))
* **loading:** loading screen doesn't jank out before the bar is filled ([1808784](https://github.com/felfhenor/reform-kingdom/commit/180878430798c856da066071710463275979b82c))
* **tradeskill:** fix perf of tradeskill ui ([80fbc39](https://github.com/felfhenor/reform-kingdom/commit/80fbc39112507a3795e96abe9e8fbfd9e2ac22e6))
* **ui:** fix jank animation of numbers on hero page ([334b784](https://github.com/felfhenor/reform-kingdom/commit/334b784ba14e5c73f3045beb078b898e3bcd86db))
* **ui:** make sure adventure log overlay always sits in the same spot ([5bf3398](https://github.com/felfhenor/reform-kingdom/commit/5bf339868c05810c3381c17a2bf3f5731830db46))
* **ui:** remove confetti animation and use gold swoosh for workers ([f73cca8](https://github.com/felfhenor/reform-kingdom/commit/f73cca8cde0bd2e6d23a26ca92203e5adf9c654f))


### Features

* **combat:** better damage numbers for combat ([8283b9e](https://github.com/felfhenor/reform-kingdom/commit/8283b9e0a2b9f23179de4a46047260a0ef26b4d9))
* **combat:** damage numbers ~pop~ ([120ae1f](https://github.com/felfhenor/reform-kingdom/commit/120ae1fa50128206634d3b7792ada5cc8fc97b4d))
* **heroes:** add ability to promote and demote heroes at the duchy ([41ee80a](https://github.com/felfhenor/reform-kingdom/commit/41ee80a2f594f4c62f4a4854aecdf99fdf798d39))
* **heroes:** add optimize all button ([3ae74ce](https://github.com/felfhenor/reform-kingdom/commit/3ae74ce5025804d19e38046689716879676e9c43))
* **heroes:** rework 'equippable by' to include class names rather than hero names ([9b31391](https://github.com/felfhenor/reform-kingdom/commit/9b313919ccaa2593727a5dbc4418d978f179cae0))
* **tasks:** add an icon! ([0ce0559](https://github.com/felfhenor/reform-kingdom/commit/0ce05597cab633743596f2e037d2b132161b8f8b))
* **tasks:** add tasks to help with player onboarding ([269153f](https://github.com/felfhenor/reform-kingdom/commit/269153f87fb2ce542f6db48476305466854e304a))
* **tradeskill:** add filter to tradeskills ([0dbe293](https://github.com/felfhenor/reform-kingdom/commit/0dbe2933a050f9a39ec0c147444d05a32c3f4f81))
* **ui:** add a gold burst anim for leveling up heroes ([4c7ea48](https://github.com/felfhenor/reform-kingdom/commit/4c7ea48f8e63d84bfca188339f3d09afb0e04844))
* **ui:** add a small stagger-in anim for bestiary ([62267d1](https://github.com/felfhenor/reform-kingdom/commit/62267d114b4df5e3dca8d3a449e87f0542f36644))
* **ui:** add a world log overlay on thescreen that gives an at-a-glance view of what's going on ([8c040d2](https://github.com/felfhenor/reform-kingdom/commit/8c040d25ddc125895a9717f42dd303287d3bee7a))
* **ui:** add animation for monster entry in combat ([64bebe8](https://github.com/felfhenor/reform-kingdom/commit/64bebe81bd1c4dd5abc5a7ecd38186015be7d96a))
* **ui:** add animations for lists ([f5821af](https://github.com/felfhenor/reform-kingdom/commit/f5821af012a309c13501159cb290ad5f9f8de85a))
* **ui:** add animations to hero panel stats ([f681fdd](https://github.com/felfhenor/reform-kingdom/commit/f681fdd2ed0023f18b90bcef32b26ed152b7e1a4))
* **ui:** add same animations to combat orders ([ff843c4](https://github.com/felfhenor/reform-kingdom/commit/ff843c4c8a550ea5a11a519f3a7ebb0b215d141f))
* **ui:** add some more number tweening ([750c880](https://github.com/felfhenor/reform-kingdom/commit/750c880bbdc8c712aa1175721490107e6891d86b))
* **ui:** animation for modal ([30ce65f](https://github.com/felfhenor/reform-kingdom/commit/30ce65feb6795a2c04c34f9869b281255b3f8195))
* **ui:** bars support shimmer, loading screen has shimmer now ([4fbd38f](https://github.com/felfhenor/reform-kingdom/commit/4fbd38fde6526e98e7144330fda81ab00bf91211))
* **ui:** cap size of central game panels ([75013c6](https://github.com/felfhenor/reform-kingdom/commit/75013c618e1544f51d5dca13a930fca3ebda8187))
* **ui:** decorate decree clauses a bit ([ae4d9dd](https://github.com/felfhenor/reform-kingdom/commit/ae4d9dd1882faed1a24f1d38b5fa6747c6e108f5))
* **ui:** disabled buttons can have tooltips (duchy actions now have them) ([3430952](https://github.com/felfhenor/reform-kingdom/commit/34309523e2afb2b4c130e67b6bd0349e751e8986))
* **ui:** flyTo animation added for crafting ([95e430a](https://github.com/felfhenor/reform-kingdom/commit/95e430a3b97d0c10ace253e4ee394fd8405e0677))
* **ui:** improve display for worker level up to be consistent. add a fun pop! ([137112d](https://github.com/felfhenor/reform-kingdom/commit/137112d7e2788ff90f99d9451453b7f3077b68e2))
* **ui:** remove transition, fade in pages ([3701052](https://github.com/felfhenor/reform-kingdom/commit/3701052c5bdd893db0880da6786c933bcfcfaae4))
* **ui:** show energy/xp gain numbers too ([fa89ee1](https://github.com/felfhenor/reform-kingdom/commit/fa89ee1d2976c76b5c2ddfeba2dfd1322416815e))
* **ui:** task animations ([b2414b4](https://github.com/felfhenor/reform-kingdom/commit/b2414b4ec4dd09ff71daad58fc578ea71ff94f96))
* **ui:** tutorial has an animation ([3d2b15a](https://github.com/felfhenor/reform-kingdom/commit/3d2b15aa867e4d7f7086900cd850f17bf6f7709e))
* **world:** add trainers. they can teach you new things that persiste beyond class changes ([f147ced](https://github.com/felfhenor/reform-kingdom/commit/f147ced12cd382140c0a44366f647c04cce61b03))

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
