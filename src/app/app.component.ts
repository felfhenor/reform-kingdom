import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingScreenComponent } from '@components/loading-screen/loading-screen.component';
import { LoadingService } from '@services/loading.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, LoadingScreenComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected loadingService = inject(LoadingService);

  @HostListener('document:contextmenu')
  onContextMenu(): boolean {
    return false;
  }
}
