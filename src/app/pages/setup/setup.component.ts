import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '@components/navbar/navbar.component';
import { FadeInDirective } from '@directives/fade-in.directive';

@Component({
  selector: 'app-setup',
  imports: [RouterOutlet, NavbarComponent],
  hostDirectives: [FadeInDirective],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent {}
