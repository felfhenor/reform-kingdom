import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { ButtonResearchNodeComponent } from '@components/button-research-node/button-research-node.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { getEntry } from '@helpers/content';
import { notifySuccess } from '@helpers/notify';
import {
  activeResearchContent,
  activeResearchState,
  researchProgressFraction,
} from '@helpers/research/research';
import { researchStartNode } from '@helpers/research/research-queue';
import { researchTreeLayout, researchTrees } from '@helpers/research/research-tree-layout';
import type { ResearchId, ResearchTreeContent, ResearchTreeId } from '@interfaces';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-play-kingdom-archive',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonKingdomBackComponent,
    ButtonResearchNodeComponent,
    CardPageComponent,
    SweetAlert2Module,
  ],
  templateUrl: './play-kingdom-archive.component.html',
})
export class PlayKingdomArchiveComponent {
  public trees = computed(() => researchTrees());

  private selectedTreeId = signal<ResearchTreeId | undefined>(undefined);

  public activeTree = computed<ResearchTreeContent | undefined>(() => {
    const trees = this.trees();
    const selected = this.selectedTreeId();
    return trees.find((tree) => tree.id === selected) ?? trees[0];
  });

  public rows = computed(() => {
    const tree = this.activeTree();
    return tree ? researchTreeLayout(tree) : [];
  });

  // A CSS Grid, not a flexbox row per row - flexbox centers each row
  // independently by its own content width, so a blank cell meant to align
  // a later row's node under an earlier row's column (e.g. Quartermaster's
  // Contracts III under Contracts II) wouldn't actually land at the same
  // x-coordinate once rows have different item counts. Grid gives every
  // row the same fixed column tracks, so authored column position (real
  // or blank) always maps to the same visual column.
  public gridTemplateColumns = computed(() => {
    const columns = Math.max(0, ...this.rows().map((row) => row.length));
    return `repeat(${columns}, 8rem)`;
  });

  public currentResearch = computed(() => activeResearchContent());
  public currentProgressFraction = computed(() => researchProgressFraction());
  public isResearching = computed(
    () => activeResearchState().status === 'Researching',
  );

  private swapSwal = viewChild<SwalComponent>('swapSwal');
  private pendingResearchId = signal<ResearchId | undefined>(undefined);
  public pendingResearchName = signal<string | undefined>(undefined);
  public isStarting = signal(false);

  public selectTree(treeId: ResearchTreeId): void {
    this.selectedTreeId.set(treeId);
  }

  public onSelectNode(researchId: ResearchId): void {
    if (this.isStarting()) return;

    if (this.isResearching()) {
      this.pendingResearchId.set(researchId);
      this.pendingResearchName.set(getEntry(researchId)?.name);
      this.swapSwal()?.fire();
      return;
    }

    this.startResearch(researchId);
  }

  public confirmSwap(): void {
    const researchId = this.pendingResearchId();
    this.pendingResearchId.set(undefined);
    if (researchId) this.startResearch(researchId);
  }

  private startResearch(researchId: ResearchId): void {
    this.isStarting.set(true);
    const started = researchStartNode(researchId);
    this.isStarting.set(false);

    if (started) {
      notifySuccess(`Research started: ${getEntry(researchId)?.name ?? 'Unknown'}`);
    }
  }
}
