import { getEntry } from '@helpers/content/content';
import {
  i18nContentFields,
  i18nContentFieldText,
} from '@helpers/i18n/i18n-fields';
import { i18nContent, i18nNodes } from '@helpers/i18n/i18n';
import type { I18nContentFields, IsContentItem } from '@interfaces';

// Keyed by English name; `name` itself stays English because content and saves reference it.
export function contentText(entry: IsContentItem, path: string): string {
  return (
    i18nContent()[entry.__type]?.[entry.name]?.[path] ??
    i18nContentFieldText(entry, path) ??
    ''
  );
}

const fieldsByEntry = new WeakMap<IsContentItem, I18nContentFields>();

function contentFieldsCached(entry: IsContentItem): I18nContentFields {
  let fields = fieldsByEntry.get(entry);
  if (!fields) {
    fields = i18nContentFields(entry);
    fieldsByEntry.set(entry, fields);
  }
  return fields;
}

// Matched by English text against the stored entry, since combat works on copies (skill modifiers, echoes) of nested objects.
export function contentNestedText(
  entry: IsContentItem,
  field: string,
  english: string,
): string {
  const source = getEntry<IsContentItem>(entry.id) ?? entry;
  const path = Object.entries(contentFieldsCached(source)).find(
    ([candidate, text]) =>
      text === english &&
      (candidate === field || candidate.endsWith(`.${field}`)),
  )?.[0];
  if (!path) return english;

  return i18nContent()[source.__type]?.[source.name]?.[path] ?? english;
}

export function contentName(entry: IsContentItem): string {
  return contentText(entry, 'name');
}

export function contentNameById(id: string): string | undefined {
  const entry = getEntry<IsContentItem>(id);
  return entry ? contentName(entry) : undefined;
}

export function contentDescription(entry: IsContentItem): string {
  return contentText(entry, 'description');
}

export function nodeNameText(nodeName: string): string {
  return i18nNodes()[nodeName] ?? nodeName;
}
