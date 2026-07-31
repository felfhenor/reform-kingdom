import type { OnInit } from '@angular/core';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SFXDirective } from '@directives/sfx.directive';
import { discordSetStatus, gameReset, setWorldSeed } from '@helpers';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-game-setup-world',
  imports: [SweetAlert2Module, SFXDirective],
  templateUrl: './game-setup-world.component.html',
  styleUrl: './game-setup-world.component.scss',
})
export class GameSetupWorldComponent implements OnInit {
  private router = inject(Router);

  ngOnInit() {
    discordSetStatus({
      state: 'Starting a new game...',
    });
  }

  public async createWorld() {
    gameReset();
    setWorldSeed(undefined);

    await this.router.navigate(['/setup', 'generate']);
  }
}
