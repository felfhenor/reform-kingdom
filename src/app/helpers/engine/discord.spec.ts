import type {
  CaravanId,
  CaravanTraderContent,
  CaravanTraderId,
  Character,
  Combat,
  CombatId,
  GameState,
  JobContent,
  JobId,
  WorldNodeEntry,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat', () => ({
  currentCombat: vi.fn(() => undefined),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  worldNodeAtCurrentLocation: vi.fn(() => undefined),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeCaravan: vi.fn(() => undefined),
}));

vi.mock('@helpers/caravan/caravan', () => ({
  caravanState: vi.fn(() => undefined),
  caravanBrandName: vi.fn((name: string) => name.split(' - ')[0]),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(() => undefined),
}));

vi.mock('@helpers/hero/party', () => ({
  partyGet: vi.fn(() => []),
}));

import { caravanBrandName, caravanState } from '@helpers/caravan/caravan';
import { currentCombat } from '@helpers/combat/combat';
import { getEntry } from '@helpers/content';
import {
  discordSetMainStatus,
  discordUpdateStatus,
  isInElectron,
} from '@helpers/engine/discord';
import { partyGet } from '@helpers/hero/party';
import { gamestate } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';

function mockElectron(isElectron: boolean): void {
  Object.defineProperty(navigator, 'userAgent', {
    value: isElectron ? 'Mozilla/5.0 electron/30.0.0' : 'Mozilla/5.0',
    configurable: true,
  });
}

function mockGamestate(
  travel: Partial<GameState['world']['travel']> = {},
  gathering: Partial<GameState['world']['gathering']> = {},
): void {
  vi.mocked(gamestate).mockReturnValue({
    world: {
      travel: { status: 'Idle', path: [], ticksIntoStep: 0, ...travel },
      gathering: { status: 'Idle', ticksIntoGather: 0, ...gathering },
    },
  } as unknown as GameState);
}

function buildCombat(overrides: Partial<Combat> = {}): Combat {
  return {
    id: 'combat-1' as CombatId,
    locationName: 'Field Ruins',
    locationPosition: { x: 0, y: 0 },
    rounds: 0,
    heroes: [],
    guardians: [],
    ...overrides,
  } as Combat;
}

function buildNode(type: string, nodeName: string): WorldNodeEntry {
  return {
    mapName: 'map-1',
    x: 0,
    y: 0,
    nodeName,
    nodeData: {
      id: 1,
      name: nodeName,
      type,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      visible: true,
    },
  };
}

function buildCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'Hero',
    level: 1,
    xp: { current: 0, maximum: 100 },
    jobId: 'job-1' as JobId,
    jobProgress: {},
    combatOrders: {},
    hp: 50,
    ep: 20,
    stats: {} as Character['stats'],
    equipment: {} as Character['equipment'],
    traitIds: [],
    ...overrides,
  } as Character;
}

function currentState(): { state?: string; details?: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).discordRPCStatus ?? {};
}

describe('discord status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discordSetMainStatus('');
    mockElectron(true);
    vi.mocked(currentCombat).mockReturnValue(undefined);
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(undefined);
    vi.mocked(worldNodeCaravan).mockReturnValue(undefined);
    vi.mocked(caravanState).mockReturnValue(undefined);
    vi.mocked(partyGet).mockReturnValue([]);
    mockGamestate();
  });

  describe('isInElectron', () => {
    it('is true when the user agent contains electron/', () => {
      mockElectron(true);
      expect(isInElectron()).toBe(true);
    });

    it('is false otherwise', () => {
      mockElectron(false);
      expect(isInElectron()).toBe(false);
    });
  });

  describe('discordUpdateStatus', () => {
    it('does nothing outside electron', () => {
      mockElectron(false);
      vi.mocked(currentCombat).mockReturnValue(buildCombat());

      discordUpdateStatus();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((window as any).discordRPCStatus).toBeUndefined();
    });

    it('shows Exploring when in combat, regardless of other state', () => {
      vi.mocked(currentCombat).mockReturnValue(
        buildCombat({ locationName: 'Whispering Woods' }),
      );
      mockGamestate({ status: 'Traveling', destinationNodeName: 'Elsewhere' });

      discordUpdateStatus();

      expect(currentState().state).toBe('Exploring Whispering Woods');
    });

    it('shows Traveling to the destination while traveling', () => {
      mockGamestate({ status: 'Traveling', destinationNodeName: 'Carrina' });

      discordUpdateStatus();

      expect(currentState().state).toBe('Traveling to Carrina');
    });

    it('shows Gathering while gathering', () => {
      mockGamestate({}, { status: 'Gathering', nodeName: 'Iron Vein' });

      discordUpdateStatus();

      expect(currentState().state).toBe('Gathering in Iron Vein');
    });

    it('shows Trading with the assigned trader at an idle CaravanNode', () => {
      const node = buildNode('CaravanNode', 'Goblin Group Company - Carrina');
      vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(node);
      vi.mocked(worldNodeCaravan).mockReturnValue({
        id: 'caravan-1' as CaravanId,
      } as never);
      vi.mocked(caravanState).mockReturnValue({
        traderId: 'trader-1' as CaravanTraderId,
        activeTradeIndices: [],
        tradeCounts: {},
        generatedAtTick: 0,
      });
      vi.mocked(getEntry).mockReturnValue({
        name: 'Grix the Merchant',
      } as CaravanTraderContent);

      discordUpdateStatus();

      expect(currentState().state).toBe('Trading with Grix the Merchant');
    });

    it('shows Resting at the brand name for a CaravanNode with no trader', () => {
      const node = buildNode('CaravanNode', 'Goblin Group Company - Carrina');
      vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(node);
      vi.mocked(worldNodeCaravan).mockReturnValue({
        id: 'caravan-1' as CaravanId,
      } as never);
      vi.mocked(caravanState).mockReturnValue(undefined);

      discordUpdateStatus();

      expect(currentState().state).toBe('Resting at Goblin Group Company');
      expect(caravanBrandName).toHaveBeenCalledWith(
        'Goblin Group Company - Carrina',
      );
    });

    it('shows Resting at a non-caravan node', () => {
      vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(
        buildNode('Kingdom', 'Duchy of Carrina'),
      );

      discordUpdateStatus();

      expect(currentState().state).toBe('Resting at Duchy of Carrina');
    });

    it('shows Traveling when idle with no node underfoot', () => {
      vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(undefined);

      discordUpdateStatus();

      expect(currentState().state).toBe('Traveling');
    });

    it('sets the party roster as the persistent details line', () => {
      vi.mocked(partyGet).mockReturnValue([
        buildCharacter({ jobId: 'warrior' as JobId, level: 5 }),
        buildCharacter({ jobId: 'magician' as JobId, level: 3 }),
      ]);
      vi.mocked(getEntry).mockImplementation((id) => {
        const names: Record<string, string> = {
          warrior: 'Warrior',
          magician: 'Magician',
        };
        return { name: names[id as string] } as JobContent;
      });

      discordUpdateStatus();

      expect(currentState().details).toBe('Warrior Lv5, Magician Lv3');
    });
  });
});
