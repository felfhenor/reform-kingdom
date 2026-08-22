/**
 * Validates that every content entry with a `sprite` field uses a sprite
 * index that's unique *within its own content type* (each type's atlas is
 * separate, so uniqueness is only meaningful scoped to one type). Tiered
 * variants of the same entry (e.g. "Fireball I"/"Fireball II") intentionally
 * share an icon and are excluded. Ported from `scripts/validate-sprites.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  ContentType,
  SpritedContentEntry,
} from '@interfaces';

// Matches the `AtlasedImage` union in `src/app/interfaces/artable.ts` - these
// are the content types that carry a `sprite` field.
const SPRITED_CONTENT_TYPES: ContentType[] = [
  'collectible',
  'equipment',
  'globaleffect',
  'item',
  'job',
  'monster',
  'skill',
];

// Strips a trailing roman-numeral tier suffix ("Fireball II" -> "Fireball")
// so tiered variants of the same entry can be recognized as one family.
const TIER_SUFFIX = /\s+(I{1,3}|IV|VI{0,3}|IX|X)$/;

function baseName(name: string): string {
  return name.replace(TIER_SUFFIX, '');
}

function checkContentType(type: ContentType): AnalysisCheck[] {
  const entries = getEntriesByType<SpritedContentEntry>(type);
  if (entries.length === 0) return [];

  const checks: AnalysisCheck[] = [];
  const owners = new Map<string, SpritedContentEntry>();

  entries.forEach((current) => {
    const sprite = current.sprite;
    if (sprite === undefined || sprite === null) {
      checks.push({
        id: `sprite:${type}:${current.id}`,
        label: current.name,
        status: 'fail',
        message: `[${type}] "${current.name}" (${current.id}) is missing a "sprite" field.`,
      });
      return;
    }

    const owner = owners.get(sprite);
    if (owner) {
      const currentFamily = baseName(current.name);
      const ownerFamily = baseName(owner.name);

      if (currentFamily && currentFamily === ownerFamily) {
        return;
      }

      checks.push({
        id: `sprite:${type}:${current.id}`,
        label: current.name,
        status: 'fail',
        message: `[${type}] "${current.name}" (${current.id}) uses sprite "${sprite}", already used by "${owner.name}" (${owner.id}). Sprite indices must be unique within "${type}" (except across tiers of the same entry).`,
      });
      return;
    }

    owners.set(sprite, current);
  });

  if (checks.length === 0) {
    checks.push({
      id: `sprite:${type}:ok`,
      label: type,
      status: 'pass',
      message: `"${type}": ${entries.length} entrie(s), ${owners.size} unique sprite(s).`,
    });
  }

  return checks;
}

export function runSpritesAnalysis(): AnalysisRunResult {
  const checks = SPRITED_CONTENT_TYPES.flatMap((type) => checkContentType(type));
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every content type uses unique sprite indices.'
        : `${failures} sprite problem(s) found.`,
  };
}
