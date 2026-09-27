// Each version is an <h1> followed by its section headings and lists, so a split before every <h1> yields one chunk per version.
export function changelogSplitSections(html: string): string[] {
  return html
    .split(/(?=<h1[\s>])/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);
}
