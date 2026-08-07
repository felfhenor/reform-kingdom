import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';

// Small corner badge shown on any item that can be infused into equipment
// (i.e. has `infusionStats`). Caller wraps its icon slot in
// `class="relative"` and conditionally renders this alongside it.
@Component({
  selector: 'app-infusable-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './infusable-badge.component.html',
  styleUrl: './infusable-badge.component.scss',
})
export class InfusableBadgeComponent {}
