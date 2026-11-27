import { isArray, isObject, isString, sortBy } from 'es-toolkit/compat';
import type { ContentRef, ContentRefResolve } from '@interfaces';

function contentRefsKeyType(key: string, types: string[]): string | undefined {
  const lowerKey = key.toLowerCase();
  // Longest match wins: `tradeskillId` contains both `skill` and `tradeskill`.
  return sortBy(
    [...types].reverse().filter((type) => lowerKey.includes(type)),
    (type) => type.length,
  ).at(-1);
}

function contentRefsRewriteChildren(
  value: unknown,
  types: string[],
  resolve: ContentRefResolve,
): void {
  if (isArray(value)) {
    value.forEach((sub) => {
      if (isObject(sub)) {
        contentRefsRewrite(sub as Record<string, unknown>, types, resolve);
      }
    });
  } else if (isObject(value)) {
    contentRefsRewrite(value as Record<string, unknown>, types, resolve);
  }
}

// Mutates in place: any key naming a content type (and `*Id` keys) has its names swapped through `resolve`.
export function contentRefsRewrite(
  entry: Record<string, unknown>,
  types: string[],
  resolve: ContentRefResolve,
): void {
  Object.keys(entry).forEach((key) => {
    const value = entry[key];
    const type = contentRefsKeyType(key, types);

    if (!type) {
      contentRefsRewriteChildren(value, types, resolve);
      return;
    }

    if (key.toLowerCase().includes('id')) {
      if (isArray(value)) {
        entry[key] = value.map((name: string) => resolve(name, type));
      } else if (value !== 'Any') {
        entry[key] = resolve(value as string, type);
      }
      return;
    }

    if (isArray(value) && isString(value[0])) {
      entry[key] = value.map((name: string) => resolve(name, type));
      return;
    }

    contentRefsRewriteChildren(value, types, resolve);
  });
}

export function contentRefsOf(
  entry: Record<string, unknown>,
  types: string[],
): ContentRef[] {
  const refs: ContentRef[] = [];
  contentRefsRewrite(structuredClone(entry), types, (name, folder) => {
    refs.push({ folder, name });
    return name;
  });
  return refs;
}
