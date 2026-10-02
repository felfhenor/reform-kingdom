import '@/testing/reset';
import { setAllContentById, setAllIdsByName } from '@helpers/content/content';
import type { IsContentItem } from '@interfaces';

// Replaces the whole registry, so pass every entry the test needs.
export function seedContent(entries: IsContentItem[]): void {
  setAllContentById(new Map(entries.map((entry) => [entry.id, entry])));
  setAllIdsByName(new Map(entries.map((entry) => [entry.name, entry.id])));
}
