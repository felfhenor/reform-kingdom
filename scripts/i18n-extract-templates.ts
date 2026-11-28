/* eslint-disable @typescript-eslint/no-explicit-any */
// Finds player-facing literal text in component templates, and with --write moves it into gamedata/i18n/en/ui.yml.
// Usage: npm run i18n:extract-templates -- [--write] [path filter]
import { parseTemplate } from '@angular/compiler';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

const ROOT = path.resolve('src/app');
const UI_FILE = path.resolve('gamedata/i18n/en/ui.yml');
const SKIPPED = [
  /[\\/]pages[\\/]debug[\\/]/,
  /[\\/]input-analysis[\\/]/,
  /[\\/]panel-options-debug[\\/]/,
  /[\\/]panel-debug-/,
];
const TEXT_ATTRIBUTES = [
  'placeholder',
  'title',
  'aria-label',
  'alt',
  'text',
  'confirmButtonText',
  'cancelButtonText',
  'denyButtonText',
  'ffPadLabel',
  'ffSelect',
  'ffStepper',
  'tp',
];
const HAS_WORDS = /[A-Za-z]{2,}/;

type Edit = { start: number; end: number; text: string };
type Found = { kind: string; text: string; edit: Edit; key?: string };

const write = process.argv.includes('--write');
const filter = process.argv.slice(2).find((arg) => !arg.startsWith('--'));

function camel(words: string[]): string {
  return words
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');
}

function groupName(file: string): string {
  const stem = path.basename(file).replace(/\.component\.(html|ts)$/, '');
  return camel(stem.split('-'));
}

function slug(text: string): string {
  const words = text.replace(/\{\{[^}]*\}\}/g, ' ').match(/[A-Za-z0-9]+/g) ?? [
    'text',
  ];
  const base = camel(words.slice(0, 4));
  return /^[0-9]/.test(base) ? `t${base}` : base;
}

function paramName(expression: string, used: Set<string>): string {
  const head = expression.split('|')[0];
  // Prefer the data over method names, so `x.names.join(', ')` reads as `names`.
  const all = [...head.matchAll(/([A-Za-z_]\w*)(\s*\()?/g)];
  const plain = all.filter((m) => !m[2]).map((m) => m[1]);
  const ids = plain.length > 0 ? plain : all.map((m) => m[1]);
  let name = (ids.filter((id) => id !== 'this').at(-1) ?? 'value').replace(
    /^_+/,
    '',
  );
  if (!name) name = 'value';
  let candidate = name;
  let n = 2;
  while (used.has(candidate)) candidate = `${name}${n++}`;
  used.add(candidate);
  return candidate;
}

// Translated text is interpolated, not parsed as HTML, so entities are stored as the characters they stand for.
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  middot: '·',
  times: '×',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rarr: '→',
  larr: '←',
  bull: '•',
};

function decodeEntity(match: string, name: string): string {
  if (name.startsWith('#')) {
    const code =
      name[1].toLowerCase() === 'x'
        ? parseInt(name.slice(2), 16)
        : parseInt(name.slice(1), 10);
    return String.fromCodePoint(code);
  }
  return NAMED_ENTITIES[name.toLowerCase()] ?? match;
}

function trimmedRange(source: string, start: number, end: number) {
  const raw = source.slice(start, end);
  const lead = raw.length - raw.trimStart().length;
  const trail = raw.length - raw.trimEnd().length;
  return { start: start + lead, end: end - trail };
}

// Text (with optional {{ }} interpolations) becomes one translation with named params.
function textEdit(
  source: string,
  start: number,
  end: number,
): Found | undefined {
  const range = trimmedRange(source, start, end);
  const raw = source.slice(range.start, range.end);
  const literal = raw
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, ' ');
  if (!HAS_WORDS.test(literal)) return undefined;

  const used = new Set<string>();
  const params: string[] = [];
  const english = raw
    .replace(/\{\{([\s\S]*?)\}\}/g, (_, expression: string) => {
      const name = paramName(expression.trim(), used);
      params.push(`${name}: (${expression.trim()})`);
      return `{{ ${name} }}`;
    })
    .replace(/\s+/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, decodeEntity);
  const args = params.length > 0 ? `: { ${params.join(', ')} }` : '';
  return {
    kind: 'text',
    text: english,
    edit: {
      start: range.start,
      end: range.end,
      text: `{{ '%KEY%' | t${args} }}`,
    },
  };
}

