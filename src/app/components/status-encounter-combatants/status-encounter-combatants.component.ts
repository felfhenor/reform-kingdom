import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { CardStatusCombatantComponent } from '@components/card-status-combatant/card-status-combatant.component';
import { combatantStatusEffectPreviews } from '@helpers/combat/combat-statuseffects.ui';
import type { Combatant, StatusCardEntry } from '@interfaces';
import { AnimationService } from '@services/animation.service';
import { chunk } from 'es-toolkit/compat';

// Max cards per row - extras wrap onto a new row above.
const COMBATANTS_PER_ROW = 4;

@Component({
  selector: 'app-status-encounter-combatants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardStatusCombatantComponent],
  templateUrl: './status-encounter-combatants.component.html',
  styleUrl: './status-encounter-combatants.component.scss',
})
export class StatusEncounterCombatantsComponent {
  private anim = inject(AnimationService);

  public combatants = input.required<Combatant[]>();
  public expanded = input<boolean>(false);
  public slideIn = input<boolean>(false);

  public entries = computed<StatusCardEntry[]>(() =>
    this.combatants().map((combatant) => ({
      combatantId: combatant.id,
      name: combatant.name,
      spritesheet: 'monster',
      spriteAssetName: combatant.sprite ?? '',
      spriteFrames: combatant.frames,
      isDead: combatant.hp <= 0,
      bars: [
        {
          variant: 'hp',
          current: combatant.hp,
          max: Math.max(combatant.totalStats.Health, 1),
        },
      ],
      statusEffects: combatantStatusEffectPreviews(combatant),
    })),
  );

  // The template stacks rows in `column-reverse` so row 0 sits nearest the hero row, wrapping upward.
  public rows = computed(() => chunk(this.entries(), COMBATANTS_PER_ROW));

  // Transform is dropped afterwards so it doesn't leave a stacking context that hides neighbours' damage numbers.
  public onEnter(event: AnimationCallbackEvent): void {
    if (!this.slideIn()) return;

    this.anim
      .slideIn(event.target)
      .then(() =>
        (event.target as HTMLElement).style.removeProperty('transform'),
      );
  }
}
