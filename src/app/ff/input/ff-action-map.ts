import type {
  FFActionMap,
  FFControllerFamily,
  FFDirection,
  FFGamepadAction,
} from '@ff/interfaces/ff-input';

export const FF_DIRECTIONS: FFDirection[] = ['up', 'down', 'left', 'right'];

// W3C "standard" Gamepad mapping indices, by physical position.
export const FF_STANDARD_BUTTON = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

const B = FF_STANDARD_BUTTON;

const DEFAULT_ACTION_MAP: FFActionMap = {
  confirm: B.south,
  back: B.east,
  context: B.west,
  details: B.north,
  tabPrev: B.lb,
  tabNext: B.rb,
  subPrev: B.lt,
  subNext: B.rt,
  pause: B.select,
  menu: B.start,
  recenter: B.r3,
  up: B.up,
  down: B.down,
  left: B.left,
  right: B.right,
};

// Nintendo prints A/B and X/Y on the opposite face buttons; actions follow the label.
const NINTENDO_FACE: Partial<FFActionMap> = {
  confirm: B.east,
  back: B.south,
  context: B.north,
  details: B.west,
};

const FAMILY_OVERRIDES: Partial<
  Record<FFControllerFamily, Partial<FFActionMap>>
> = {
  switch: NINTENDO_FACE,
  switch2: NINTENDO_FACE,
};

export function ffActionMap(family: FFControllerFamily): FFActionMap {
  return { ...DEFAULT_ACTION_MAP, ...FAMILY_OVERRIDES[family] };
}

export function ffActionForButton(
  actionMap: FFActionMap,
  button: number,
): FFGamepadAction | undefined {
  return (Object.keys(actionMap) as FFGamepadAction[]).find(
    (action) => actionMap[action] === button,
  );
}
