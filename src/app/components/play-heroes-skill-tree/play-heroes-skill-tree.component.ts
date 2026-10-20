import { DecimalPipe, formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { PanelHeroesSkillTreeDetailComponent } from '@components/panel-heroes-skill-tree-detail/panel-heroes-skill-tree-detail.component';
import { PanelHeroesSkillTreeGridComponent } from '@components/panel-heroes-skill-tree-grid/panel-heroes-skill-tree-grid.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { TabsHeroComponent } from '@components/tabs-hero/tabs-hero.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import {
  heroesSelectCharacter,
  heroesSelectedCharacterId,
  heroesSubviewClear,
  navigationGuarded,
  navigationLeaveGuard,
} from '@helpers/engine/ui';
import {
  characterSkillTreeAvailableSp,
  characterSkillTreeNodeIds,
} from '@helpers/hero/skill-tree';
import { skillTreeResetPromptText } from '@helpers/hero/skill-tree-layout.ui';
import {
  characterSkillTreeNodeStates,
  characterSkillTreeStagedWithout,
  skillTreeConfirm,
  skillTreeReset,
} from '@helpers/hero/skill-tree.ui';
import { getMaterialQuantity, memoryFluxId } from '@helpers/item/materials';
import { worldPartyState } from '@helpers/state-game';
import type {
  CharacterId,
  CostItem,
  JobContent,
  SkillTreeNodeContent,
  SkillTreeNodeId,
} from '@interfaces';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-play-heroes-skill-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    DecimalPipe,
    ButtonKingdomBackComponent,
    CardPageComponent,
    PanelHeroesSkillTreeDetailComponent,
    PanelHeroesSkillTreeGridComponent,
    RowCurrencyCostComponent,
    SFXDirective,
    SlotButtonContainerComponent,
    SweetAlert2Module,
    TabsHeroComponent,
  ],
  templateUrl: './play-heroes-skill-tree.component.html',
})
export class PlayHeroesSkillTreeComponent {
  private locale = inject(LOCALE_ID);
  private leaveSwal = viewChild<SwalComponent>('leaveSwal');
  private resetSwal = viewChild<SwalComponent>('resetSwal');

  public party = computed(() => worldPartyState());
  public character = computed(
    () =>
      this.party().find((c) => c.id === heroesSelectedCharacterId()) ??
      this.party()[0],
  );
  public job = computed(() => {
    const character = this.character();
    return character ? getEntry<JobContent>(character.jobId) : undefined;
  });

  // Keyed to the hero and job they were staged for, so they can never carry over to another tree.
  private stagedFor = signal<{ key: string; nodeIds: SkillTreeNodeId[] }>({
    key: '',
    nodeIds: [],
  });
  private treeKey = computed(() => {
    const character = this.character();
    return character ? `${character.id}:${character.jobId}` : '';
  });
  public staged = computed(() => {
    const staged = this.stagedFor();
    return staged.key === this.treeKey() ? staged.nodeIds : [];
  });
  public selectedNodeId = signal<SkillTreeNodeId | undefined>(undefined);

  public states = computed(() => {
    const character = this.character();
    return character
      ? characterSkillTreeNodeStates(character, this.staged())
      : new Map();
  });

  public freeSp = computed(() => {
    const character = this.character();
    return character
      ? characterSkillTreeAvailableSp(character, character.jobId) -
          this.staged().length
      : 0;
  });

  public selectedNode = computed(() => {
    const id = this.selectedNodeId();
    return id ? getEntry<SkillTreeNodeContent>(id) : undefined;
  });

  public resetCost = computed((): CostItem[] => {
    const fluxId = memoryFluxId();
    return fluxId ? [{ itemId: fluxId, required: 1 }] : [];
  });

  public fluxOwned = computed(() => {
    const fluxId = memoryFluxId();
    return fluxId ? getMaterialQuantity(fluxId) : 0;
  });

  public hasLearned = computed(() => {
    const character = this.character();
    return (
      !!character &&
      characterSkillTreeNodeIds(character, character.jobId).length > 0
    );
  });

  constructor() {
    effect(() =>
      navigationLeaveGuard.set(
        this.staged().length > 0
          ? (proceed) => void this.askBeforeLeaving(proceed)
          : undefined,
      ),
    );
    inject(DestroyRef).onDestroy(() => navigationLeaveGuard.set(undefined));
  }

  public readonly back = () => navigationGuarded(heroesSubviewClear);

  public selectHero(characterId: CharacterId): void {
    navigationGuarded(() => {
      heroesSelectCharacter(characterId);
      this.discard();
    });
  }

  public selectNode(id: SkillTreeNodeId): void {
    this.selectedNodeId.set(id);
  }

  private setStaged(nodeIds: SkillTreeNodeId[]): void {
    this.stagedFor.set({ key: this.treeKey(), nodeIds });
  }

  public learn(id: SkillTreeNodeId): void {
    this.setStaged([...this.staged(), id]);
  }

  public learnIfAvailable(id: SkillTreeNodeId): void {
    if (this.states().get(id) !== 'available') return;
    this.learn(id);
  }

  public unlearn(id: SkillTreeNodeId): void {
    const character = this.character();
    if (!character) return;

    this.setStaged(
      characterSkillTreeStagedWithout(character, this.staged(), id),
    );
  }

  public discard(): void {
    this.setStaged([]);
    this.selectedNodeId.set(undefined);
  }

  // Keeps the staged picks if the save is refused; anything staged mid-save stays staged.
  public async confirm(): Promise<boolean> {
    const character = this.character();
    const staged = this.staged();
    if (!character || staged.length === 0) return true;

    const learned = characterSkillTreeNodeIds(character, character.jobId);
    const saved = await skillTreeConfirm(character.id, [...learned, ...staged]);
    if (saved)
      this.setStaged(this.staged().filter((id) => !staged.includes(id)));
    return saved;
  }

  // Unconfirmed picks are named in the reset prompt itself rather than a separate leave prompt.
  public async requestReset(): Promise<void> {
    const character = this.character();
    const job = this.job();
    const swal = this.resetSwal();
    if (!character || !job || !swal) return;

    const pending = this.staged().length;
    const discardNote =
      pending > 0
        ? ` Your ${formatNumber(pending, this.locale)} unconfirmed change${pending === 1 ? '' : 's'} will be discarded.`
        : '';
    swal.swalOptions = {
      title: `Reset ${character.name}'s ${job.name} skill tree?`,
      text:
        skillTreeResetPromptText(character, job, this.fluxOwned(), (n) =>
          formatNumber(n, this.locale),
        ) + discardNote,
    };
    const result = await swal.fire();
    if (!result.isConfirmed) return;

    this.discard();
    await skillTreeReset(character.id);
  }

  private async askBeforeLeaving(proceed: () => void): Promise<void> {
    const character = this.character();
    const swal = this.leaveSwal();
    if (!character || !swal) return;

    const count = this.staged().length;
    swal.swalOptions = {
      text: `${character.name} has ${formatNumber(count, this.locale)} skill tree change${count === 1 ? '' : 's'} you haven't confirmed. If you leave now, they'll be discarded.`,
    };
    const result = await swal.fire();
    if (result.isDenied) this.discard();
    if (result.isConfirmed && !(await this.confirm())) return;
    if (result.isConfirmed || result.isDenied) proceed();
  }
}
