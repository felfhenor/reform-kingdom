# re:Form Kingdom

## Setup

1. `npm install`
1. `npm run setup`

## Development

1. ` npm start`

## Tools Used

- [Angular](https://angular.io/) (for the frontend framework)
- [ngxstension](https://ngxtension.netlify.app/) (for extending angular in impactful ways)
- [ng-event-plugins](https://github.com/taiga-family/ng-event-plugins) (for extending angular event handling)
- [TailwindCSS](https://tailwindcss.com/docs) (for styling)
- [DaisyUI](https://daisyui.com/components/) (for the UI components)
- [Helipopper](https://ngneat.github.io/helipopper/) (for tooltips)
- [ngx-toastr](https://ngx-toastr.vercel.app/) (for notifications)
- [SweetAlert2](https://github.com/sweetalert2/ngx-sweetalert2) (for alerts)

## Assets

- SpellBook Megapack - global effect icons
- Admurins Items Mega Pack - item icons
- Oryx Ultimate Fantasy - sprite sheets for characters and enemies

## Useful Scripts

### Hero Stat Analysis

```
npm run analyze:herostats <lvl> <class1,class2,class3...>
```

This will run a check on hero job stats. It will show you their stats at a level, as well as their base damage output at a level for each skill they have at that level.

### Monster Stat Analysis

```
npm run analyze:monsterstats <lvl> <monster1,monster2,monster3...>
```

This will run a check on monster stats. It will show you their stats at a level.

### Material Utilization

```
npm run analyze:materialutilization
npm run analyze:materialutilization -- --expanded
```

This will examine all of the materials in the game, showing the least utilized ones (which are candidates for using more of before others). In expanded mode, it will show a lot more information about what is utilized, and how.

### Content Gaps

```
npm run analyze:contentgaps
npm run analyze:contentgaps -- --gap=<x>
npm run analyze:contentgaps -- --expanded
```

This will examine all content in the game (at the time of writing: items, tradeskills, infusions) and look for excessive gaps in utilization (default of 4)

### Node Levels

```
npm run analyze:nodelevels
npm run analyze:nodelevels -- --gap=<x>
```

This will examine all encounterable nodes in the game and sort them by level, showing their map and any gaps in levels (default of 2).

### The Simulator

```
npm run simulate -- --mode=curated --trials=1 --tick-budget=36000 --verbose=true
npm run simulate -- --mode=<exhaustive|curated> --trials=<1> --tick-budget=<60000>
```

This will run the simulator to verify different parties and see how far they get. This will help make sure the game is playable with many different configurations of hero jobs. It will output a leaderboard as well as where each party gets stuck, if it does. A tick budget gives the party a certain amount of time to get to a certain place, and simulates a player playing for that length of time - 3600 ticks = 1 hour.

## Good-To-Knows
