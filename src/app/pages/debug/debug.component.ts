import type { Signal } from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { InputAnalysisComponent } from '@components/input-analysis/input-analysis.component';
import { computeDefaultLevel } from '@helpers/debug/analysis-defaults';
import { ALL_ANALYSIS_INPUTS, GLOBAL_ANALYSIS_INPUTS } from '@helpers/debug/analysis-inputs';
import { ANALYSIS_SCRIPTS } from '@helpers/debug/analysis-registry';
import type {
  AnalysisInputDef,
  AnalysisInputValue,
  AnalysisParams,
  AnalysisRunResult,
  AnalysisScriptCategory,
  AnalysisScriptDefinition,
} from '@interfaces';
import { linkedQueryParam } from 'ngxtension/linked-query-param';
import { TippyDirective } from '@ngneat/helipopper';
import { ContentService } from '@services/content.service';

type ScriptResultState = {
  result: AnalysisRunResult | null;
  error: string | null;
};

type ScriptState = {
  definition: AnalysisScriptDefinition;
  ownInputs: AnalysisInputDef[];
  state: Signal<ScriptResultState>;
};

type CategoryStatus = { pass: number; warning: number; fail: number };

const CATEGORIES: AnalysisScriptCategory[] = [
  'Equipment & Items',
  'Tradeskills & Recipes',
  'World & Maps',
  'Hero Stats',
  'Monster Stats',
  'Research',
];

// `level` has a content-derived default (see `computeDefaultLevel`), so its
// query param is left `null` (rather than baking a static fallback into
// `parse`) when absent - `inputValue()` below resolves that case specially.
// Every other input's static `defaultValue` is baked into `parse` directly.
function paramParse(input: AnalysisInputDef): (raw: string | null) => AnalysisInputValue | null {
  switch (input.type) {
    case 'number':
      return (raw) => {
        const fallback = input.key === 'level' ? null : (input.defaultValue as number);
        if (raw === null) return fallback;
        const value = Number(raw);
        return Number.isFinite(value) ? value : fallback;
      };
    case 'boolean':
      return (raw) => (raw === null ? (input.defaultValue as boolean) : raw === 'true');
    case 'jobMultiSelect':
    case 'monsterMultiSelect':
      return (raw) => (raw === null || raw === '' ? [] : raw.split(','));
    case 'text':
    default:
      return (raw) => (raw === null ? (input.defaultValue as string) : raw);
  }
}

function paramStringify(
  input: AnalysisInputDef,
): (value: AnalysisInputValue | null) => string | null {
  switch (input.type) {
    case 'jobMultiSelect':
    case 'monsterMultiSelect':
      return (value) => {
        const names = (value as string[] | null) ?? [];
        return names.length > 0 ? names.join(',') : null;
      };
    case 'boolean':
      return (value) => (value === null ? null : (value as boolean) ? 'true' : 'false');
    default:
      return (value) => (value === null ? null : String(value));
  }
}

@Component({
  selector: 'app-debug',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputAnalysisComponent, TippyDirective],
  templateUrl: './debug.component.html',
  styleUrl: './debug.component.scss',
})
export class DebugComponent {
  private contentService = inject(ContentService);

  public categories = CATEGORIES;
  public activeCategory = linkedQueryParam<AnalysisScriptCategory>('tab', {
    parse: (raw) => (CATEGORIES.includes(raw as AnalysisScriptCategory) ? (raw as AnalysisScriptCategory) : CATEGORIES[0]),
    stringify: (value) => value,
  });

  public globalInputs: AnalysisInputDef[] = GLOBAL_ANALYSIS_INPUTS;

  public isReady = computed(
    () => this.contentService.hasLoadedData() && this.contentService.hasLoadedMaps(),
  );

  private paramSignals: Record<
    string,
    Signal<AnalysisInputValue | null> & { set: (v: AnalysisInputValue | null) => void }
  > = Object.fromEntries(
    ALL_ANALYSIS_INPUTS.map((input) => [
      input.key,
      linkedQueryParam(input.key, {
        parse: paramParse(input),
        stringify: paramStringify(input),
      }),
    ]),
  );

  private defaultLevel = computed(() =>
    this.isReady()
      ? computeDefaultLevel()
      : (ALL_ANALYSIS_INPUTS.find((i) => i.key === 'level')?.defaultValue ?? 1),
  );

  public params = computed<AnalysisParams>(() => {
    const params: AnalysisParams = {};
    ALL_ANALYSIS_INPUTS.forEach((input) => {
      params[input.key] = this.inputValue(input.key);
    });
    return params;
  });

  public scripts: ScriptState[] = ANALYSIS_SCRIPTS.map((definition) => ({
    definition,
    ownInputs: ALL_ANALYSIS_INPUTS.filter(
      (input) =>
        definition.inputKeys.includes(input.key) && !GLOBAL_ANALYSIS_INPUTS.includes(input),
    ),
    state: computed<ScriptResultState>(() => {
      if (!this.isReady()) return { result: null, error: null };

      try {
        return { result: definition.run(this.params()), error: null };
      } catch (err) {
        return { result: null, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  }));

  public categoryStatuses: Record<AnalysisScriptCategory, Signal<CategoryStatus>> =
    Object.fromEntries(
      CATEGORIES.map((category) => [
        category,
        computed<CategoryStatus>(() => {
          const status: CategoryStatus = { pass: 0, warning: 0, fail: 0 };
          this.scriptsForCategory(category).forEach((script) => {
            const result = script.state().result;
            if (!result) return;
            result.checks.forEach((check) => {
              if (check.status === 'pass') status.pass += 1;
              else if (check.status === 'warning') status.warning += 1;
              else if (check.status === 'fail') status.fail += 1;
            });
          });
          return status;
        }),
      ]),
    ) as Record<AnalysisScriptCategory, Signal<CategoryStatus>>;

  public scriptsForCategory(category: AnalysisScriptCategory): ScriptState[] {
    return this.scripts.filter((script) => script.definition.category === category);
  }

  public inputValue(key: string): AnalysisInputValue {
    const fromUrl = this.paramSignals[key]();
    if (fromUrl !== null) return fromUrl;
    if (key === 'level') return this.defaultLevel();
    return ALL_ANALYSIS_INPUTS.find((input) => input.key === key)!.defaultValue;
  }

  public setInput(key: string, value: AnalysisInputValue): void {
    this.paramSignals[key].set(value);
  }

  public failCount(result: AnalysisRunResult): number {
    return result.checks.filter((check) => check.status === 'fail').length;
  }

  public warningCount(result: AnalysisRunResult): number {
    return result.checks.filter((check) => check.status === 'warning').length;
  }

  public supportingScripts(inputKey: string): string {
    const titles = ANALYSIS_SCRIPTS.filter((script) => script.inputKeys.includes(inputKey)).map(
      (script) => script.title,
    );
    return titles.length > 0 ? `Used by: ${titles.join(', ')}` : 'Not used by any script.';
  }
}
