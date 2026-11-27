import {
  allContentById,
  allIdsByName,
  contentPatch,
  unfurlContent,
} from '@helpers/content/content';
import { contentTypeList } from '@helpers/content/content-initializers';
import { contentRefsRewrite } from '@helpers/content/content-refs';
import type {
  ContentRefResolve,
  ContentType,
  IsContentItem,
  ModBundle,
} from '@interfaces';

function modOwnNames(
  content: Record<string, IsContentItem[]>,
): Record<string, Record<string, string>> {
  const names: Record<string, Record<string, string>> = {};
  Object.entries(content).forEach(([type, entries]) => {
    names[type] ??= {};
    entries.forEach((entry) => {
      if (entry.name) names[type][entry.name] = entry.id;
    });
  });
  return names;
}

// The mod's own names first, then anything already loaded (base game and earlier mods); a known id passes through.
function modResolver(
  content: Record<string, IsContentItem[]>,
  errors: string[],
): ContentRefResolve {
  const own = modOwnNames(content);
  const idsByName = allIdsByName();
  const contentById = allContentById();

  return (name, type) => {
    const id = own[type]?.[name] ?? idsByName.get(name) ?? name;
    const loaded = contentById.get(id);
    const isOwn = Object.values(own[type] ?? {}).includes(id);
    if (!isOwn && loaded?.__type !== type) {
      errors.push(`"${name}" is not a known ${type}.`);
    }
    return id;
  };
}

function modContentSplit(content: Record<string, IsContentItem[]>): {
  adds: Record<string, IsContentItem[]>;
  patches: IsContentItem[];
} {
  const contentById = allContentById();
  const adds: Record<string, IsContentItem[]> = {};
  const patches: IsContentItem[] = [];

  Object.entries(content).forEach(([type, entries]) => {
    entries.forEach((entry) => {
      const typed = { ...entry, __type: type as ContentType };
      if (contentById.has(entry.id)) patches.push(typed);
      else (adds[type] ??= []).push(typed);
    });
  });

  return { adds, patches };
}

function modContentValidate(
  content: Record<string, IsContentItem[]>,
  errors: string[],
): void {
  const contentById = allContentById();
  Object.entries(content).forEach(([type, entries]) => {
    entries.forEach((entry) => {
      if (!entry.id) errors.push(`An entry in ${type}/ has no id.`);
      else if (!contentById.has(entry.id) && !entry.name) {
        errors.push(`New ${type} "${entry.id}" has no name.`);
      }
    });
  });
}

function modContentResolve(
  content: Record<string, IsContentItem[]>,
  errors: string[],
): void {
  const contentTypes = contentTypeList();
  const resolve = modResolver(content, errors);
  Object.values(content).forEach((entries) =>
    entries.forEach((entry) =>
      contentRefsRewrite(
        entry as Record<string, unknown>,
        contentTypes,
        resolve,
      ),
    ),
  );
}

export function modApplyContent(bundle: ModBundle): string[] {
  const errors: string[] = [];
  const content = structuredClone(bundle.content);
  modContentValidate(content, errors);
  if (errors.length > 0) return errors;

  modContentResolve(content, errors);
  const { adds, patches } = modContentSplit(content);
  unfurlContent(adds, (message) => errors.push(message));
  patches.forEach((patch) => {
    const error = contentPatch(patch, patch.__type);
    if (error) errors.push(error);
  });

  return errors;
}
