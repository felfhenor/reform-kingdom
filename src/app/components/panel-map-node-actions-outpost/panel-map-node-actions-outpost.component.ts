import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ButtonWorldNodeDevelopComponent } from '@components/button-world-node-develop/button-world-node-develop.component';
import { SFXDirective } from '@directives/sfx.directive';
import {
  OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL,
  OUTPOST_TELEPORT_LEVEL,
} from '@helpers/config';
import { canSetHomeNode, homeNodeGet } from '@helpers/town/town-spawn';
import { isPartyAtNode } from '@helpers/world';
import {
  isOutpostBuilt,
  isOutpostTeleportUnlocked,
  outpostDeathPenaltyMultiplier,
  worldNodeOutpostLevel,
} from '@helpers/world-node/world-node-outpost';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-actions-outpost',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, SFXDirective, ButtonWorldNodeDevelopComponent],
  templateUrl: './panel-map-node-actions-outpost.component.html',
  styleUrl: './panel-map-node-actions-outpost.component.scss',
})
export class PanelMapNodeActionsOutpostComponent {
  public entry = input.required<WorldNodeEntry>();

  public setHome = output<void>();
  public teleport = output<void>();

  private level = computed(() => worldNodeOutpostLevel(this.entry().nodeName));

  public isBuilt = computed(() => isOutpostBuilt(this.entry().nodeName));

  public isTeleportUnlocked = computed(() =>
    isOutpostTeleportUnlocked(this.entry().nodeName),
  );

  public nextLevelUnlocksTeleport = computed(
    () => this.level() === OUTPOST_TELEPORT_LEVEL - 1,
  );

  public teleportLevel = OUTPOST_TELEPORT_LEVEL;

  public canOpenTeleport = computed(() => isPartyAtNode(this.entry().nodeName));

  public isHome = computed(
    () => homeNodeGet()?.nodeName === this.entry().nodeName,
  );

  public canSetHome = computed(
    () => !this.isHome() && canSetHomeNode(this.entry()),
  );

  public reductionPercent = computed(
    () => (1 - outpostDeathPenaltyMultiplier(this.entry().nodeName)) * 100,
  );

  public reductionPerLevelPercent =
    OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL * 100;
}
