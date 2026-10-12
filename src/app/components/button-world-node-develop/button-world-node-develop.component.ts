import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { SFXDirective } from '@directives/sfx.directive';
import { formatDuration } from '@helpers/engine/timer';
import { isPartyAtNode } from '@helpers/world';
import { worldNodeCanAffordCost } from '@helpers/world-node/world-node-cost';
import {
  worldNodeDevelopmentIsMaxLevel,
  worldNodeDevelopmentLevelUpCost,
  worldNodeDevelopmentTime,
} from '@helpers/world-node/world-node-development';
import {
  worldNodeDevelopable,
  worldNodeDevelopmentLevel,
  worldNodeDevelopmentTimerText,
} from '@helpers/world-node/world-node-development-state';
import { worldNodeDevelopStart } from '@helpers/world-node/world-node-development.ui';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-button-world-node-develop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective, RowCurrencyCostComponent],
  templateUrl: './button-world-node-develop.component.html',
  styleUrl: './button-world-node-develop.component.scss',
})
export class ButtonWorldNodeDevelopComponent {
  public entry = input.required<WorldNodeEntry>();
  public subject = input('location');

  private content = computed(() => worldNodeDevelopable(this.entry().nodeName));

  private level = computed(() =>
    worldNodeDevelopmentLevel(this.entry().nodeName),
  );

  public isMaxLevel = computed(() => {
    const content = this.content();
    return !content || worldNodeDevelopmentIsMaxLevel(content, this.level());
  });

  public cost = computed(() => {
    const content = this.content();
    return content
      ? worldNodeDevelopmentLevelUpCost(content, this.level())
      : [];
  });

  public developTimeText = computed(() => {
    const content = this.content();
    return formatDuration(
      content ? worldNodeDevelopmentTime(content, this.level()) : 0,
    );
  });

  public remainingText = computed(() =>
    worldNodeDevelopmentTimerText(this.entry().nodeName),
  );

  public canDevelop = computed(
    () =>
      !this.isMaxLevel() &&
      this.remainingText() === undefined &&
      isPartyAtNode(this.entry().nodeName) &&
      worldNodeCanAffordCost(this.cost()),
  );

  public develop(): void {
    void worldNodeDevelopStart(this.entry().nodeName);
  }
}
