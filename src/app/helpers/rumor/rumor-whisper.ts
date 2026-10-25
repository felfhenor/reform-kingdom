import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { founderWhisperLog } from '@helpers/lore/founder-whisper';
import { rumorPickHearable } from '@helpers/rumor/rumor';

// Silent once every rumor's subject has been found.
export function rumorWhisper(): void {
  const rumor = rumorPickHearable();
  if (!rumor) return;

  founderWhisperLog(rumor.description);
  analyticsSendDesignEvent(`Rumor:Whisper:${analyticsSafeSegment(rumor.name)}`);
}
