import type { CollectibleGateContent, CollectibleGateId } from '@interfaces';

export function ensureCollectibleGate(
  gate: Partial<CollectibleGateContent>,
): Required<CollectibleGateContent> {
  return {
    id: gate.id ?? ('UNKNOWN' as CollectibleGateId),
    name: gate.name ?? 'UNKNOWN',
    __type: 'collectiblegate',
    description: gate.description ?? 'UNKNOWN',
    hidden: gate.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      gate.invisibleUntilCollectibleIdsFound ?? [],
    requiredCollectibleIds: gate.requiredCollectibleIds ?? [],
  };
}
