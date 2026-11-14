import { ensureRegion } from '@helpers/content/ensure-region';
import { demoRegionsAllSealed, teleportIsDemoLocked } from '@helpers/demo/demo';
import type { RegionId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';
import { describe, expect, it } from 'vitest';

const carrinaId = 'carrina' as RegionId;
const mireId = 'mire' as RegionId;

function seedSeals(sealed: RegionId[]): void {
  seedContent([
    ensureRegion({ id: carrinaId, name: 'Carrina' }),
    ensureRegion({ id: mireId, name: 'Craggled Mire' }),
  ]);
  seedGamestate((state) =>
    sealed.forEach((id) => (state.runStats.seals[id] = 10)),
  );
}

describe('teleportIsDemoLocked', () => {
  it('locks a teleport whose arrival does not exist', () => {
    const nodes = seedWorldNodes([
      {
        name: 'To Larsia',
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'Larsia' }],
      },
    ]);

    expect(teleportIsDemoLocked(nodes['To Larsia'])).toBe(true);
  });

  it('leaves a teleport with an arrival unlocked', () => {
    const nodes = seedWorldNodes([
      {
        name: 'To Mire',
        type: 'TeleportNode',
        properties: [{ name: 'toTag', type: 'string', value: 'Mire' }],
      },
      {
        name: 'From Carrina',
        type: 'TeleportNode',
        mapName: 'CraggledMire',
        properties: [{ name: 'tag', type: 'string', value: 'Mire' }],
      },
    ]);

    expect(teleportIsDemoLocked(nodes['To Mire'])).toBe(false);
  });

  it('never locks other node types', () => {
    const nodes = seedWorldNodes([{ name: 'Mine', type: 'GatherNode' }]);

    expect(teleportIsDemoLocked(nodes['Mine'])).toBe(false);
  });
});

describe('demoRegionsAllSealed', () => {
  it('needs every shipped region sealed', () => {
    seedSeals([carrinaId]);
    expect(demoRegionsAllSealed()).toBe(false);

    seedSeals([carrinaId, mireId]);
    expect(demoRegionsAllSealed()).toBe(true);
  });
});
