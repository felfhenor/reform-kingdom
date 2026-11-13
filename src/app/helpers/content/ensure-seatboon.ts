import { ensureGlobalEffectEffect } from '@helpers/content/ensure-globaleffect';
import { ensureArray } from '@helpers/content/ensure-helpers-core';
import type { SeatBoonContent, SeatBoonId } from '@interfaces';

export function ensureSeatBoon(
  seatBoon: Partial<SeatBoonContent>,
): Required<SeatBoonContent> {
  return {
    id: seatBoon.id ?? ('UNKNOWN' as SeatBoonId),
    name: seatBoon.name ?? 'UNKNOWN',
    __type: 'seatboon',
    description: seatBoon.description ?? 'UNKNOWN',
    effects: ensureArray(seatBoon.effects, ensureGlobalEffectEffect),
  };
}
