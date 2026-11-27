import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { AtlasedImage } from '@interfaces';
import { ContentService } from '@services/content.service';

@Component({
  selector: 'app-atlas-image',
  imports: [CommonModule],
  templateUrl: './atlas-image.component.html',
  styleUrl: './atlas-image.component.scss',
})
export class AtlasImageComponent {
  private contentService = inject(ContentService);

  public spritesheet = input.required<AtlasedImage>();
  public assetName = input.required<string>();
  public cssClass = input<string>('');

  private frame = computed(() =>
    this.contentService.spriteFrame(this.spritesheet(), this.assetName()),
  );

  public assetUrl = computed(() => this.frame()?.url ?? '');

  public specificAsset = computed(
    () => this.frame() ?? { x: 0, y: 0, width: 0, height: 0 },
  );
}
