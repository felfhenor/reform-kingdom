/* eslint-disable @typescript-eslint/no-explicit-any */
// Composites capsule art from existing game art only; see README.md.
import fs from 'fs-extra';
import path from 'path';
import { chromium } from 'playwright';
import readline from 'readline/promises';
import { CAPSULE_PRESETS } from './presets';
import type { CapsuleGearSelector, CapsulePreset } from './types';
import { CAPSULE_SIZES } from './types';

const OUTPUT_DIR = path.resolve('scripts/capsule/output');
const FONT_PATH = path.resolve('public/font/GeistPixel-Square.woff2');

const dataUrl = (file: string, mime = 'image/png') =>
  `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;

const spriteUrl = (kind: string, sprite: string) =>
  dataUrl(path.resolve('gameassets', kind, `${sprite}.png`));

const byName = (list: any[], kind: string, name: string) => {
  const found = list.find((entry) => entry.name === name);
  if (!found) throw new Error(`No ${kind} named "${name}".`);
  return found;
};

const gearSelect = (equipment: any[], selector: CapsuleGearSelector) =>
  equipment.filter((item) => {
    if (!item.sprite) return false;
    if (selector.names && !selector.names.includes(item.name)) return false;
    if (
      selector.nameIncludes &&
      !selector.nameIncludes.some((part) => item.name.includes(part))
    )
      return false;
    if (
      selector.levelRange &&
      (item.levelRequirement < selector.levelRange[0] ||
        item.levelRequirement > selector.levelRange[1])
    )
      return false;
    if (selector.types && !selector.types.includes(item.type)) return false;
    return true;
  });

// mulberry32, so a seed always gives the same layout
const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const mapLoad = (name: string) => {
  const mapPath = path.resolve('gamemaps', `${name}.json`);
  const map = fs.readJsonSync(mapPath);

  const tilesets = map.tilesets.map((tileset: any) => {
    const tsjPath = path.resolve(path.dirname(mapPath), tileset.source);
    const tsj = fs.readJsonSync(tsjPath);
    return {
      firstgid: tileset.firstgid,
      columns: tsj.columns,
      tilewidth: tsj.tilewidth,
      tileheight: tsj.tileheight,
      image: dataUrl(path.resolve(path.dirname(tsjPath), tsj.image)),
    };
  });

  const nodes: Record<string, [number, number]> = {};
  map.layers
    .filter((layer: any) => layer.name === 'Explore Nodes')
    .flatMap((layer: any) => layer.objects)
    .forEach((node: any) => {
      // tile objects are anchored at their bottom-left
      nodes[node.name] = [node.x + node.width / 2, node.y - node.height / 2];
    });

  return { map, tilesets, nodes };
};

// Everything random is decided here, so the page itself is deterministic.
const sceneBuild = (preset: CapsulePreset, withTitle: boolean) => {
  const random = seededRandom(preset.seed);
  const between = (min: number, max: number) => min + random() * (max - min);

  const [width, height] =
    typeof preset.size === 'string' ? CAPSULE_SIZES[preset.size] : preset.size;

  const jobs = fs.readJsonSync('public/json/job.json');
  const monsters = fs.readJsonSync('public/json/monster.json');
  const equipment = fs.readJsonSync('public/json/equipment.json');

  const { map, tilesets, nodes } = mapLoad(preset.map.name);
  const focus = nodes[preset.map.focus];
  if (!focus)
    throw new Error(
      `No node "${preset.map.focus}" on ${preset.map.name}. Nodes: ${Object.keys(nodes).join(', ')}`,
    );

  const scale = preset.map.scale;
  const mapLeft = Math.round(focus[0] * scale - width / 2);
  const mapTop = Math.round(focus[1] * scale - height / 2);
  if (
    mapLeft < 0 ||
    mapTop < 0 ||
    mapLeft + width > map.width * map.tilewidth * scale ||
    mapTop + height > map.height * map.tileheight * scale
  ) {
    throw new Error(
      `Centering ${preset.map.focus} at ${scale}x runs off the edge of ${preset.map.name}. Raise map.scale.`,
    );
  }

  const gear = gearSelect(equipment, preset.whirl.gear);
  if (gear.length === 0) throw new Error('Gear selector matched nothing.');

  // seeded Fisher-Yates; dealing in order means nothing repeats until the whole deck is used
  const deck = [...gear];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const whirl = preset.whirl;
  let dealt = 0;
  const rings = whirl.rings.map((ring) => {
    const phase = random() * 360;
    return {
      radius: ring.radius,
      height: ring.height ?? 0,
      tilt: ring.tilt,
      items: Array.from({ length: ring.items }, (_, i) => ({
        src: spriteUrl('equipment', deck[dealt++ % deck.length].sprite),
        angle: phase + (i * 360) / ring.items,
        // equipment art points up-right, so -45 lays it along the ring
        spin: -45 + between(-whirl.tumble, whirl.tumble),
        yaw: between(-whirl.tumble, whirl.tumble),
        pitch: between(-whirl.tumble, whirl.tumble),
      })),
    };
  });

  const party = preset.party;
  const member = (kind: string, sprite: string) => ({
    src: spriteUrl(kind, sprite),
  });

  return {
    width,
    height,
    font: dataUrl(FONT_PATH, 'font/woff2'),
    map: {
      layers: map.layers,
      width: map.width,
      height: map.height,
      tilewidth: map.tilewidth,
      tileheight: map.tileheight,
      tilesets,
      scale,
      left: mapLeft,
      top: mapTop,
      brightness: preset.map.brightness,
    },
    whirl: {
      rings,
      itemScale: whirl.itemScale,
      cameraTilt: whirl.cameraTilt,
      perspective: whirl.perspective,
      backBrightness: whirl.backBrightness,
      clearRadius: whirl.clearRadius ?? 0,
      focus: [width / 2, height / 2],
      center: [
        width / 2 + (whirl.center?.[0] ?? 0),
        height / 2 + (whirl.center?.[1] ?? 0),
      ],
    },
    party: {
      ...party,
      heroes: party.heroes.map((name) =>
        member('job', byName(jobs, 'job', name).sprite),
      ),
      monsters: party.monsters.map((name) =>
        member('monster', byName(monsters, 'monster', name).sprite),
      ),
    },
    title: withTitle ? preset.title : undefined,
  };
};

type Scene = ReturnType<typeof sceneBuild>;

// Runs in the browser and must be self-contained, since it's sent over as source.
// Everything goes through one canvas with smoothing off, since CSS 3D transforms filter bilinearly.
function scenePaint(scene: Scene) {
  const SPRITE = 64;
  const canvas = document.getElementById('stage') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const imageLoad = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const mapPaint = async () => {
    const m = scene.map;
    const sheets = await Promise.all(
      m.tilesets.map((ts: any) => imageLoad(ts.image)),
    );
    const full = document.createElement('canvas');
    full.width = m.width * m.tilewidth;
    full.height = m.height * m.tileheight;
    const fullCtx = full.getContext('2d')!;

    const FLIP_H = 0x80000000;
    const FLIP_V = 0x40000000;
    const FLIP_D = 0x20000000;
    const tileDraw = (rawGid: number, x: number, y: number) => {
      const gid = rawGid & 0x1fffffff;
      if (!gid) return;
      let index = 0;
      m.tilesets.forEach((ts: any, i: number) => {
        if (ts.firstgid <= gid) index = i;
      });
      const ts = m.tilesets[index];
      const local = gid - ts.firstgid;
      const sx = (local % ts.columns) * ts.tilewidth;
      const sy = Math.floor(local / ts.columns) * ts.tileheight;
      fullCtx.save();
      fullCtx.translate(x + ts.tilewidth / 2, y + ts.tileheight / 2);
      // canvas applies the last transform first, and Tiled flips diagonally before horizontal/vertical
      fullCtx.scale(rawGid & FLIP_H ? -1 : 1, rawGid & FLIP_V ? -1 : 1);
      if (rawGid & FLIP_D) fullCtx.transform(0, 1, 1, 0, 0, 0);
      fullCtx.drawImage(
        sheets[index],
        sx,
        sy,
        ts.tilewidth,
        ts.tileheight,
        -ts.tilewidth / 2,
        -ts.tileheight / 2,
        ts.tilewidth,
        ts.tileheight,
      );
      fullCtx.restore();
    };

    m.layers.forEach((layer: any) => {
      if (layer.visible === false) return;
      if (layer.type === 'tilelayer') {
        layer.data.forEach((gid: number, i: number) =>
          tileDraw(
            gid,
            (i % m.width) * m.tilewidth,
            Math.floor(i / m.width) * m.tileheight,
          ),
        );
      }
      if (layer.type === 'objectgroup') {
        layer.objects
          .filter((o: any) => o.gid)
          .forEach((o: any) => tileDraw(o.gid, o.x, o.y - o.height));
      }
    });

    ctx.filter = `brightness(${m.brightness})`;
    ctx.drawImage(
      full,
      -m.left,
      -m.top,
      full.width * m.scale,
      full.height * m.scale,
    );
    ctx.filter = 'none';
  };

  // a transparent border so the antialiased edges of a rotated draw only touch transparent pixels
  const padded = (img: HTMLImageElement) => {
    const pad = document.createElement('canvas');
    pad.width = img.width + 2;
    pad.height = img.height + 2;
    pad.getContext('2d')!.drawImage(img, 1, 1);
    return pad;
  };

  type Rect = [number, number, number, number];

  const opaqueBounds = (src: CanvasImageSource, w: number, h: number): Rect => {
    const probe = document.createElement('canvas');
    probe.width = w;
    probe.height = h;
    const probeCtx = probe.getContext('2d', { willReadFrequently: true })!;
    probeCtx.drawImage(src, 0, 0);
    const alpha = probeCtx.getImageData(0, 0, w, h).data;
    const bounds: Rect = [w, h, 0, 0];
    for (let i = 3; i < alpha.length; i += 4) {
      if (!alpha[i]) continue;
      const x = ((i - 3) / 4) % w;
      const y = Math.floor((i - 3) / 4 / w);
      bounds[0] = Math.min(bounds[0], x);
      bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x + 1);
      bounds[3] = Math.max(bounds[3], y + 1);
    }
    return bounds;
  };

  const KEEP_OUT_MARGIN = 6;
  // an empty zone (fully transparent sprite) comes back inverted, so it never overlaps
  const overlaps = (a: Rect, b: Rect) =>
    b[0] < b[2] &&
    a[0] < b[2] + KEEP_OUT_MARGIN &&
    b[0] - KEEP_OUT_MARGIN < a[2] &&
    a[1] < b[3] + KEEP_OUT_MARGIN &&
    b[1] - KEEP_OUT_MARGIN < a[3];

  const whirlPaint = async (keepOut: Rect[]) => {
    const w = scene.whirl;
    const P = w.perspective;
    const half = (SPRITE * w.itemScale) / 2;
    const project = (m: DOMMatrix, x: number, y: number) => {
      const p = m.transformPoint(new DOMPoint(x, y, 0));
      const s = P / (P - p.z);
      return [w.center[0] + p.x * s, w.center[1] + p.y * s];
    };

    const items = await Promise.all(
      w.rings.flatMap((ring: any) =>
        ring.items.map(async (item: any) => {
          const m = new DOMMatrix(
            [
              `rotateX(${-w.cameraTilt}deg)`,
              `translateY(${ring.height}px)`,
              `rotateX(${ring.tilt[0]}deg) rotateZ(${ring.tilt[1]}deg)`,
              `rotateY(${item.angle}deg) translateZ(${ring.radius}px)`,
              `rotateY(${item.yaw}deg) rotateX(${item.pitch}deg) rotateZ(${item.spin}deg)`,
            ].join(' '),
          );
          return {
            image: padded(await imageLoad(item.src)),
            depth: m.m43,
            nearness: Math.min(1, Math.max(0, (m.m43 / ring.radius + 1) / 2)),
            center: project(m, 0, 0),
            corner: project(m, -half, -half),
            right: project(m, half, -half),
            down: project(m, -half, half),
          };
        }),
      ),
    );

    // perspective is linearised per item, which is invisible at sprite size
    const unit = 2 * half;
    const affine = (it: (typeof items)[number]) =>
      [
        (it.right[0] - it.corner[0]) / unit,
        (it.right[1] - it.corner[1]) / unit,
        (it.down[0] - it.corner[0]) / unit,
        (it.down[1] - it.corner[1]) / unit,
        it.corner[0],
        it.corner[1],
      ] as const;

    // screen bounds of the item's opaque pixels, matching how drawImage places the padded sprite below
    const screenBounds = (it: (typeof items)[number]): Rect => {
      const [a, b, c, d, e, f] = affine(it);
      const s = w.itemScale;
      const [x0, y0, x1, y1] = opaqueBounds(
        it.image,
        it.image.width,
        it.image.height,
      );
      const xs: number[] = [];
      const ys: number[] = [];
      [x0, x1].forEach((px) =>
        [y0, y1].forEach((py) => {
          const lx = (px - 1) * s;
          const ly = (py - 1) * s;
          xs.push(e + a * lx + c * ly);
          ys.push(f + b * lx + d * ly);
        }),
      );
      return [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      ];
    };

    items
      .filter(
        (it) =>
          Math.hypot(it.center[0] - w.focus[0], it.center[1] - w.focus[1]) >=
          w.clearRadius,
      )
      .filter((it) => {
        const bounds = screenBounds(it);
        return !keepOut.some((zone) => overlaps(bounds, zone));
      })
      .sort((a, b) => a.depth - b.depth)
      .forEach((it) => {
        ctx.setTransform(...affine(it));
        ctx.filter = `brightness(${w.backBrightness + (1 - w.backBrightness) * it.nearness})`;
        ctx.drawImage(
          it.image,
          -w.itemScale,
          -w.itemScale,
          it.image.width * w.itemScale,
          it.image.height * w.itemScale,
        );
      });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
  };

  type Placement = {
    img: HTMLImageElement;
    x: number;
    y: number;
    flip: boolean;
    bounds: Rect;
  };

  const partyLayout = async () => {
    const p = scene.party;
    const size = SPRITE * p.scale;
    const ground = Math.round(scene.height * p.groundY);
    const heroes = await Promise.all(
      p.heroes.map((h: any) => imageLoad(h.src)),
    );
    const monsters = await Promise.all(
      p.monsters.map((m: any) => imageLoad(m.src)),
    );
    const placements: Placement[] = [];

    const place = (
      img: HTMLImageElement,
      cx: number,
      feet: number,
      flip = false,
    ) => {
      const x = Math.round(cx - size / 2);
      const y = Math.round(feet - size);
      const [x0, y0, x1, y1] = opaqueBounds(img, SPRITE, SPRITE).map(
        (v) => v * p.scale,
      );
      const bounds: Rect = flip
        ? [x + size - x1, y + y0, x + size - x0, y + y1]
        : [x + x0, y + y0, x + x1, y + y1];
      placements.push({ img, x, y, flip, bounds });
    };

    if (p.layout === 'line') {
      // monsters flank the heroes stepping outward, drawn first so heroes overlap them
      const heroReach =
        ((heroes.length - 1) / 2) * p.spacing + (p.centerGap ?? 0);
      monsters.forEach((img, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const step = Math.floor(i / 2);
        place(
          img,
          scene.width / 2 + side * (heroReach + p.spacing * (0.6 + step * 0.8)),
          ground - size * (0.3 + step * 0.22),
          side < 0,
        );
      });
      heroes.forEach((img, i) => {
        const offset = i - (heroes.length - 1) / 2;
        const gap = Math.sign(offset) * (p.centerGap ?? 0);
        place(
          img,
          scene.width / 2 + offset * p.spacing + gap,
          ground - Math.abs(offset) * size * 0.06,
        );
      });
    } else {
      heroes.forEach((img, i) => {
        const x = scene.width * 0.08 + size / 2 + i * p.spacing;
        place(img, x, ground - (i % 2) * size * 0.12);
      });
      monsters.forEach((img, i) => {
        const x = scene.width * 0.92 - size / 2 - i * p.spacing;
        place(img, x, ground - (i % 2) * size * 0.12 - size * 0.05, true);
      });
    }
    return placements;
  };

  const partyPaint = (placements: Placement[]) => {
    const size = SPRITE * scene.party.scale;
    placements.forEach(({ img, x, y, flip }) => {
      ctx.save();
      ctx.translate(flip ? x + size : x, y);
      ctx.scale(flip ? -1 : 1, 1);
      ctx.drawImage(img, 0, 0, size, size);
      ctx.restore();
    });
  };

  const hexRgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  const titleBuild = async () => {
    const t = scene.title;
    if (!t) return undefined;
    // Geist Pixel's glyphs sit on a 38-unit grid in a 1000-unit em
    const px = t.pixelSize;
    const font = `${(px * 1000) / 38}px GeistPixel`;
    if ((await document.fonts.load(font)).length === 0)
      throw new Error('GeistPixel failed to load.');

    const o = t.outline ? (t.outlineWidth ?? 1) * px : 0;
    const text = document.createElement('canvas');
    const textCtx = text.getContext('2d', { willReadFrequently: true })!;
    textCtx.font = font;
    const metrics = textCtx.measureText(t.text);
    // baseline on a whole pixel keeps the grid aligned; the ascent is rounded up to whole squares
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent / px) * px;
    const descent = Math.ceil(metrics.actualBoundingBoxDescent / px) * px;
    text.width = Math.ceil(metrics.width) + 2 * o + 2 * px;
    text.height = ascent + descent + 2 * o;
    textCtx.font = font;
    textCtx.textBaseline = 'alphabetic';
    textCtx.fillText(t.text, o + px, o + ascent);

    // threshold away the font's antialiasing, then grow the mask into a stepped outline
    const W = text.width;
    const H = text.height;
    const data = textCtx.getImageData(0, 0, W, H);
    const mask = Array.from(
      { length: W * H },
      (_, i) => data.data[i * 4 + 3] >= 128,
    );
    const near = (x: number, y: number) => {
      for (let dy = -o; dy <= o; dy++) {
        for (let dx = -o; dx <= o; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && mask[ny * W + nx])
            return true;
        }
      }
      return false;
    };
    const fill = hexRgb(t.color);
    const edge = t.outline ? hexRgb(t.outline) : fill;
    mask.forEach((on, i) => {
      const rgb = on ? fill : edge;
      const alpha = on || near(i % W, Math.floor(i / W)) ? 255 : 0;
      data.data.set([rgb[0], rgb[1], rgb[2], alpha], i * 4);
    });
    textCtx.putImageData(data, 0, 0);

    const x = Math.round(t.x * scene.width - W / 2);
    const y = Math.round(t.y * scene.height - o);
    const [x0, y0, x1, y1] = opaqueBounds(text, W, H);
    return { text, x, y, bounds: [x + x0, y + y0, x + x1, y + y1] as Rect };
  };

  return (async () => {
    const placements = await partyLayout();
    const title = await titleBuild();
    await mapPaint();
    await whirlPaint([
      ...placements.map((pl) => pl.bounds),
      ...(title ? [title.bounds] : []),
    ]);
    partyPaint(placements);
    if (title) ctx.drawImage(title.text, title.x, title.y);
    return canvas.toDataURL('image/png');
  })();
}

const pageHtml = (scene: Scene) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: 'GeistPixel'; src: url(${scene.font}) format('woff2'); }
html, body { margin: 0; background: #000; }
canvas { display: block; image-rendering: pixelated; }
</style></head><body><canvas id="stage" width="${scene.width}" height="${scene.height}"></canvas></body></html>`;

