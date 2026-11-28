import { TPipe } from '@pipes/t.pipe';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ModalComponent } from '@components/modal/modal.component';
import { PanelHeroCombatOrdersComponent } from '@components/panel-hero-combat-orders/panel-hero-combat-orders.component';
import {
  combatOrderClauseAdd,
  combatOrderClauses,
  combatOrderClauseRemove,
  combatOrderClauseReorder,
  combatOrderClauseSetEnabled,
  combatOrderClauseUpdate,
} from '@helpers/combat/combat-order.ui';
import { combatOrdersModalCharacterId } from '@helpers/engine/ui';
import { globalEffectSumsState, worldPartyState } from '@helpers/state-game';
import type {
  Character,
  CombatOrderAction,
  CombatOrderClause,
  CombatOrderClauseId,
  CombatOrderCondition,
} from '@interfaces';

@Component({
  selector: 'app-modal-hero-combat-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    BlankSlateComponent,
    ModalComponent,
    PanelHeroCombatOrdersComponent,
  ],
  templateUrl: './modal-hero-combat-orders.component.html',
})
export class ModalHeroCombatOrdersComponent {
  private panel = viewChild(PanelHeroCombatOrdersComponent);

  public isManualCombat = computed(() => globalEffectSumsState().manualCombat);
  public party = computed<Character[]>(() => worldPartyState());

  public character = computed<Character | undefined>(() =>
    this.party().find((c) => c.id === combatOrdersModalCharacterId()),
  );

  public clauses = computed<CombatOrderClause[]>(() => {
    const character = this.character();
    return character ? combatOrderClauses(character.id, character.jobId) : [];
  });

  public add(
    character: Character,
    event: { condition: CombatOrderCondition; action: CombatOrderAction },
  ): void {
    combatOrderClauseAdd(
      character.id,
      character.jobId,
      event.condition,
      event.action,
    );
  }

  public update(
    character: Character,
    event: {
      clauseId: CombatOrderClauseId;
      condition: CombatOrderCondition;
      action: CombatOrderAction;
    },
  ): void {
    combatOrderClauseUpdate(
      character.id,
      character.jobId,
      event.clauseId,
      event.condition,
      event.action,
    );
  }

  public remove(character: Character, clauseId: CombatOrderClauseId): void {
    combatOrderClauseRemove(character.id, character.jobId, clauseId);
  }

  public reorder(
    character: Character,
    event: { fromIndex: number; toIndex: number },
  ): void {
    combatOrderClauseReorder(
      character.id,
      character.jobId,
      event.fromIndex,
      event.toIndex,
    );
  }

  public toggleEnabled(
    character: Character,
    event: { clauseId: CombatOrderClauseId; enabled: boolean },
  ): void {
    combatOrderClauseSetEnabled(
      character.id,
      character.jobId,
      event.clauseId,
      event.enabled,
    );
  }

  public resetProps(): void {
    this.panel()?.cancelEditClause();
  }
}
