import { miscellaneousMessageLog } from '@helpers/combat/combat-log';

export function founderWhisperLog(text: string): void {
  miscellaneousMessageLog(`*The Founder whispers: "${text}"*`);
}
