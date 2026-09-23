import { updateGamestate } from '@helpers/state-game';
import type { Character } from '@interfaces/character';

export function promoteHero(character: Character) {
  updateGamestate((state) => {
    const myIdx = state.world.party.findIndex((c) => c.id === character.id);
    if (myIdx <= 0) return state;

    [state.world.party[myIdx], state.world.party[myIdx - 1]] = [
      state.world.party[myIdx - 1],
      state.world.party[myIdx],
    ];

    return state;
  });
}

export function demoteHero(character: Character) {
  updateGamestate((state) => {
    const myIdx = state.world.party.findIndex((c) => c.id === character.id);
    if (myIdx >= 3) return state;

    [state.world.party[myIdx + 1], state.world.party[myIdx]] = [
      state.world.party[myIdx],
      state.world.party[myIdx + 1],
    ];

    return state;
  });
}
