import { DecimalPipe, formatNumber, PercentPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { BackdropNodeComponent } from '@components/backdrop-node/backdrop-node.component';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { ButtonSplitComponent } from '@components/button-split/button-split.component';
import { CardEquipmentItemComponent } from '@components/card-equipment-item/card-equipment-item.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { IconComponent } from '@components/icon/icon.component';
import { LabelJobComponent } from '@components/label-job/label-job.component';
import { PanelCombatSceneComponent } from '@components/panel-combat-scene/panel-combat-scene.component';
import { PanelHeroBurstSkillsComponent } from '@components/panel-hero-burst-skills/panel-hero-burst-skills.component';
import { PanelHeroCombatOrdersComponent } from '@components/panel-hero-combat-orders/panel-hero-combat-orders.component';
import { PanelHeroEquipmentSkillsComponent } from '@components/panel-hero-equipment-skills/panel-hero-equipment-skills.component';
import { PanelHeroEquipmentStatsComponent } from '@components/panel-hero-equipment-stats/panel-hero-equipment-stats.component';
import { PanelHeroesSkillTreeDetailComponent } from '@components/panel-heroes-skill-tree-detail/panel-heroes-skill-tree-detail.component';
import { PanelHeroesSkillTreeGridComponent } from '@components/panel-heroes-skill-tree-grid/panel-heroes-skill-tree-grid.component';
import { SlotEquipmentComponent } from '@components/slot-equipment/slot-equipment.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { TabsHeroComponent } from '@components/tabs-hero/tabs-hero.component';
import { TooltipMonsterPreviewComponent } from '@components/tooltip-monster-preview/tooltip-monster-preview.component';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import {
  colosseumEncounterOptions,
  colosseumGearPool,
  colosseumPartyFromSetup,
} from '@helpers/colosseum/colosseum';
import {
  COLOSSEUM_LIVE_EVENT_SCOPE,
  colosseumBatchSummarize,
} from '@helpers/colosseum/colosseum-run';
import { colosseumBatchRun } from '@helpers/colosseum/colosseum-run.ui';
import {
  colosseumSetup,
  colosseumSetupPrune,
} from '@helpers/colosseum/colosseum-setup';
import {
  colosseumHeroIsEdited,
  colosseumSetupEditHero,
  colosseumSetupEquip,
  colosseumSetupPickJob,
  colosseumSetupResetHero,
  colosseumTreeLearn,
  colosseumTreeUnlearn,
} from '@helpers/colosseum/colosseum-setup.ui';
import { colosseumGearWornBy } from '@helpers/colosseum/colosseum.ui';
import { combatSimulationLog } from '@helpers/combat/combat-log';
import {
  combatOrderClausesAdd,
  combatOrderClausesRemove,
  combatOrderClausesReorder,
  combatOrderClausesSetEnabled,
  combatOrderClausesUpdate,
} from '@helpers/combat/combat-order';
import { getEntry } from '@helpers/content/content';
import { characterJobLevel, getUnlockedJobs } from '@helpers/hero/job';
import { characterSkillTreeAvailableSp } from '@helpers/hero/skill-tree';
import {
  characterSkillTreeNodeRanks,
  characterSkillTreeNodeStates,
} from '@helpers/hero/skill-tree.ui';
import {
  canEquipItem,
  equipmentEntriesForSlot,
  isSlotAvailableForJob,
} from '@helpers/item/equipment';
import { armoryState, worldPartyState } from '@helpers/state-game';
import { worldNodeBackground } from '@helpers/world-node/world-node-background.ui';
import type {
  Character,
  CharacterId,
  ColosseumEncounterRow,
  ColosseumFightMode,
  ColosseumHeroEdit,
  ColosseumHeroTab,
  ColosseumRunResult,
  CombatOrderAction,
  CombatOrderClauseId,
  CombatOrderCondition,
  EncounterId,
  EquipmentItem,
  EquipmentSkillContent,
  EquipmentSlot,
  Icon,
  JobContent,
  JobId,
  MonsterContent,
  SkillTreeNodeContent,
  SkillTreeNodeId,
  SplitButtonOption,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { ColosseumFightService } from '@services/colosseum-fight.service';

const GEAR_SLOTS: EquipmentSlot[] = [
  'Helmet',
  'Accessory',
  'Armor',
  'Ring',
  'Weapon',
  'Offhand',
  'Ammo',
  'Artifact',
];
const SIMULATE_COUNTS = [10, 50, 100, 500];
const DEFAULT_SIMULATE_COUNT = 50;
const HERO_TABS: { id: ColosseumHeroTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'job', label: 'Job' },
  { id: 'gear', label: 'Gear' },
  { id: 'tree', label: 'Skill Tree' },
  { id: 'orders', label: 'Combat Orders' },
  { id: 'burst', label: 'Burst Skill' },
];

@Component({
  selector: 'app-play-kingdom-colosseum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ColosseumFightService],
  imports: [
    AtlasAnimationComponent,
    BackdropNodeComponent,
    BarProgressComponent,
    BlankSlateComponent,
    ButtonKingdomBackComponent,
    ButtonSplitComponent,
    CardEquipmentItemComponent,
    CardPageComponent,
    DecimalPipe,
    IconComponent,
    IconJobComponent,
    LabelJobComponent,
    ListRowDirective,
    PanelCombatSceneComponent,
    PanelHeroBurstSkillsComponent,
    PanelHeroCombatOrdersComponent,
    PanelHeroEquipmentSkillsComponent,
    PanelHeroEquipmentStatsComponent,
    PanelHeroesSkillTreeDetailComponent,
    PanelHeroesSkillTreeGridComponent,
    PercentPipe,
    SFXDirective,
    SlotEquipmentComponent,
    SlotIconBlankComponent,
    SpriteNodeComponent,
    TabsHeroComponent,
    TippyDirective,
    TooltipMonsterPreviewComponent,
  ],
  templateUrl: './play-kingdom-colosseum.component.html',
  styleUrl: './play-kingdom-colosseum.component.scss',
})
export class PlayKingdomColosseumComponent {
  private locale = inject(LOCALE_ID);
  public fight = inject(ColosseumFightService);
  public simLog = combatSimulationLog;
  public readonly eventKeyPrefix = COLOSSEUM_LIVE_EVENT_SCOPE.keyPrefix;

  public readonly heroTabs = HERO_TABS;
  public readonly speeds = [1, 2, 4];
  public readonly defaultSimulateCount = DEFAULT_SIMULATE_COUNT;
  public readonly fightOptions: SplitButtonOption<ColosseumFightMode>[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'manual', label: 'Turn-based' },
  ];
  public readonly simulateOptions: SplitButtonOption<number>[] =
    SIMULATE_COUNTS.map((count) => ({
      value: count,
      label: `${formatNumber(count, this.locale)} fights`,
    }));
  public readonly simulateLabel = `Simulate ${formatNumber(DEFAULT_SIMULATE_COUNT, this.locale)}`;

  public setup = colosseumSetup;
  public restoredDropped = signal<string[]>([]);

  public party = computed(() =>
    colosseumPartyFromSetup(worldPartyState(), this.setup(), armoryState()),
  );

  public encounterRows = computed<ColosseumEncounterRow[]>(() =>
    colosseumEncounterOptions().map((option) => ({
      ...option,
      background: option.node ? worldNodeBackground(option.node) : undefined,
    })),
  );
  public encounter = computed(() => {
    const rows = this.encounterRows();
    const id = this.setup().encounterId;
    return (rows.find((row) => row.encounter.id === id) ?? rows[0])?.encounter;
  });
  public fightIndex = computed(() => this.setup().fightIndex);
  public fights = computed(() =>
    (this.encounter()?.fights ?? []).map((fight) =>
      fight.monsters
        .map((entry) => getEntry<MonsterContent>(entry.monsterId))
        .filter((monster): monster is MonsterContent => !!monster),
    ),
  );

  public isWatching = signal(false);
  private lastMode: ColosseumFightMode = 'auto';
  public isReview = computed(
    () => this.isWatching() && !this.fight.combat() && !!this.fight.outcome(),
  );

  public isViewingResults = signal(false);
  public batchRunning = signal(false);
  public batchDone = signal(0);
  public batchTotal = signal(0);
  public batchResults = signal<ColosseumRunResult[]>([]);
  // Snapshotted at the start, so results keep describing what was simulated.
  public batchEncounterName = signal('');
  public batchLocation = signal<ColosseumEncounterRow | undefined>(undefined);
  private batchFightCount = signal(0);
  private batchHeroIds = signal<CharacterId[]>([]);
  public batchHeroes = signal<Character[]>([]);
  private batchCancelled = false;
  public summary = computed(() =>
    colosseumBatchSummarize(
      this.batchResults(),
      this.batchFightCount(),
      this.batchHeroIds(),
    ),
  );
  public batchStats = computed(() => this.batchStatRows());

  public heroTab = signal<ColosseumHeroTab>('overview');
  public selectedHeroId = signal<CharacterId | undefined>(undefined);
  public hero = computed(() => {
    const party = this.party();
    return party.find((c) => c.id === this.selectedHeroId()) ?? party[0];
  });
  private realHero = computed(() =>
    worldPartyState().find((c) => c.id === this.hero()?.id),
  );
  public heroJob = computed(() => getEntry<JobContent>(this.hero().jobId));
  public isHeroEdited = computed(() =>
    colosseumHeroIsEdited(
      this.setup().heroes.find((edit) => edit.characterId === this.hero().id),
    ),
  );

  public jobs = computed(() => getUnlockedJobs());

  public gearSlot = signal<EquipmentSlot>('Weapon');
  public gearSlots = computed(() =>
    GEAR_SLOTS.filter((slot) => isSlotAvailableForJob(slot, this.hero().jobId)),
  );
  public gearPicker = computed(() => {
    const hero = this.hero();
    const pool = colosseumGearPool(worldPartyState(), armoryState());
    return equipmentEntriesForSlot(pool, this.gearSlot())
      .filter((entry) => canEquipItem(hero, entry.content))
      .map((entry) => {
        const owner = colosseumGearWornBy(this.party(), entry.item.id);
        return { entry, owner, isOwn: owner?.id === hero.id };
      });
  });

  public selectedNodeId = signal<SkillTreeNodeId | undefined>(undefined);
  public treeStates = computed(() =>
    characterSkillTreeNodeStates(this.hero(), []),
  );
  public treeRanks = computed(() =>
    characterSkillTreeNodeRanks(this.hero(), []),
  );
  public selectedRank = computed(() => {
    const id = this.selectedNodeId();
    return id ? this.treeRanks().get(id) : undefined;
  });
  public treeSp = computed(() =>
    characterSkillTreeAvailableSp(this.hero(), this.hero().jobId),
  );
  public selectedNode = computed(() => {
    const id = this.selectedNodeId();
    return id ? getEntry<SkillTreeNodeContent>(id) : undefined;
  });

  public clauses = computed(
    () => this.hero().combatOrders[this.hero().jobId] ?? [],
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.batchCancelled = true));
    const report = colosseumSetupPrune(
      colosseumSetup(),
      worldPartyState(),
      armoryState(),
    );
    colosseumSetup.set(report.setup);
    this.restoredDropped.set(report.dropped);
  }

  private batchStatRows(): { icon: Icon; label: string; value: string }[] {
    const summary = this.summary();
    const n = (value: number) => formatNumber(value, this.locale, '1.0-1');
    return [
      {
        icon: 'gameTrophyCup',
        label: 'Wins',
        value: `${n(summary.wins)}/${n(summary.runs)}`,
      },
      {
        icon: 'gameDuration',
        label: 'Avg. rounds',
        value: n(summary.averageRounds),
      },
      {
        icon: 'gameBrokenHeart',
        label: 'Avg. hero deaths',
        value: n(summary.averageHeroDeaths),
      },
      {
        icon: 'gameSandstorm',
        label: 'Stalemates',
        value: n(summary.stalemates),
      },
    ];
  }

  public jobOf(character: Character): JobContent | undefined {
    return getEntry<JobContent>(character.jobId);
  }

  public jobLevel(jobId: JobId): number {
    const real = this.realHero();
    return real ? characterJobLevel(real, jobId) : 0;
  }

  public pickEncounter(encounterId: EncounterId): void {
    this.setup.update((setup) => ({
      ...setup,
      encounterId,
      fightIndex: undefined,
    }));
  }

  public pickFight(fightIndex: number | undefined): void {
    this.setup.update((setup) => ({ ...setup, fightIndex }));
  }

  public watch(mode: ColosseumFightMode): void {
    const encounter = this.encounter();
    if (!encounter) return;
    const fightIndex = this.fightIndex();
    const indexes =
      fightIndex === undefined
        ? encounter.fights.map((_, index) => index)
        : [fightIndex];
    this.lastMode = mode;
    this.isWatching.set(true);
    this.fight.start(this.party(), encounter.id, indexes, mode === 'manual');
  }

  public fightAgain(): void {
    this.watch(this.lastMode);
  }

  public backToSetup(): void {
    this.fight.stop();
    this.isWatching.set(false);
    this.isViewingResults.set(false);
  }

  public async simulate(count: number): Promise<void> {
    const encounter = this.encounter();
    if (!encounter || this.batchRunning()) return;
    this.batchCancelled = false;
    this.isViewingResults.set(true);
    this.batchRunning.set(true);
    this.batchDone.set(0);
    this.batchTotal.set(count);
    this.batchEncounterName.set(encounter.name);
    this.batchLocation.set(
      this.encounterRows().find((row) => row.encounter.id === encounter.id),
    );
    this.batchFightCount.set(encounter.fights.length);
    this.batchHeroes.set(this.party());
    this.batchHeroIds.set(this.party().map((hero) => hero.id));

    const results = await colosseumBatchRun(
      this.party(),
      encounter.id,
      this.fightIndex(),
      count,
      (done) => this.batchDone.set(done.length),
      () => this.batchCancelled,
    );
    this.batchResults.set(results);
    this.batchRunning.set(false);
  }

  public cancelSimulate(): void {
    this.batchCancelled = true;
  }

  private editHero(patch: Omit<ColosseumHeroEdit, 'characterId'>): void {
    const real = this.realHero();
    if (real) this.setup.update((s) => colosseumSetupEditHero(s, real, patch));
  }

  public pickHero(id: CharacterId): void {
    this.selectedHeroId.set(id);
    this.selectedNodeId.set(undefined);
  }

  public pickJob(jobId: JobId): void {
    const real = this.realHero();
    if (real) this.setup.update((s) => colosseumSetupPickJob(s, real, jobId));
  }

  public resetHero(): void {
    const real = this.realHero();
    if (real) this.setup.update((s) => colosseumSetupResetHero(s, real));
  }

  public resetAll(): void {
    this.setup.update((setup) => ({ ...setup, heroes: [] }));
  }

  public equip(item: EquipmentItem): void {
    const real = this.realHero();
    if (!real) return;
    this.setup.update((s) =>
      colosseumSetupEquip(s, real, this.hero(), this.gearSlot(), item),
    );
  }

  public unequip(slot: EquipmentSlot): void {
    const real = this.realHero();
    if (!real) return;
    this.setup.update((s) => colosseumSetupEquip(s, real, this.hero(), slot));
  }

  public learn(id: SkillTreeNodeId): void {
    const nodes = colosseumTreeLearn(this.hero(), id);
    if (nodes) this.editHero({ skillTreeNodes: nodes });
  }

  public unlearn(id: SkillTreeNodeId): void {
    this.editHero({ skillTreeNodes: colosseumTreeUnlearn(this.hero(), id) });
  }

  public addOrder(event: {
    condition: CombatOrderCondition;
    action: CombatOrderAction;
  }): void {
    this.editHero({
      combatOrders: combatOrderClausesAdd(
        this.clauses(),
        event.condition,
        event.action,
      ),
    });
  }

  public updateOrder(event: {
    clauseId: CombatOrderClauseId;
    condition: CombatOrderCondition;
    action: CombatOrderAction;
  }): void {
    this.editHero({
      combatOrders: combatOrderClausesUpdate(
        this.clauses(),
        event.clauseId,
        event.condition,
        event.action,
      ),
    });
  }

  public removeOrder(clauseId: CombatOrderClauseId): void {
    this.editHero({
      combatOrders: combatOrderClausesRemove(this.clauses(), clauseId),
    });
  }

  public reorderOrder(event: { fromIndex: number; toIndex: number }): void {
    this.editHero({
      combatOrders: combatOrderClausesReorder(
        this.clauses(),
        event.fromIndex,
        event.toIndex,
      ),
    });
  }

  public toggleOrder(event: {
    clauseId: CombatOrderClauseId;
    enabled: boolean;
  }): void {
    this.editHero({
      combatOrders: combatOrderClausesSetEnabled(
        this.clauses(),
        event.clauseId,
        event.enabled,
      ),
    });
  }

  public chooseBurst(skill: EquipmentSkillContent): void {
    this.editHero({ burstSkillIds: [skill.id] });
  }
}
