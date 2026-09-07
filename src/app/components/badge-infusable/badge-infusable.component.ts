import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';

@Component({
  selector: 'app-badge-infusable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './badge-infusable.component.html',
  styleUrl: './badge-infusable.component.scss',
})
export class BadgeInfusableComponent {}
