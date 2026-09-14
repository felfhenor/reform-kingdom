import type { Signal } from '@angular/core';
import type { OptionsTab } from '@interfaces/state-options';

export type OptionsTabLink = {
  name: 'UI' | 'Accessibility' | 'Savefile' | 'Misc' | 'Debug';
  link: OptionsTab;
  showIf: Signal<boolean>;
};