function attributeEdits(node: any, source: string): Found[] {
  const found: Found[] = [];
  for (const attr of node.attributes ?? []) {
    if (!TEXT_ATTRIBUTES.includes(attr.name) || !HAS_WORDS.test(attr.value))
      continue;
    const span = attr.sourceSpan;
    found.push({
      kind: `attr:${attr.name}`,
      text: attr.value,
      edit: {
        start: span.start.offset,
        end: span.end.offset,
        text: `[${attr.name}]="'%KEY%' | t"`,
      },
    });
  }
  for (const input of node.inputs ?? []) {
    if (!TEXT_ATTRIBUTES.includes(input.name)) continue;
    const valueSpan = input.valueSpan;
    if (!valueSpan) continue;
    const expr = source
      .slice(valueSpan.start.offset, valueSpan.end.offset)
      .trim();
    const literal = /^'([^'\\]*)'$/.exec(expr);
    if (!literal || !HAS_WORDS.test(literal[1])) continue;
    found.push({
      kind: `bound:${input.name}`,
      text: literal[1],
      edit: {
        start: valueSpan.start.offset,
        end: valueSpan.end.offset,
        text: `'%KEY%' | t`,
      },
    });
  }
  return found;
}

const DISPLAY_INPUTS = [
  ...TEXT_ATTRIBUTES,
  'label',
  'heading',
  'description',
  'message',
  'emptyMessage',
  'searchPlaceholder',
  'tooltip',
  'helpText',
  'textContent',
  'badge',
];
const LITERAL = /'((?:\\'|[^'])*)'/g;
const ANALYTICS_ID = /^[\w-]+:[\w:-]*$/;
const CSS_CLASSES = /^[a-z0-9-:/[\]]+( [a-z0-9-:/[\]]+)*$/;

// Literals compared against or passed to calls are identifiers, not text.
function isIdentifierPosition(
  expr: string,
  start: number,
  end: number,
): boolean {
  const before = expr.slice(0, start).trimEnd();
  const after = expr.slice(end).trimStart();
  return (
    /(===|!==|==|!=|\(|\[|,)$/.test(before) || /^(===|!==|==|!=)/.test(after)
  );
}

function isDisplayText(text: string): boolean {
  return (
    HAS_WORDS.test(text) &&
    (/\s/.test(text) || /^[A-Z][a-z]/.test(text)) &&
    !ANALYTICS_ID.test(text) &&
    !CSS_CLASSES.test(text)
  );
}

// English string literals inside an expression, e.g. `paused() ? 'Resume' : 'Pause'`.
function expressionLiteralEdits(
  source: string,
  start: number,
  end: number,
): Found[] {
  const expr = source.slice(start, end);
  const found: Found[] = [];
  for (const match of expr.matchAll(LITERAL)) {
    const text = match[1].replace(/\\'/g, "'");
    const from = match.index;
    const to = from + match[0].length;
    if (!isDisplayText(text) || isIdentifierPosition(expr, from, to)) continue;
    found.push({
      kind: 'expr',
      text,
      edit: { start: start + from, end: start + to, text: `('%KEY%' | t)` },
    });
  }
  return found;
}

function interpolationEdits(
  source: string,
  start: number,
  end: number,
): Found[] {
  const raw = source.slice(start, end);
  return [...raw.matchAll(/\{\{([\s\S]*?)\}\}/g)].flatMap((m) => {
    const exprStart = start + m.index + 2;
    return expressionLiteralEdits(source, exprStart, exprStart + m[1].length);
  });
}

function boundInputEdits(node: any, source: string): Found[] {
  return (node.inputs ?? []).flatMap((input: any) => {
    if (!DISPLAY_INPUTS.includes(input.name) || !input.valueSpan) return [];
    return expressionLiteralEdits(
      source,
      input.valueSpan.start.offset,
      input.valueSpan.end.offset,
    );
  });
}

function collectExpressions(nodes: any[], source: string, out: Found[]): void {
  for (const node of nodes) {
    const name = node.constructor.name;
    if (name === 'BoundText') {
      out.push(
        ...interpolationEdits(
          source,
          node.sourceSpan.start.offset,
          node.sourceSpan.end.offset,
        ),
      );
    }
    if (name === 'Element' || name === 'Template') {
      out.push(...boundInputEdits(node, source));
    }
    collectExpressions(children(node), source, out);
  }
}

function children(node: any): any[] {
  return [
    ...(node.children ?? []),
    ...(node.branches ?? []),
    ...(node.cases ?? []),
    ...(node.empty ? [node.empty] : []),
    ...(node.placeholder ? [node.placeholder] : []),
    ...(node.loading ? [node.loading] : []),
    ...(node.error ? [node.error] : []),
  ];
}

function collect(nodes: any[], source: string, out: Found[]): void {
  // Adjacent text and interpolation nodes form one sentence, so they're translated together.
  let run: any[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const start = run[0].sourceSpan.start.offset;
    const end = run.at(-1).sourceSpan.end.offset;
    // Comments aren't nodes, so a run can span one; each side is its own text.
    const raw = source.slice(start, end);
    let cursor = 0;
    for (const comment of raw.matchAll(/<!--[\s\S]*?-->/g)) {
      const found = textEdit(source, start + cursor, start + comment.index);
      if (found) out.push(found);
      cursor = comment.index + comment[0].length;
    }
    const found = textEdit(source, start + cursor, end);
    if (found) out.push(found);
    run = [];
  };
  for (const node of nodes) {
    const name = node.constructor.name;
    if (name === 'Text' || name === 'BoundText') {
      run.push(node);
      continue;
    }
    flush();
    if (name === 'Element' || name === 'Template') {
      out.push(...attributeEdits(node, source));
    }
    collect(children(node), source, out);
  }
  flush();
}

function templateFound(source: string, file: string): Found[] {
  const parsed = parseTemplate(source, file, { preserveWhitespaces: true });
  const out: Found[] = [];
  collect(parsed.nodes, source, out);
  const expressions: Found[] = [];
  collectExpressions(parsed.nodes, source, expressions);
  // Literals inside text or attributes already being moved get picked up on the next run.
  const free = expressions.filter(
    (item) =>
      !out.some(
        (o) => item.edit.start < o.edit.end && o.edit.start < item.edit.end,
      ),
  );
  return [...out, ...free];
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.component\.(html|ts)$/.test(entry.name) ? [full] : [];
  });
}

// Inline templates live in a backtick string inside the component.
function inlineTemplate(
  ts: string,
): { start: number; end: number } | undefined {
  const match = /\btemplate:\s*`/.exec(ts);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  const end = ts.indexOf('`', start);
  return end > start ? { start, end } : undefined;
}

function assignKeys(found: Found[], group: string, ui: any): void {
  const section = (ui[group] ??= {});
  const byText = new Map<string, string>(
    Object.entries(section).flatMap(([k, v]) =>
      typeof v === 'string' ? [[v, k]] : [],
    ),
  );
  for (const item of found) {
    let key = byText.get(item.text);
    if (!key) {
      const base = slug(item.text);
      key = base;
      let n = 2;
      while (key in section) key = `${base}${n++}`;
      section[key] = item.text;
      byText.set(item.text, key);
    }
    item.key = `${group}.${key}`;
  }
}

function applyEdits(source: string, offset: number, found: Found[]): string {
  return [...found]
    .sort((a, b) => b.edit.start - a.edit.start)
    .reduce(
      (text, item) =>
        text.slice(0, offset + item.edit.start) +
        item.edit.text.replace('%KEY%', item.key!) +
        text.slice(offset + item.edit.end),
      source,
    );
}

function registerPipe(tsFile: string): void {
  let ts = fs.readFileSync(tsFile, 'utf-8');
  if (/\bTPipe\b/.test(ts)) return;
  if (/\n  imports: \[/.test(ts)) {
    ts = ts.replace(/\n  imports: \[/, '\n  imports: [\n    TPipe,');
  } else {
    ts = ts.replace(/(\n  selector: '[^']+',)/, '$1\n  imports: [TPipe],');
  }
  ts = `import { TPipe } from '@pipes/t.pipe';\n${ts}`;
  fs.writeFileSync(tsFile, ts);
}

const ui: any = yaml.load(fs.readFileSync(UI_FILE, 'utf-8')) ?? {};
let total = 0;
const files = walk(ROOT).filter(
  (file) =>
    !SKIPPED.some((pattern) => pattern.test(file)) &&
    (!filter || file.replace(/\\/g, '/').includes(filter)),
);

for (const file of files) {
  const isTs = file.endsWith('.ts');
  const content = fs.readFileSync(file, 'utf-8');
  const inline = isTs ? inlineTemplate(content) : undefined;
  if (isTs && !inline) continue;
  const source = inline ? content.slice(inline.start, inline.end) : content;

  const found = templateFound(source, file);
  if (found.length === 0) continue;
  total += found.length;

  if (!write) {
    console.log(`${path.relative(ROOT, file)} (${found.length})`);
    found.forEach((item) => console.log(`  ${item.kind}: ${item.text}`));
    continue;
  }

  assignKeys(found, groupName(file), ui);
  fs.writeFileSync(file, applyEdits(content, inline?.start ?? 0, found));
  registerPipe(isTs ? file : file.replace(/\.html$/, '.ts'));
}

if (write) {
  fs.writeFileSync(UI_FILE, yaml.dump(ui, { lineWidth: -1 }));
}
console.log(`${total} literal text item(s)${write ? ' moved to ui.yml' : ''}.`);
