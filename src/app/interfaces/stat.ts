export type BaseStat =
  | 'Damage'
  | 'Defense'
  | 'Health'
  | 'Regen'
  | 'Shield'
  | 'Evasion'
  | 'Lifesteal'
  | 'Thorns'
  | 'CritChance'
  | 'CritDamage'
  | 'AttackSpeed'
  | 'ProjectileCount'
  | 'ProjectileSpeed'
  | 'ProjectileBounces'
  | 'Duration'
  | 'Knockback'
  | 'MovementSpeed'
  | 'Luck'
  | 'Difficulty'
  | 'ExpGain'
  | 'GoldGain'
  | 'FavorGain';

export type SubStat = 'FreezeChance' | 'PoisonChance';

export type GameStat = BaseStat | SubStat;

export type StatBlock = Record<GameStat, number>;
