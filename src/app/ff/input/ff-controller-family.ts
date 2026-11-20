import type { FFControllerFamily } from '@ff/interfaces/ff-input';

const VENDOR_SONY = 0x054c;
const VENDOR_NINTENDO = 0x057e;
const VENDOR_VALVE = 0x28de;

const PRODUCT_STEAM_DECK = 0x1205;
const PRODUCT_STEAM_VIRTUAL_GAMEPAD = 0x11ff;
// Joy-Con 2 R/L, Pro Controller 2, NSO GameCube - unverified against real hardware.
const PRODUCTS_SWITCH2 = new Set([0x2066, 0x2067, 0x2069, 0x2073]);

// Chromium: "... (Vendor: 054c Product: 0ce6)", Firefox: "054c-0ce6-...".
const ID_PATTERNS = [
  /Vendor:\s*([0-9a-f]{4})\s*Product:\s*([0-9a-f]{4})/i,
  /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i,
];

const NAME_FAMILIES: Array<[RegExp, FFControllerFamily]> = [
  [/dualsense|dualshock|playstation/i, 'playstation'],
  [/nintendo|joy-con/i, 'switch'],
];

function ffVendorProduct(id: string): [number, number] | undefined {
  const match = ID_PATTERNS.map((pattern) => id.match(pattern)).find(Boolean);
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16)] : undefined;
}

function ffValveFamily(product: number): FFControllerFamily {
  if (product === PRODUCT_STEAM_DECK) return 'steam-deck';
  // Steam Input's virtual pad presents as an Xbox 360 controller.
  if (product === PRODUCT_STEAM_VIRTUAL_GAMEPAD) return 'xbox';
  return 'steam-controller';
}

function ffFamilyFromIds(
  vendor: number,
  product: number,
): FFControllerFamily | undefined {
  if (vendor === VENDOR_SONY) return 'playstation';
  if (vendor === VENDOR_NINTENDO) {
    return PRODUCTS_SWITCH2.has(product) ? 'switch2' : 'switch';
  }
  if (vendor === VENDOR_VALVE) return ffValveFamily(product);
  return undefined;
}

// XInput pads (and anything unrecognized) fall back to Xbox, matching the standard mapping's layout.
export function ffControllerFamily(id: string): FFControllerFamily {
  const ids = ffVendorProduct(id);
  const fromIds = ids ? ffFamilyFromIds(ids[0], ids[1]) : undefined;
  return (
    fromIds ??
    NAME_FAMILIES.find(([pattern]) => pattern.test(id))?.[1] ??
    'xbox'
  );
}
