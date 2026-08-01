import { Component, input } from '@angular/core';

type CardSize = 'main' | 'sub' | 'heroes' | 'heroes-sub' | 'full';

@Component({
  selector: 'app-card-page',
  imports: [],
  templateUrl: './card-page.component.html',
  styleUrl: './card-page.component.scss',
})
export class CardPageComponent {
  public heightProfile = input<CardSize>('main');

  public isEmbeddedInModal = input<boolean>(false);
}
