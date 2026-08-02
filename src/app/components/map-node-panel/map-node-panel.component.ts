import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
} from '@angular/core';
import { ButtonCloseComponent } from '@components/button-close/button-close.component';
import {
  getMap,
  mapNodeDeselect,
  selectedMapNode,
  tiledObjectSpriteFrame,
  worldNodeDescription,
  worldNodeLevelRange,
  worldNodeMonsterCount,
} from '@helpers';
import type { TiledMap } from '@interfaces';

@Component({
  selector: 'app-map-node-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonCloseComponent],
  templateUrl: './map-node-panel.component.html',
  styleUrl: './map-node-panel.component.scss',
  host: {
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
})
export class MapNodePanelComponent {
  private elementRef = inject(ElementRef<HTMLElement>);

  public node = computed(() => selectedMapNode());

  public spriteFrame = computed(() => {
    const entry = this.node();
    if (!entry) return undefined;

    const map = getMap(entry.mapName)?.data as TiledMap | undefined;
    if (!map) return undefined;

    return tiledObjectSpriteFrame(map, entry.nodeData);
  });

  public levelLabel = computed(() => {
    const entry = this.node();
    const levelRange = entry ? worldNodeLevelRange(entry) : undefined;
    if (!levelRange) return '—';

    return levelRange.min === levelRange.max
      ? `${levelRange.min}`
      : `${levelRange.min}–${levelRange.max}`;
  });

  public monsterCount = computed(() => {
    const entry = this.node();
    return entry ? worldNodeMonsterCount(entry) : undefined;
  });

  public description = computed(() => {
    const entry = this.node();
    return entry ? worldNodeDescription(entry) : undefined;
  });

  public close(): void {
    mapNodeDeselect();
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.node()) return;

    const target = event.target;
    if (!(target instanceof Node)) return;
    if (target instanceof HTMLCanvasElement) return;
    if (this.elementRef.nativeElement.contains(target)) return;

    mapNodeDeselect();
  }
}
