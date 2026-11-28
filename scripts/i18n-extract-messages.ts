/* eslint-disable @typescript-eslint/no-explicit-any */
// Finds literal player-facing messages passed to notify/log helpers, and with --write moves them into gamedata/i18n/en/ui.yml.
// Usage: npm run i18n:extract-messages -- [--write] [path filter]
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import ts from 'typescript';

const ROOT = path.resolve('src/app');
const UI_FILE = path.resolve('gamedata/i18n/en/ui.yml');
// Which argument of each helper is the player-facing message.
const MESSAGE_ARGUMENT: Record<string, number> = {
  notify: 1,
  notifyError: 0,
  notifyWarning: 0,
  notifySuccess: 0,
  notifySaveFailed: 0,
  combatMessageLog: 1,
  categoryMessageLog: 2,
  miscellaneousMessageLog: 0,
};
const SKIPPED = [/[\\/]debug[\\/]/, /\.spec\.ts$/, /[\\/]i18n[\\/]/];
const HAS_WORDS = /[A-Za-z]{2,}/;
const NAMED_PARAMS: Record<string, string> = { ITEM_ICON_TOKEN: 'icon' };

type Found = {
  text: string;
  start: number;
  end: number;
  params: string[];
  key?: string;
};

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
  const stem = path
    .basename(file)
    .replace(/\.component\.ts$/, '')
    .replace(/\.ui\.ts$/, '')
    .replace(/\.ts$/, '');
  return camel(stem.split(/[-.]/));
}

function slug(text: string): string {
  const words = text.replace(/\{\{[^}]*\}\}/g, ' ').match(/[A-Za-z0-9]+/g) ?? [
    'text',
  ];
  const base = camel(words.slice(0, 4));
  return /^[0-9]/.test(base) ? `t${base}` : base;
}

function paramName(expression: string, used: Set<string>): string {
  if (NAMED_PARAMS[expression]) return NAMED_PARAMS[expression];
  const all = [...expression.matchAll(/([A-Za-z_]\w*)(\s*\()?/g)];
  const plain = all.filter((m) => !m[2]).map((m) => m[1]);
  const ids = plain.length > 0 ? plain : all.map((m) => m[1]);
  const name =
    ids.filter((id) => !['this', 'toLocaleString'].includes(id)).at(-1) ??
    'value';
  let candidate = name;
  let n = 2;
  while (used.has(candidate)) candidate = `${name}${n++}`;
  used.add(candidate);
  return candidate;
}

function messageFound(
  node: ts.Expression,
  source: ts.SourceFile,
): Found | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (!HAS_WORDS.test(node.text)) return undefined;
    return {
      text: node.text,
      start: node.getStart(source),
      end: node.getEnd(),
      params: [],
    };
  }
  if (!ts.isTemplateExpression(node)) return undefined;

  const literal = [
    node.head.text,
    ...node.templateSpans.map((s) => s.literal.text),
  ].join(' ');
  if (!HAS_WORDS.test(literal)) return undefined;

  const used = new Set<string>();
  const params: string[] = [];
  let text = node.head.text;
  for (const span of node.templateSpans) {
    const expression = span.expression.getText(source);
    const name = paramName(expression, used);
    params.push(name === expression ? name : `${name}: ${expression}`);
    text += `{{ ${name} }}${span.literal.text}`;
  }
  return { text, start: node.getStart(source), end: node.getEnd(), params };
}

function messageBranches(node: ts.Expression): ts.Expression[] {
  if (ts.isParenthesizedExpression(node))
    return messageBranches(node.expression);
  if (ts.isConditionalExpression(node)) {
    return [
      ...messageBranches(node.whenTrue),
      ...messageBranches(node.whenFalse),
    ];
  }
  return [node];
}

// Sentences glued together with + can't be reordered by a translator; they're reported, not rewritten.
function isConcatenatedText(node: ts.Expression): boolean {
  return (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
    [node.left, node.right].some(
      (side) =>
        isConcatenatedText(side) ||
        ((ts.isStringLiteral(side) || ts.isTemplateExpression(side)) &&
          HAS_WORDS.test(side.getText())),
    )
  );
}

function collect(source: ts.SourceFile, concatenated: string[]): Found[] {
  const out: Found[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const index = MESSAGE_ARGUMENT[node.expression.text];
      const arg = index === undefined ? undefined : node.arguments[index];
      for (const branch of arg ? messageBranches(arg) : []) {
        const found = messageFound(branch, source);
        if (found) out.push(found);
        if (isConcatenatedText(branch))
          concatenated.push(branch.getText(source));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
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

function addImport(text: string): string {
  const existing = /import \{([^}]*)\} from '@helpers\/i18n\/i18n';/.exec(text);
  if (existing) {
    const names = existing[1]
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.includes('t')) return text;
    return text.replace(
      existing[0],
      `import { ${[...names, 't'].sort().join(', ')} } from '@helpers/i18n/i18n';`,
    );
  }
  return `import { t } from '@helpers/i18n/i18n';\n${text}`;
}

const ui: any = yaml.load(fs.readFileSync(UI_FILE, 'utf-8')) ?? {};
let total = 0;
for (const file of walk(ROOT)) {
  if (SKIPPED.some((pattern) => pattern.test(file))) continue;
  if (filter && !file.replace(/\\/g, '/').includes(filter)) continue;

  const content = fs.readFileSync(file, 'utf-8');
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const concatenated: string[] = [];
  const found = collect(source, concatenated);
  concatenated.forEach((text) =>
    console.log(`${path.relative(ROOT, file)} concatenated: ${text}`),
  );
  if (found.length === 0) continue;
  total += found.length;

  if (!write) {
    console.log(`${path.relative(ROOT, file)} (${found.length})`);
    found.forEach((item) => console.log(`  ${item.text}`));
    continue;
  }

  assignKeys(found, groupName(file), ui);
  const updated = [...found]
    .sort((a, b) => b.start - a.start)
    .reduce((text, item) => {
      const args =
        item.params.length > 0 ? `, { ${item.params.join(', ')} }` : '';
      return `${text.slice(0, item.start)}t('${item.key}'${args})${text.slice(item.end)}`;
    }, content);
  fs.writeFileSync(file, addImport(updated));
}

if (write) fs.writeFileSync(UI_FILE, yaml.dump(ui, { lineWidth: -1 }));
console.log(`${total} literal message(s)${write ? ' moved to ui.yml' : ''}.`);
