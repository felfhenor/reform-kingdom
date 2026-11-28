import { getEntry } from '@helpers/content/content';
import { contentShortName } from '@helpers/i18n/i18n-content';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { skillTreeNodeShortName } from '@helpers/hero/skill-tree-content';
import type { SkillTreeNodeContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

// The slot is always drawn, so labels line up whether or not the hero has a spec yet.
@Component({
  selector: 'app-icon-spec',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconItemPreviewComponent, TippyDirective],
  template: `
    @let node = spec();
    <span
      class="relative inline-block overflow-hidden shrink-0 align-middle w-4 h-4"
      [tp]="name()"
      [tpIsEnabled]="!!node"
    >
      @if (node) {
        <app-icon-item-preview
          [sprite]="node.sprite"
          spritesheet="skilltreenode"
          cssClass="zoom-inline"
        />
      }
    </span>
  `,
})
export class IconSpecComponent {
  public spec = input<Pick<SkillTreeNodeContent, 'name' | 'sprite'>>();

  public name = computed(() => {
    const node = this.spec();
    if (!node) return '';
    // Legacy runs keep only a short English name, which has no entry to translate from.
    const entry = getEntry<SkillTreeNodeContent>(node.name);
    return entry?.__type === 'skilltreenode'
      ? contentShortName(entry)
      : skillTreeNodeShortName(node);
  });
}
