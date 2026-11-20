import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FFInputPromptComponent } from '@ff/components/input-prompt/input-prompt.component';
import { FFInputService } from '@ff/input/ff-input.service';

@Component({
  selector: 'ff-bar-prompts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FFInputPromptComponent],
  template: `
    @if (input.mode() === 'gamepad' && input.prompts().length > 0) {
      <div
        class="fixed bottom-2 left-1/2 -translate-x-1/2 z-[210] flex gap-6 px-3 py-1 pointer-events-none bg-base-100/90 border border-base-300 text-xs"
      >
        @for (prompt of input.prompts(); track prompt.label) {
          <span class="inline-flex items-center gap-2">
            @for (action of prompt.actions; track action) {
              <ff-input-prompt [action]="action" />
            }
            <span [textContent]="prompt.label"></span>
          </span>
        }
      </div>
    }
  `,
})
export class FFBarPromptsComponent {
  protected readonly input = inject(FFInputService);
}
