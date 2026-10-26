import type { EncounterContent } from '@interfaces';
import type { TrailerContext } from './types';

// Covers the whole chained encounter (each win starts the next fight), not just one fight.
const ENCOUNTER_MAX_MS = 60_000;

// A loss also ends combat, by recalling the party away, which shouldn't pass as a good take.
export async function shotFightToEnd(
  t: TrailerContext,
  nodeName: string,
): Promise<void> {
  await t.evaluate((api, name) => {
    const encounterId = api.getEntry<EncounterContent>(name)?.id;
    if (!encounterId) throw new Error(`No encounter named "${name}".`);
    api.encounterStartFight(encounterId, 0, name);
  }, nodeName);
  t.log('fight start');

  await t.until((api) => !api.worldCombatState(), undefined, ENCOUNTER_MAX_MS);

  const won = await t.evaluate(
    (api, name) => api.isPartyAtNode(name),
    nodeName,
  );
  if (!won) throw new Error(`The party lost at ${nodeName}; re-take.`);
  t.log('fight end');
}

// Parks an idle party at `nodeName` with tutorials and its region card dismissed, so shots start clean.
export async function shotWorldPrepare(
  t: TrailerContext,
  nodeName: string,
): Promise<void> {
  await t.evaluate((api) => api.autoModeToggle(false));

  const inCombat = await t.evaluate((api) => !!api.worldCombatState());
  if (inCombat) {
    throw new Error(
      'Savefile.rek is mid-combat. Re-export it while the party is idle.',
    );
  }

  // A fresh profile would otherwise dim views with tutorial popups mid-shot.
  await t.evaluate(async (api) => {
    await api.tutorialSkip();
    for (const tutorial of api.TUTORIAL_CATALOG) {
      await api.tutorialMarkSeen(tutorial.id);
    }
  });

  await t.teleport(nodeName);
  await t.evaluate((api) =>
    api.regionIntroMarkSeen(api.worldCurrentLocationState().mapName),
  );
  await t.page.waitForSelector('app-card-region-intro', { state: 'hidden' });
}
