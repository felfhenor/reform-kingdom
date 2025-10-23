import { NgClass } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import type { BaseStat, Icon } from '@interfaces';

const icons: Record<BaseStat, Icon> = {
  Aura: 'gameVibratingShield',
  Force: 'gameGooeyImpact',
  Health: 'gameGlassHeart',
  Speed: 'gameClockwork',
};

const colors: Record<BaseStat, string> = {
  Aura: 'text-sky-500',
  Force: 'text-red-600',
  Health: 'text-amber-700',
  Speed: 'text-green-500',
};

@Component({
  selector: 'app-icon-stat',
  imports: [IconComponent, NgClass],
  templateUrl: './icon-stat.component.html',
  styleUrl: './icon-stat.component.scss',
})
export class IconStatComponent {
  public stat = input.required<BaseStat>();

  public icon = computed(() => icons[this.stat()]);
  public color = computed(() => `${colors[this.stat()]}`);
}
