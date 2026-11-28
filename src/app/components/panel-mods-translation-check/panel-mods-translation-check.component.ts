import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { i18nCoveragePatchDownload } from '@helpers/i18n/i18n-coverage.ui';
import type {
  I18nCoverageLine,
  I18nCoverageReport,
  I18nKey,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { TPipe } from '@pipes/t.pipe';

// Rendering thousands of rows for a fresh translation would stall the page.
const SHOWN_LINES = 200;

const SECTIONS = [
  {
    id: 'missing',
    title: 'panelModsTranslationCheck.missing',
    more: 'panelModsTranslationCheck.andMoreInPatch',
  },
  {
    id: 'outdated',
    title: 'panelModsTranslationCheck.outdated',
    more: 'panelModsTranslationCheck.andMoreInPatch',
  },
  {
    id: 'unchanged',
    title: 'panelModsTranslationCheck.unchanged',
    more: 'panelModsTranslationCheck.andMore',
  },
] as const satisfies {
  id: keyof I18nCoverageReport;
  title: I18nKey;
  more: I18nKey;
}[];

@Component({
  selector: 'app-panel-mods-translation-check',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, DecimalPipe, FFButtonComponent, TippyDirective],
  templateUrl: './panel-mods-translation-check.component.html',
})
export class PanelModsTranslationCheckComponent {
  public report = input.required<I18nCoverageReport>();
  public closed = output<void>();

  public isDownloading = signal(false);

  public translated = computed(() => {
    const report = this.report();
    return (
      report.total -
      report.missing.length -
      report.outdated.length -
      report.unchanged.length
    );
  });

  public problems = computed(() =>
    this.report().problems.slice(0, SHOWN_LINES),
  );
  public hiddenProblems = computed(() =>
    Math.max(0, this.report().problems.length - SHOWN_LINES),
  );

  public needsWork = computed(
    () => this.report().missing.length + this.report().outdated.length,
  );

  public sections = computed(() => {
    const report = this.report();
    return SECTIONS.map((section) => ({
      ...section,
      count: report[section.id].length,
      lines: report[section.id].slice(0, SHOWN_LINES),
      hidden: Math.max(0, report[section.id].length - SHOWN_LINES),
    }));
  });

  public lineLabel(line: I18nCoverageLine): string {
    return line.entry
      ? `${line.file} "${line.entry}" ${line.key}`
      : `${line.file} ${line.key}`;
  }

  public async download(): Promise<void> {
    if (this.isDownloading()) return;
    this.isDownloading.set(true);
    try {
      await i18nCoveragePatchDownload(this.report());
    } finally {
      this.isDownloading.set(false);
    }
  }
}
