import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { SFXDirective } from '@directives/sfx.directive';
import { getOption } from '@helpers/state-options';

@Component({
  selector: 'app-button-icons',
  imports: [SFXDirective],
  host: {
    '[class.hidden]': '!debugEnabled()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './button-icons.component.html',
  styleUrl: './button-icons.component.scss',
})
export class ButtonIconsComponent {
  private router = inject(Router);

  public debugEnabled = computed(() => getOption('showDebug'));

  public open() {
    const url = this.router.serializeUrl(this.router.createUrlTree(['/icons']));
    window.open(url, '_blank');
  }
}
