import { Component } from '@angular/core';
import { ModalComponent } from '@components/modal/modal.component';
import { PanelOptionsComponent } from '@components/panel-options/panel-options.component';
import { ModalOpenDirective } from '@directives/modal-open.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TeleportToDirective } from '@directives/teleport.to.directive';

@Component({
  selector: 'app-button-settings',
  imports: [
    SFXDirective,
    ModalComponent,
    PanelOptionsComponent,
    TeleportToDirective,
    ModalOpenDirective,
  ],
  templateUrl: './button-settings.component.html',
  styleUrl: './button-settings.component.scss',
})
export class ButtonSettingsComponent {}
