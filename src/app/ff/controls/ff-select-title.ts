// Popup titles are Proper Case regardless of how the placeholder or label was written.
export function ffTitleCase(text: string): string {
  return text.replace(
    /(^|\s)(\p{L})/gu,
    (_, space: string, letter: string) => space + letter.toUpperCase(),
  );
}

// "Select a gather location..." -> "Gather Location"; undefined when nothing is left.
export function ffSelectTitleFromPlaceholder(
  placeholder: string | undefined,
): string | undefined {
  const core = (placeholder ?? '')
    .replace(/^\s*(select|choose|pick)\s+(an?\s+|the\s+)?/i, '')
    .replace(/(\.{3}|…)\s*$/, '')
    .trim();
  return core ? ffTitleCase(core) : undefined;
}
