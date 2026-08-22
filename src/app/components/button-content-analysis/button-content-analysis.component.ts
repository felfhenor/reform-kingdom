import { Component, computed, HostBinding, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SFXDirective } from '@directives/sfx.directive';
import { getOption } from '../../helpers';

@Component({
  selector: 'app-button-content-analysis',
  imports: [SFXDirective],
  templateUrl: './button-content-analysis.component.html',
  styleUrl: './button-content-analysis.component.scss',
})
export class ButtonContentAnalysisComponent {
  private router = inject(Router);

  public debugEnabled = computed(() => getOption('showDebug'));

  @HostBinding('class.hidden')
  get hideButton() {
    return !this.debugEnabled();
  }

  public open() {
    const url = this.router.serializeUrl(this.router.createUrlTree(['/debug']));
    window.open(url, '_blank');
  }
}
