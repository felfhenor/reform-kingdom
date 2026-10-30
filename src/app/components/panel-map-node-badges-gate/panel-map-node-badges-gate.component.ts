import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { museumCollectibleSourceLabel } from '@helpers/kingdom/museum.ui';
import { worldNodeGateProgress } from '@helpers/world-node/world-node-gate';
import { worldNodeGateMissingCollectibleEntries } from '@helpers/world-node/world-node-gate.ui';
import type { WorldNodeEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

// Keeps the tooltip from growing taller than the screen on a gate with dozens of requirements.
const MAX_TOOLTIP_ROWS = 5;

@Component({
  selector: 'app-panel-map-node-badges-gate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TippyDirective],
  templateUrl: './panel-map-node-badges-gate.component.html',
  styleUrl: './panel-map-node-badges-gate.component.scss',
})
export class PanelMapNodeBadgesGateComponent {
  public entry = input.required<WorldNodeEntry>();

  public progress = computed(() => worldNodeGateProgress(this.entry()));

  private missingEntries = computed(() =>
    worldNodeGateMissingCollectibleEntries(this.entry()),
  );

  public rows = computed(() =>
    this.missingEntries()
      .slice(0, MAX_TOOLTIP_ROWS)
      .map((entry) => ({
        entry,
        sourceLabel: museumCollectibleSourceLabel(entry),
      })),
  );

  public hiddenCount = computed(
    () => this.missingEntries().length - this.rows().length,
  );
}
