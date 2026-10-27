const cssColorCache = new Map<string, string>();

// Lets canvas code share the CSS palette; empty reads aren't cached so they can recover.
export function cssColorVar(variable: string): string {
  const cached = cssColorCache.get(variable);
  if (cached) return cached;

  const color = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  if (!color) return '#ffffff';

  cssColorCache.set(variable, color);
  return color;
}

// Call after swapping palettes; the map's throttled refresh then redraws with the new colors.
export function cssColorCacheClear(): void {
  cssColorCache.clear();
}
