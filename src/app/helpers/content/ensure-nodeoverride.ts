import { ensureNodeBackground } from '@helpers/content/ensure-helpers-core';
import type { NodeOverrideContent, NodeOverrideId } from '@interfaces';

export function ensureNodeOverride(
  override: Partial<NodeOverrideContent>,
): Required<NodeOverrideContent> {
  return {
    id: override.id ?? ('UNKNOWN' as NodeOverrideId),
    name: override.name ?? 'UNKNOWN',
    __type: 'nodeoverride',
    description: override.description ?? 'UNKNOWN',
    hidden: override.hidden ?? false,
    ...ensureNodeBackground(override),
    invisibleUntilCollectibleIdsFound:
      override.invisibleUntilCollectibleIdsFound ?? [],
  };
}
