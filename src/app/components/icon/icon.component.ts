import { Component, computed, input } from '@angular/core';
import { ALL_ICONS } from '@helpers/engine/icons';
import type { Icon } from '@interfaces';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { hostBinding } from 'ngxtension/host-binding';

@Component({
  selector: 'app-icon',
  imports: [NgIcon],
  providers: [provideIcons(ALL_ICONS)],
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
})
export class IconComponent {
  public name = input.required<Icon>();
  public size = input<string>('1em');
  public color = input<string>('');

  public icon = computed(() => {
    return ALL_ICONS[this.name()];
  });

  maxHeight = hostBinding(
    'style.height',
    computed(() => this.size()),
  );
}
