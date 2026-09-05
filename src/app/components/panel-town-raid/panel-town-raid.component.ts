import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { modalCloseTop } from '@helpers/engine/modal-stack';
import { notifyError } from '@helpers/engine/notify';
import { raidEngageCombat } from '@helpers/town/raid/town-raid-combat';
import {
  raidAssaulterPreview,
  raidDefenderPreview,
  townRaidTelegraph,
} from '@helpers/town/raid/town-raid-state';
import type { TownContent, TownRaidCombatantRow } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-town-raid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasAnimationComponent,
    SlotCompletionRewardComponent,
    SlotIconBlankComponent,
    TippyDirective,
  ],
  templateUrl: './panel-town-raid.component.html',
  styleUrl: './panel-town-raid.component.scss',
})
export class PanelTownRaidComponent {
  public town = input.required<TownContent>();

  public raidTelegraph = computed(() => townRaidTelegraph(this.town().id));

  public raidCountdown = computed(() => {
    const telegraph = this.raidTelegraph();
    if (!telegraph) return undefined;

    return formatDuration(
      telegraph.engageWindowExpiresAtTick - timerTicksElapsed(),
    );
  });

  public raidRewards = computed(() => this.town().defense.rewards ?? []);

  public raidAssaulters = computed<TownRaidCombatantRow[]>(() =>
    raidAssaulterPreview(this.town()),
  );

  public raidDefenders = computed<TownRaidCombatantRow[]>(() =>
    raidDefenderPreview(this.town()),
  );

  public engageRaid(): void {
    const town = this.town();

    if (!raidEngageCombat(town.id)) {
      notifyError(`Could not engage the raid on ${town.name}.`);
      return;
    }

    modalCloseTop();
  }
}
