import { Component, computed, inject, input } from '@angular/core';
import type { AtlasedImage } from '@interfaces';
import { ContentService } from '@services/content.service';

@Component({
  selector: 'app-atlas-animation',
  imports: [],
  templateUrl: './atlas-animation.component.html',
  styleUrl: './atlas-animation.component.scss',
})
export class AtlasAnimationComponent {
  private contentService = inject(ContentService);

  public spritesheet = input.required<AtlasedImage>();
  public assetName = input.required<string>();
  public frames = input<number>(4);

  private frame = computed(() =>
    this.contentService.spriteFrame(this.spritesheet(), this.assetName()),
  );

  public assetUrl = computed(() => this.frame()?.url ?? '');
  public assetOffsetY = computed(() => (this.frame()?.y ?? 0) / 64);
  public totalAnimationDuration = computed(() => this.frames() * 100);
}
