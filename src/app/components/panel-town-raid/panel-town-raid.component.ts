import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { RowRaidCombatantsComponent } from '@components/row-raid-combatants/row-raid-combatants.component';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SFXDirective } from '@directives/sfx.directive';
import { notifyError } from '@helpers/engine/notify';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { setGamePlayView } from '@helpers/engine/ui';
import {
  raidBuyoff,
  raidBuyoffOptions,
} from '@helpers/town/raid/town-raid-buyoff.ui';
import { raidEngageCombat } from '@helpers/town/raid/town-raid-combat';
import {
  raidAssaulterPreview,
  raidDefenderPreview,
  townRaidTelegraph,
} from '@helpers/town/raid/town-raid-state';
import { townCraftDebuffExpiresAtTick } from '@helpers/town/raid/town-raid-state.ui';
import type {
  TownContent,
  TownRaidBuyoffKind,
  TownRaidBuyoffOption,
  TownRaidCombatantRow,
} from '@interfaces';

@Component({
  selector: 'app-panel-town-raid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RowRaidCombatantsComponent,
    BlankSlateComponent,
    SlotCompletionRewardComponent,
    SFXDirective,
    RowCurrencyCostComponent,
  ],
  host: { class: 'card shadow-sm' },
  templateUrl: './panel-town-raid.component.html',
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

  public craftDebuffRemaining = computed(() => {
    const expiresAtTick = townCraftDebuffExpiresAtTick(this.town().id);
    if (expiresAtTick === undefined) return undefined;

    return formatDuration(expiresAtTick - timerTicksElapsed());
  });

  public raidRewards = computed(() => this.town().defense.rewards ?? []);

  public raidAssaulters = computed<TownRaidCombatantRow[]>(() =>
    raidAssaulterPreview(this.town()),
  );

  public raidDefenders = computed<TownRaidCombatantRow[]>(() =>
    raidDefenderPreview(this.town()),
  );

  public buyoffOptions = computed<TownRaidBuyoffOption[]>(() =>
    raidBuyoffOptions(this.town()),
  );

  public isBuyoffPending = signal(false);

  public async buyoff(kind: TownRaidBuyoffKind): Promise<void> {
    const town = this.town();

    this.isBuyoffPending.set(true);
    try {
      if (!(await raidBuyoff(town.id, kind))) {
        notifyError(`Could not mitigate the raid on ${town.name}.`);
      }
    } finally {
      this.isBuyoffPending.set(false);
    }
  }

  public engageRaid(): void {
    const town = this.town();

    if (!raidEngageCombat(town.id)) {
      notifyError(`Could not engage the raid on ${town.name}.`);
      return;
    }

    // Combat plays out on the World view, not here - switch back to it so the player sees the fight.
    setGamePlayView('world');
  }
}
