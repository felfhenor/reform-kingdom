import { HttpClient } from '@angular/common/http';
import type { WritableSignal } from '@angular/core';
import { computed, inject, Injectable, signal } from '@angular/core';
import { LOADING_PRELOAD_IMAGES } from '@helpers/config';
import { unfurlContent } from '@helpers/content/content';
import { allMaps, setAllMaps } from '@helpers/maps';
import { tiledMapsTilesetImagePaths } from '@helpers/pixi/tiled-map';
import type { GameMap, IsContentItem, TiledMap } from '@interfaces';
import { LoggerService } from '@services/logger.service';
import { MetaService } from '@services/meta.service';
import { lastValueFrom } from 'rxjs';

type ArtAtlases = Record<
  string,
  Record<string, { x: number; y: number; width: number; height: number }>
>;

@Injectable({
  providedIn: 'root',
})
export class ContentService {
  private metaService = inject(MetaService);
  private logger = inject(LoggerService);
  private http = inject(HttpClient);

  private artSignals: Array<WritableSignal<boolean>> = [];
  public artImages = signal<Record<string, HTMLImageElement>>({});
  // Gated on the atlases, which create artSignals; otherwise this memoizes `true` off the initial empty list.
  public hasLoadedArt = computed(
    () => this.hasLoadedAtlases() && this.artSignals.every((s) => s()),
  );
  public hasLoadedAtlases = signal<boolean>(false);
  public hasLoadedData = signal<boolean>(false);
  public hasLoadedMaps = signal<boolean>(false);
  public hasLoadedMapArt = signal<boolean>(false);
  public hasLoadedUIArt = signal<boolean>(false);
  private uiImages: HTMLImageElement[] = [];

  public artAtlases = signal<ArtAtlases>({});

  public hasLoaded = computed(
    () =>
      this.hasLoadedArt() &&
      this.hasLoadedData() &&
      this.hasLoadedAtlases() &&
      this.hasLoadedMaps(),
  );

  async init() {
    // Every content URL is versioned; building them before the version lands makes the preloads miss what's displayed later.
    await this.metaService.loadLocalVersion();

    void this.loadJSON();
    void this.loadUIArt();
    await Promise.all([this.loadArt(), this.loadMaps()]);
    await this.loadMapArt();
  }

  public toCacheBustURL(url: string): string {
    return `${url}?v=${encodeURIComponent(this.metaService.versionString())}`;
  }

  private async loadArt() {
    const req = this.http.get<ArtAtlases>(
      this.toCacheBustURL(`./art/spritesheets/all.json`),
    );

    const allAtlases = await lastValueFrom(req);

    this.artAtlases.set(allAtlases);
    this.logger.info('Content:LoadArt', 'Loaded atlases.');

    const spritesheetsToLoad = Object.keys(allAtlases);

    this.artSignals = spritesheetsToLoad.map(() => signal<boolean>(false));

    const artImageHash: Record<string, HTMLImageElement> = {};

    spritesheetsToLoad.forEach((sheet, idx) => {
      const url = this.toCacheBustURL(`art/spritesheets/${sheet}.webp`);
      void this.decodeImage(url).then((img) => {
        if (img) {
          artImageHash[sheet] = img;
          this.artImages.set(artImageHash);
        }
        this.artSignals[idx].set(true);
      });
    });

    this.hasLoadedAtlases.set(true);
  }

  // Held onto so the browser keeps them cached for the stylesheets that reference them.
  private async loadUIArt() {
    this.uiImages = (
      await Promise.all(
        LOADING_PRELOAD_IMAGES.map((url) => this.decodeImage(url)),
      )
    ).filter((img) => !!img);

    this.hasLoadedUIArt.set(true);
  }

  // decode() runs off the main thread, so a first paint can't stall a frame decoding the image.
  // Resolves undefined on failure: a missing image must never hang the loading screen (or the savefile load behind it).
  private async decodeImage(
    url: string,
  ): Promise<HTMLImageElement | undefined> {
    const img = new Image();
    img.src = url;

    try {
      await img.decode();
      this.logger.info('Content:LoadImage', `Loaded: ${url}`);
      return img;
    } catch (err) {
      this.logger.error('Content:LoadImage', `Failed: ${url}`, err);
      return undefined;
    }
  }

  // Imported lazily so Pixi stays out of the main bundle.
  private async loadMapArt() {
    const { pixiTexturesPreload } =
      await import('@helpers/pixi/pixi-texture-loader');

    const maps = [...allMaps().values()].map((map) => map.data as TiledMap);
    const urls = [
      ...tiledMapsTilesetImagePaths(maps),
      ...Object.keys(this.artAtlases()).map((sheet) =>
        this.toCacheBustURL(`art/spritesheets/${sheet}.webp`),
      ),
    ];

    // A failed texture still counts as done; the map would load it on demand, rather than the loading screen hanging.
    try {
      await pixiTexturesPreload(urls);
      this.logger.info(
        'Content:LoadMapArt',
        `Preloaded ${urls.length} map textures.`,
      );
    } catch (err) {
      this.logger.error(
        'Content:LoadMapArt',
        'Failed to preload map textures',
        err,
      );
    }

    this.hasLoadedMapArt.set(true);
  }

  private async loadJSON() {
    const req = this.http.get<Record<string, IsContentItem[]>>(
      this.toCacheBustURL(`./json/all.json`),
    );

    const assets = await lastValueFrom(req);

    unfurlContent(assets, (message) => this.logger.warn('Content', message));

    this.logger.info(
      'Content:LoadJSON',
      `Content loaded: ${Object.keys(assets).join(', ')}`,
    );
    this.hasLoadedData.set(true);
  }

  private async loadMaps() {
    const req = this.http.get<Record<string, unknown>>(
      this.toCacheBustURL(`./json/all-maps.json`),
    );

    const allMaps = await lastValueFrom(req);

    const maps = new Map<string, GameMap>();
    Object.entries(allMaps).forEach(([name, data]) => {
      maps.set(name, { name, data });
    });

    setAllMaps(maps);

    this.logger.info(
      'Content:LoadMaps',
      `Maps loaded: ${Object.keys(allMaps).join(', ')}`,
    );
    this.hasLoadedMaps.set(true);
  }
}
