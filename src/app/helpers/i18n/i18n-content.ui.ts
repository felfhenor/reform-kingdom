import { contentName } from '@helpers/i18n/i18n-content';
import type { IsContentItem } from '@interfaces';

// ng-select searches its bindLabel (the English name) unless given this.
export function contentSearchFn(term: string, entry: IsContentItem): boolean {
  return contentName(entry).toLowerCase().includes(term.toLowerCase());
}
