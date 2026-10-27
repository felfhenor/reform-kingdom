# Capsule art

Renders Steam capsule images from existing game art:

- background: a world map rendered from its own tiles, centered on an explore node
- party and whirl: raw sprites from `gameassets/` (frame 0)
- title: Geist Pixel from `public/font/`

## Requirements

- `npx playwright install chromium`
- `npm run gamedata:build`, which creates `public/json`

## Usage

`npm run capsule -- <preset|all> [--seed N] [--no-title] [--hold]`

- `<preset>` renders one preset to `output/<preset>.png`. `all` renders every preset.
- `--seed N` overrides the preset's seed, which controls gear order and tilt. Output is `<preset>-seedN.png`.
- `--no-title` omits the title.
- `--hold` renders in a visible browser and keeps it open until Enter is pressed.

## Presets

Presets are in `presets.ts`.

- `map.focus`: the explore node at the center. `map.scale` must be large enough that the crop stays within the map.
- `whirl.gear`: equipment to use, selected by name, name fragment, level range or type.
- `whirl.rings`: each ring's `radius`, item count (`items`) and `tilt`. `tilt[0]` tips the ring toward the camera; `tilt[1]` rolls it sideways.
- `whirl.cameraTilt`: the camera's angle above the whirl.
- `whirl.tumble`: maximum rotation of an item off its ring, in degrees.
- `whirl.clearRadius`: radius around the focus node with no gear.
- `title.pixelSize`: screen pixels per Geist Pixel square.
- `party.layout`: `line` places heroes along the bottom with monsters flanking them; `versus` places heroes on the left and monsters on the right.
