import { TPipe } from '@pipes/t.pipe';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { SFXDirective } from '@directives/sfx.directive';
import { closeAllMenus } from '@helpers/engine/ui';
import { savefileImportDemo } from '@helpers/savefile/savefile-load.ui';

@Component({
  selector: 'app-button-savefile-import-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, SFXDirective],
  template: `
    <button
      type="button"
      class="btn btn-primary"
      [disabled]="isImporting()"
      (click)="importDemo()"
      appSfx="ui-success"
      [sfxTrigger]="['click', 'hover']"
    >
      {{ 'buttonSavefileImportDemo.importDemoSave' | t }}
    </button>
  `,
})
export class ButtonSavefileImportDemoComponent {
  private router = inject(Router);
  public isImporting = signal(false);

  async importDemo(): Promise<void> {
    this.isImporting.set(true);
    const imported = await savefileImportDemo();
    this.isImporting.set(false);
    if (!imported) return;

    closeAllMenus();
    void this.router.navigate(['/game']);
  }
}
