import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { ffActionMap } from '@ff/input/ff-action-map';
import { ffGlyph } from '@ff/input/ff-glyphs';
import { FFInputService } from '@ff/input/ff-input.service';
import type { FFGamepadAction } from '@ff/interfaces/ff-input';

@Component({
  selector: 'ff-input-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Gone, not just empty, without a glyph: an empty flex item would still take up a gap.
  host: { '[class.hidden]': '!glyph()' },
  template: `
    @if (glyph(); as glyph) {
      <span
        [class]="'ff-glyph ff-glyph-' + input.family()"
        [style.line-height.em]="glyph.lineHeightEm"
        [textContent]="glyph.text"
        aria-hidden="true"
      ></span>
    }
  `,
})
export class FFInputPromptComponent {
  protected readonly input = inject(FFInputService);

  public action = input.required<FFGamepadAction>();

  protected glyph = computed(() => {
    if (this.input.mode() !== 'gamepad') return undefined;

    const family = this.input.family();
    return ffGlyph(family, ffActionMap(family)[this.action()]);
  });
}
