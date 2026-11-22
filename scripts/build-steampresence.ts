import { steamPresenceVdf } from '@helpers/engine/presence';
import fs from 'fs-extra';

const OUT_FILE = './tmp/steam/rich-presence.vdf';

// Upload under Steamworks > Community > Rich Presence (for each app ID) whenever the activity text changes.
fs.outputFileSync(OUT_FILE, steamPresenceVdf());
console.info(`Wrote ${OUT_FILE}`);
