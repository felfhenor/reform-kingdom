export type DurationUnit = 'day' | 'hour' | 'minute' | 'second';

export type DurationPart = {
  value: number;
  unit: DurationUnit;
};
