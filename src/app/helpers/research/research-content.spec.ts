import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(() => []),
  getEntry: vi.fn(),
}));

import { getEntriesByType, getEntry } from '@helpers/content';
import {
  researchEntries,
  researchPointItemId,
} from '@helpers/research/research-content';
import type { ItemContent, ItemId, ResearchContent } from '@interfaces';

describe('research-content Helper Functions', () => {
  describe('researchPointItemId', () => {
    it("resolves 'Insight Crystal' by name via getEntry", () => {
      const insightCrystals = {
        id: 'insight-crystals-id' as ItemId,
      } as ItemContent;
      vi.mocked(getEntry).mockReturnValue(insightCrystals as never);

      expect(researchPointItemId()).toBe('insight-crystals-id');
      expect(getEntry).toHaveBeenCalledWith('Insight Crystal');
    });
  });

  describe('researchEntries', () => {
    it("delegates to getEntriesByType('research')", () => {
      const entries = [{ id: 'r1' }] as ResearchContent[];
      vi.mocked(getEntriesByType).mockReturnValue(entries);

      expect(researchEntries()).toBe(entries);
      expect(getEntriesByType).toHaveBeenCalledWith('research');
    });
  });
});
