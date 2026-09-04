import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';

@Component({
  selector: 'app-page-blank',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent],
  template: `
    <app-card-page heightProfile="full"></app-card-page>
  `,
})
export class PageBlankComponent {}
