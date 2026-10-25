import type {
  CollectibleId,
  RumorContent,
  RumorId,
  RumorSubject,
  TrainerTeachingId,
} from '@interfaces';

// Unknown kinds fall back to a node that can't exist, so validation flags the typo.
export function ensureRumorSubject(
  subject: Record<string, unknown> = {},
): RumorSubject {
  const id = <T>(key: string) => (subject[key] ?? 'UNKNOWN') as T;

  switch (subject['kind']) {
    case 'Collectible':
      return {
        kind: 'Collectible',
        collectibleId: id<CollectibleId>('collectibleId'),
      };
    case 'TrainerTeaching':
      return {
        kind: 'TrainerTeaching',
        trainerTeachingId: id<TrainerTeachingId>('trainerTeachingId'),
      };
    default:
      return { kind: 'Node', nodeName: id<string>('nodeName') };
  }
}

export function ensureRumor(
  rumor: Partial<RumorContent>,
): Required<RumorContent> {
  return {
    id: rumor.id ?? ('UNKNOWN' as RumorId),
    name: rumor.name ?? 'UNKNOWN',
    __type: 'rumor',
    description: rumor.description ?? 'UNKNOWN',
    rarity: rumor.rarity ?? 'Common',
    subject: ensureRumorSubject(rumor.subject),
    requireMapVisit: rumor.requireMapVisit ?? '',
  };
}
