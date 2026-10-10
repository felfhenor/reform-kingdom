import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ButtonGlowComponent } from '@components/button-glow/button-glow.component';
import { IconComponent } from '@components/icon/icon.component';
import type { GameElement } from '@interfaces';
import { GameElementIcon } from '@interfaces';

@Component({
  selector: 'app-icon-element-charge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonGlowComponent, IconComponent],
  template: `
    <span
      class="flex items-center justify-center rounded-full border-2 leading-none"
      [class]="classes()"
      appButtonGlow
      [buttonGlowActive]="canGlow() && filled()"
    >
      <app-icon [name]="icon()" [size]="size() === 'sm' ? 'badge' : 'row'" />
    </span>
  `,
})
export class IconElementChargeComponent {
  public element = input.required<GameElement>();
  public filled = input<boolean>(false);
  public canGlow = input<boolean>(false);
  public size = input<'sm' | 'md'>('md');

  public icon = computed(() => GameElementIcon[this.element()]);

  public classes = computed(() => {
    const element = this.element();
    const fill = this.filled() ? `opacity-100` : `opacity-50`;
    const size = this.size() === 'sm' ? 'size-5' : 'size-7';
    return `border-element-${element} bg-element-${element} text-white ${fill} ${size}`;
  });
}
