import type { Signal } from '@angular/core';
import type { OptionsTab } from '@interfaces/state-options';

export type OptionsTabLink = {
  name: string;
  link: OptionsTab;
  showIf: Signal<boolean>;
};
