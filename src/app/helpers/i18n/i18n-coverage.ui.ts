import {
  contentBaseEntries,
  contentBaseEntryByName,
} from '@helpers/content/content';
import { t } from '@helpers/i18n/i18n';
import { i18nCoverage, i18nCoveragePatch } from '@helpers/i18n/i18n-coverage';
import {
  i18nContentFields,
  i18nTiledObjectNames,
} from '@helpers/i18n/i18n-fields';
import { I18N_BASE_LOCALE, i18nBaseLayers } from '@helpers/i18n/i18n-language';
import { mapsBase } from '@helpers/maps';
import { modLoadFiles, modsRevokeUnused } from '@helpers/mod/mod-load.ui';
import { modZipFiles } from '@helpers/mod/mod-zip';
import type {
  I18nCoverageCheck,
  I18nCoverageReport,
  I18nEnglishSnapshot,
  TiledMap,
} from '@interfaces';
import { sortBy, uniq } from 'es-toolkit/compat';

// A Save As dialog can still be reading the blob long after click().
const PATCH_URL_LIFETIME_MS = 60_000;

function i18nEnglishSnapshot(): I18nEnglishSnapshot {
  const english = i18nBaseLayers().find(
    (layer) => layer.locale === I18N_BASE_LOCALE,
  );
  const content: I18nEnglishSnapshot['content'] = {};
  contentBaseEntries().forEach((entry) => {
    (content[entry.__type] ??= {})[entry.name] = i18nContentFields(
      entry,
      entry.__type,
    );
  });
  const maps = mapsBase().map((map) => map.data as TiledMap);
  return {
    ui: english?.ui ?? {},
    content,
    nodes: sortBy(uniq(maps.flatMap(i18nTiledObjectNames))),
  };
}

function i18nEnglishEntry(type: string, name: string) {
  const entry = contentBaseEntryByName(name);
  return entry?.__type === type ? entry : undefined;
}

export async function i18nCoverageCheckZip(
  data: Blob,
): Promise<I18nCoverageCheck> {
  try {
    const parsed = await modLoadFiles(
      'local',
      'coverage',
      await modZipFiles(data),
    );
    modsRevokeUnused([parsed]);
    const language = parsed.bundle?.translations;
    if (!language) {
      return {
        errors:
          parsed.errors.length > 0
            ? parsed.errors
            : [t('mods.notATranslation')],
      };
    }
    const english = i18nEnglishSnapshot();
    const report = i18nCoverage(language, english, i18nEnglishEntry);
    return {
      report: { ...report, problems: [...parsed.errors, ...report.problems] },
      errors: [],
    };
  } catch (e) {
    return { errors: [t('mods.couldNotReadZip', { error: String(e) })] };
  }
}

export async function i18nCoveragePatchDownload(
  report: I18nCoverageReport,
): Promise<void> {
  const [{ BlobWriter, TextReader, ZipWriter }, yaml] = await Promise.all([
    import('@zip.js/zip.js'),
    import('js-yaml'),
  ]);
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  for (const [file, data] of Object.entries(i18nCoveragePatch(report))) {
    await writer.add(
      `i18n/${file}`,
      new TextReader(yaml.dump(data, { lineWidth: -1 })),
    );
  }
  const url = URL.createObjectURL(await writer.close());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${report.locale}-i18n-patch.zip`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), PATCH_URL_LIFETIME_MS);
}
