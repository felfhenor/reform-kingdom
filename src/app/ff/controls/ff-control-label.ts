const LABEL_SELECTOR = '.type-label, .label-text, label, .type-section-title';
const LABEL_SEARCH_DEPTH = 4;

// The label a control sits under: earlier siblings first, then up a few ancestors.
export function ffNearestControlLabel(element: Element): string | undefined {
  let node: Element | null = element;
  for (let depth = 0; node && depth < LABEL_SEARCH_DEPTH; depth++) {
    for (
      let sibling = node.previousElementSibling;
      sibling;
      sibling = sibling.previousElementSibling
    ) {
      const label = sibling.matches(LABEL_SELECTOR)
        ? sibling
        : sibling.querySelector(LABEL_SELECTOR);
      const text = label?.textContent?.trim();
      if (text) return text;
    }
    node = node.parentElement;
  }
  return undefined;
}
