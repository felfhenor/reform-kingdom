import { describe, expect, it } from 'vitest';

import { demoteHero, promoteHero } from '@helpers/hero/position-swapping';
import { worldPartyState } from '@helpers/state-game';
import type { Character } from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { inTick, seedGamestate } from '@/testing/gamestate';

function seedParty(size: number): Character[] {
  const party = Array.from({ length: size }, () => buildCharacter());
  seedGamestate((state) => {
    state.world.party = party;
  });
  return party;
}

const partyIds = () => worldPartyState().map((character) => character.id);

describe('demoteHero', () => {
  it('swaps a hero with the one behind it', () => {
    const [a, b, c] = seedParty(3);
    inTick(() => demoteHero(a));
    expect(partyIds()).toEqual([b.id, a.id, c.id]);
  });

  it('leaves the last hero of a smaller party in place', () => {
    const [a, b] = seedParty(2);
    inTick(() => demoteHero(b));
    expect(partyIds()).toEqual([a.id, b.id]);
  });

  it('leaves a solo hero in place', () => {
    const [a] = seedParty(1);
    inTick(() => demoteHero(a));
    expect(partyIds()).toEqual([a.id]);
  });

  it('ignores a hero who is not in the party', () => {
    const [a, b] = seedParty(2);
    inTick(() => demoteHero(buildCharacter()));
    expect(partyIds()).toEqual([a.id, b.id]);
  });
});

describe('promoteHero', () => {
  it('swaps a hero with the one ahead of it', () => {
    const [a, b] = seedParty(2);
    inTick(() => promoteHero(b));
    expect(partyIds()).toEqual([b.id, a.id]);
  });

  it('leaves the leader in place', () => {
    const [a, b] = seedParty(2);
    inTick(() => promoteHero(a));
    expect(partyIds()).toEqual([a.id, b.id]);
  });
});
