import { TPipe } from '@pipes/t.pipe';
import { Component } from '@angular/core';
import { ModalComponent } from '@components/modal/modal.component';
import { ModalOpenDirective } from '@directives/modal-open.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TeleportToDirective } from '@directives/teleport.to.directive';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { tablerCertificate } from '@ng-icons/tabler-icons';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-modal-credits',
  imports: [
    TPipe,
    NgIconComponent,
    TippyDirective,
    SFXDirective,
    ModalComponent,
    ModalOpenDirective,
    TeleportToDirective,
  ],
  providers: [provideIcons({ tablerCertificate })],
  templateUrl: './modal-credits.component.html',
  styleUrl: './modal-credits.component.scss',
})
export class ModalCreditsComponent {
  public readonly color = '#f34a4a';
  public currentColor = '#ccc';

  public readonly credits = [
    { type: 'SFX', name: 'UI & Menu Sound FX Pack' },
    { type: 'SFX', name: 'Fantasy Game UI Sounds' },
    { type: 'SFX', name: 'RPG Music Pack The Ultimate Collection II' },
    { type: 'BGM', name: 'Fantasy Ambience Complete Collection' },
    { type: 'BGM', name: 'Ambient Music Pack Vol. 1' },
    { type: 'BGM', name: 'Ambient Music Pack Vol. 2' },
    { type: 'Art', name: 'SpellBook Megapack' },
    { type: 'Art', name: 'Admurins Items Mega Pack' },
    { type: 'Art', name: 'Oryx Ultimate Fantasy' },
    { type: 'Art', name: 'Minifantasy - Maps' },
    { type: 'Art', name: 'Battle backgrounds for RPG, JRPG, IDLE' },
    { type: 'Art', name: '16x16 Puny World Tileset' },
    { type: 'Art', name: 'Kenney Input Prompts' },
  ];
}
