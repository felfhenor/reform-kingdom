import { defaultStats } from '@helpers/defaults';
import type {
  ContentType,
  HeroContent,
  HeroId,
  IsContentItem,
  ItemContent,
  ItemId,
  MonsterContent,
  MonsterId,
  PetContent,
  PetId,
  StageContent,
  StageId,
  StatBlock,
  TrinketContent,
  TrinketId,
  WeaponContent,
  WeaponId,
} from '@interfaces';

// eat my ass, typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initializers: Record<ContentType, (entry: any) => any> = {
  hero: ensureHero,
  item: ensureItem,
  monster: ensureMonster,
  pet: ensurePet,
  stage: ensureStage,
  trinket: ensureTrinket,
  weapon: ensureWeapon,
};

function ensureStats(statblock: Partial<StatBlock> = {}): Required<StatBlock> {
  return Object.assign({}, defaultStats(), statblock);
}

export function ensureContent<T extends IsContentItem>(content: T): T {
  return initializers[content.__type](content) satisfies T;
}

function ensureHero(hero: Partial<HeroContent>): Required<HeroContent> {
  return {
    id: hero.id ?? ('UNKNOWN' as HeroId),
    name: hero.name ?? 'UNKNOWN',
    description: hero.description ?? 'UNKNOWN',
    __type: 'hero',
    sprite: hero.sprite ?? 'UNKNOWN',
    frames: hero.frames ?? 4,
    baseStats: ensureStats(hero.baseStats),
    statsPerLevel: ensureStats(hero.statsPerLevel),
    startingWeaponIds: hero.startingWeaponIds ?? [],
  };
}

function ensureItem(item: Partial<ItemContent>): Required<ItemContent> {
  return {
    id: item.id ?? ('UNKNOWN' as ItemId),
    name: item.name ?? 'UNKNOWN',
    __type: 'item',
    description: item.description ?? 'UNKNOWN',
    sprite: item.sprite ?? 'UNKNOWN',
    baseStats: ensureStats(item.baseStats),
    statsPerLevel: ensureStats(item.statsPerLevel),
  };
}

function ensureMonster(
  monster: Partial<MonsterContent>,
): Required<MonsterContent> {
  return {
    id: monster.id ?? ('UNKNOWN' as MonsterId),
    name: monster.name ?? 'UNKNOWN',
    __type: 'monster',
    description: monster.description ?? 'UNKNOWN',
    sprite: monster.sprite ?? 'UNKNOWN',
    frames: monster.frames ?? 4,
    baseStats: ensureStats(monster.baseStats),
    statsPerLevel: ensureStats(monster.statsPerLevel),
  };
}

function ensurePet(pet: Partial<PetContent>): Required<PetContent> {
  return {
    id: pet.id ?? ('UNKNOWN' as PetId),
    name: pet.name ?? 'UNKNOWN',
    __type: 'pet',
    description: pet.description ?? 'UNKNOWN',
    sprite: pet.sprite ?? 'UNKNOWN',
    frames: pet.frames ?? 4,
    baseStats: ensureStats(pet.baseStats),
    statsPerLevel: ensureStats(pet.statsPerLevel),
    itemIds: pet.itemIds ?? [],
  };
}

function ensureStage(stage: Partial<StageContent>): Required<StageContent> {
  return {
    id: stage.id ?? ('UNKNOWN' as StageId),
    name: stage.name ?? 'UNKNOWN',
    __type: 'stage',
    description: stage.description ?? 'UNKNOWN',
  };
}

function ensureTrinket(
  trinket: Partial<TrinketContent>,
): Required<TrinketContent> {
  return {
    id: trinket.id ?? ('UNKNOWN' as TrinketId),
    name: trinket.name ?? 'UNKNOWN',
    __type: 'trinket',
    description: trinket.description ?? 'UNKNOWN',
    sprite: trinket.sprite ?? 'UNKNOWN',
    baseStats: ensureStats(trinket.baseStats),
    upgradeableStats: trinket.upgradeableStats ?? [],
  };
}

function ensureWeapon(weapon: Partial<WeaponContent>): Required<WeaponContent> {
  return {
    id: weapon.id ?? ('UNKNOWN' as WeaponId),
    name: weapon.name ?? 'UNKNOWN',
    __type: 'weapon',
    description: weapon.description ?? 'UNKNOWN',
    sprite: weapon.sprite ?? 'UNKNOWN',
    baseStats: ensureStats(weapon.baseStats),
    upgradeableStats: weapon.upgradeableStats ?? [],
  };
}
