import { Component, computed, input } from '@angular/core';
import { ALL_ICONS, ICON_SIZE_VALUES } from '@helpers/engine/icons';
import type { Icon, IconSize } from '@interfaces';
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
  public size = input<IconSize>('inline');
  public color = input<string>('');

  public icon = computed(() => {
    return ALL_ICONS[this.name()];
  });

  public resolvedSize = computed(() => ICON_SIZE_VALUES[this.size()]);

  maxHeight = hostBinding('style.height', this.resolvedSize);
}
