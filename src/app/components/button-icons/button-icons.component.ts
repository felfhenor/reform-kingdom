import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SFXDirective } from '@directives/sfx.directive';

@Component({
  selector: 'app-button-icons',
  imports: [SFXDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './button-icons.component.html',
  styleUrl: './button-icons.component.scss',
})
export class ButtonIconsComponent {
  private router = inject(Router);

  public open() {
    const url = this.router.serializeUrl(this.router.createUrlTree(['/icons']));
    window.open(url, '_blank');
  }
}
