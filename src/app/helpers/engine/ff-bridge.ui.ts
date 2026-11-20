import type {
  FFButtonFeedback,
  FFControllerFamily,
  FFControllerFamilyResolver,
} from '@ff/interfaces/ff-input';
import { playSFX } from '@helpers/engine/sfx';
import { steamInputType } from '@helpers/engine/steam';
import type { SFX } from '@interfaces';

export const ffButtonFeedbackSfx: FFButtonFeedback = {
  click: (sound, offset) => playSFX((sound || 'ui-click') as SFX, 1 + offset),
  hover: (offset) => playSFX('ui-hover', 1 + offset),
};

const STEAM_INPUT_FAMILIES: Record<string, FFControllerFamily> = {
  SteamController: 'steam-controller',
  SteamDeckController: 'steam-deck',
  XBox360Controller: 'xbox',
  XBoxOneController: 'xbox',
  GenericGamepad: 'xbox',
  PS3Controller: 'playstation',
  PS4Controller: 'playstation',
  PS5Controller: 'playstation',
  SwitchProController: 'switch',
  SwitchJoyConPair: 'switch',
  SwitchJoyConSingle: 'switch',
};

export const ffSteamControllerFamily: FFControllerFamilyResolver = async () => {
  const type = await steamInputType();
  return type ? STEAM_INPUT_FAMILIES[type] : undefined;
};
