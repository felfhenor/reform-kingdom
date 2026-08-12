import { Component, computed, input } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import type { BaseStat, Icon } from '@interfaces';

const icons: Record<BaseStat, Icon> = {
  Intelligence: 'gameBrain',
  Strength: 'gameGavel',
  Vitality: 'gameHeartBeats',
  Resistance: 'gameVibratingShield',
  Agility: 'gameDuration',
  Health: 'gameGlassHeart',
  Energy: 'gameDrop',
  Luck: 'gameClover',
};

const colors: Record<BaseStat, string> = {
  Intelligence: 'text-sky-400',
  Strength: 'text-red-500',
  Vitality: 'text-pink-400',
  Resistance: 'text-indigo-400',
  Agility: 'text-green-400',
  Health: 'text-rose-500',
  Energy: 'text-yellow-400',
  Luck: 'text-emerald-400',
};

@Component({
  selector: 'app-icon-stat',
  imports: [IconComponent],
  templateUrl: './icon-stat.component.html',
  styleUrl: './icon-stat.component.scss',
})
export class IconStatComponent {
  public stat = input.required<BaseStat>();

  public icon = computed(() => icons[this.stat()]);
  public color = computed(() => colors[this.stat()]);
}
