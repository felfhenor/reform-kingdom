import { Component, inject } from '@angular/core';
import { ButtonGlowDirective } from '@directives/button-glow.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { isInElectron } from '@helpers/engine/electron';
import { MetaService } from '@services/meta.service';

@Component({
  selector: 'app-button-update',
  imports: [ButtonGlowDirective, SFXDirective],
  templateUrl: './button-update.component.html',
  styleUrl: './button-update.component.scss',
})
export class ButtonUpdateComponent {
  public meta = inject(MetaService);

  public shouldShowUpdate = !isInElectron();
}
