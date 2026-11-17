
## 0.15.1 (2026-11-17)


### Bug Fixes

* **combat:** disable the ability to charge a skill that's already being charged
* **combat:** fix left offset for monsters
* **combat:** fix string missing a comma in xp gained
* **edict:** lots of fixes for taskmaster combats
* **electron:** background images should load correctly in prod build
* **electron:** remove unnecessary service worker in desktop build
* **ui:** achievements post-manual-combat will now close the backdrop correctly
* **ui:** add commas to skill values when formatted
* **ui:** all glowing is now synchronized to keep the ui state looking consistent
* **ui:** don't show lv. -
* **ui:** emphasize accuracy on skills that have it (charged strike, etc)
* **ui:** hide decree material gathering clauses when warren hunt is active
* **ui:** line up top-right bubbles with the content better


### Features

* **combat:** add monster death sound
* **combat:** show charging skills
* **kingdom:** add colosseum to simulate combat
* **sfx:** play sample SFX to test volume
* **ui:** show how long a region took to seal when looking at the seal node. also, show which node seals the region
