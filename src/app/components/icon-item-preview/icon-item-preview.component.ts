import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import type { AtlasedImage } from '@interfaces';

// Renders a sprite, compositing it over an optional `backdropSprite`.
@Component({
  selector: 'app-icon-item-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent],
  templateUrl: './icon-item-preview.component.html',
  styleUrl: './icon-item-preview.component.scss',
})
export class IconItemPreviewComponent {
  public sprite = input.required<string>();
  public spritesheet = input.required<AtlasedImage>();
  public backdropSprite = input<string>();
  // Host is `display: contents`, so this is forwarded to the rendered element instead.
  public cssClass = input<string>('');
}
