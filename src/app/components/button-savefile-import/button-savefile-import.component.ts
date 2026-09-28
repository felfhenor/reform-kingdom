import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AnalyticsClickDirective } from '@directives/analytics-click.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { notifyError } from '@helpers/engine/notify';
import { closeAllMenus } from '@helpers/engine/ui';
import { savefileImportJson } from '@helpers/savefile/savefile-load.ui';

@Component({
  selector: 'app-button-savefile-import',
  imports: [AnalyticsClickDirective, SFXDirective],
  templateUrl: './button-savefile-import.component.html',
  styleUrl: './button-savefile-import.component.scss',
})
export class ButtonSavefileImportComponent {
  private router = inject(Router);

  importSavefile(e: Event) {
    const fileInput = e.target as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => {
      fileInput.value = '';
      notifyError('Could not read that file.');
    };
    reader.onload = async (ev) => {
      fileInput.value = '';

      const imported = await savefileImportJson(
        (ev.target as FileReader).result as string,
      );
      if (!imported) return;

      closeAllMenus();
      this.router.navigate(['/game']);
    };

    reader.readAsText(file);
  }
}