const argsParse = (args: string[]) => {
  const flags = new Set<string>();
  const positional: string[] = [];
  let seed: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed') {
      seed = Number(args[++i]);
      if (!Number.isInteger(seed)) throw new Error('--seed needs an integer.');
    } else if (args[i].startsWith('--')) flags.add(args[i]);
    else positional.push(args[i]);
  }
  return {
    target: positional[0],
    seed,
    withTitle: !flags.has('--no-title'),
    hold: flags.has('--hold'),
  };
};

const run = async () => {
  const { target, seed, withTitle, hold } = argsParse(process.argv.slice(2));

  if (!target || (target !== 'all' && !CAPSULE_PRESETS[target])) {
    console.log(
      `Usage: npm run capsule -- <preset|all> [--seed N] [--no-title] [--hold]\nPresets: ${Object.keys(CAPSULE_PRESETS).join(', ')}`,
    );
    process.exit(1);
  }

  const names = target === 'all' ? Object.keys(CAPSULE_PRESETS) : [target];
  fs.ensureDirSync(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: !hold });
  for (const name of names) {
    const preset = { ...CAPSULE_PRESETS[name] };
    if (seed !== undefined) preset.seed = seed;

    const scene = sceneBuild(preset, withTitle);
    const page = await browser.newPage({
      viewport: { width: scene.width, height: scene.height },
      deviceScaleFactor: 1,
    });
    await page.setContent(pageHtml(scene));
    // read pixels straight off the canvas so the browser compositor never touches them
    const png = (await page.evaluate(
      `(${scenePaint.toString()})(${JSON.stringify(scene)})`,
    )) as string;

    const suffix = [
      seed !== undefined ? `seed${seed}` : '',
      withTitle ? '' : 'notitle',
    ]
      .filter(Boolean)
      .join('-');
    const file = path.join(
      OUTPUT_DIR,
      `${name}${suffix ? `-${suffix}` : ''}.png`,
    );
    fs.writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
    console.log(`Wrote ${path.relative(process.cwd(), file)}`);

    if (!hold) await page.close();
  }

  if (hold) {
    const prompt = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    await prompt.question('Holding the browser open. Press Enter to close.');
    prompt.close();
  }
  await browser.close();
};

run();
