import { TPluralPipe } from '@pipes/t-plural.pipe';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { TooltipSkillPreviewComponent } from '@components/tooltip-skill-preview/tooltip-skill-preview.component';
import type { ChargingSkillPreview } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-icon-skill-charging',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPluralPipe,
    DecimalPipe,
    AtlasImageComponent,
    TippyDirective,
    TooltipSkillPreviewComponent,
  ],
  templateUrl: './icon-skill-charging.component.html',
  host: { class: 'block' },
})
export class IconSkillChargingComponent {
  public charging = input.required<ChargingSkillPreview>();
}
