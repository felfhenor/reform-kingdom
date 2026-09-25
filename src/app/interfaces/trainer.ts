// Checked in this order, so a row reports its first unmet requirement.
export type TrainerTeachingAvailability =
  | 'Learned'
  | 'WrongJob'
  | 'LevelTooLow'
  | 'MissingPrerequisites'
  | 'MissingCollectibles'
  | 'Available';
