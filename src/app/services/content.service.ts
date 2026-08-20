import { HttpClient } from '@angular/common/http';
import type { WritableSignal } from '@angular/core';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  allContentById,
  allIdsByName,
  setAllContentById,
  setAllIdsByName,
} from '@helpers/content';
import {
  ensureContent,
  hasContentInitializer,
} from '@helpers/content-initializers';
import { setAllMaps } from '@helpers/maps';
import type { ContentType, GameMap, IsContentItem } from '@interfaces';
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
  public hasLoadedArt = computed(() => this.artSignals.every((s) => s()));
  public hasLoadedAtlases = signal<boolean>(false);
  public hasLoadedData = signal<boolean>(false);
  public hasLoadedMaps = signal<boolean>(false);

  public artAtlases = signal<ArtAtlases>({});

  public hasLoaded = computed(
    () =>
      this.hasLoadedArt() &&
      this.hasLoadedData() &&
      this.hasLoadedAtlases() &&
      this.hasLoadedMaps(),
  );

  async init() {
    this.loadJSON();
    this.loadArt();
    this.loadMaps();
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
      const img = new Image();
      img.src = this.toCacheBustURL(`art/spritesheets/${sheet}.webp`);
      this.artSignals[idx].set(false);
      img.onload = async () => {
        artImageHash[sheet] = img;

        this.artImages.set(artImageHash);
        this.artSignals[idx].set(true);

        this.logger.info('Content:LoadArt', `Loaded sheet: ${sheet}`);
      };
    });

    this.hasLoadedAtlases.set(true);
  }

  private async loadJSON() {
    const req = this.http.get<Record<string, IsContentItem[]>>(
      this.toCacheBustURL(`./json/all.json`),
    );

    const assets = await lastValueFrom(req);

    this.unfurlAssets(assets);

    this.logger.info(
      'Content:LoadJSON',
      `Content loaded: ${Object.keys(assets).join(', ')}`,
    );
    this.hasLoadedData.set(true);
  }

  private async loadMaps() {
    const namesReq = this.http.get<string[]>(
      this.toCacheBustURL(`./json/maps.json`),
    );

    const mapNames = await lastValueFrom(namesReq);

    const maps = new Map<string, GameMap>();

    await Promise.all(
      mapNames.map(async (name) => {
        const mapReq = this.http.get(
          this.toCacheBustURL(`./maps/${name}.json`),
        );
        const data = await lastValueFrom(mapReq);
        maps.set(name, { name, data });
      }),
    );

    setAllMaps(maps);

    this.logger.info('Content:LoadMaps', `Maps loaded: ${mapNames.join(', ')}`);
    this.hasLoadedMaps.set(true);
  }

  private unfurlAssets(assets: Record<string, IsContentItem[]>) {
    const allIdsByNameAssets: Map<string, string> = allIdsByName();
    const allEntriesByIdAssets: Map<string, IsContentItem> = allContentById();

    Object.keys(assets).forEach((subtype) => {
      Object.values(assets[subtype]).forEach((entry) => {
        entry.__type = subtype as ContentType;

        if (allIdsByNameAssets.has(entry.name)) {
          this.logger.warn(
            'Content',
            `"${entry.name}/${
              entry.id
            }" is a duplicate name to "${allIdsByNameAssets.get(
              entry.name,
            )}". Skipping...`,
          );
          return;
        }

        const dupe = allEntriesByIdAssets.get(entry.id);
        if (dupe) {
          this.logger.warn(
            'Content',
            `"${entry.name}/${entry.id}" is a duplicate id to "${dupe.name}/${dupe.id}". Skipping...`,
          );
          return;
        }

        if (!hasContentInitializer(entry)) {
          this.logger.warn(`Content type ${entry.__type} has no initializer`);
          return;
        }

        const cleanedEntry = ensureContent(entry);

        allIdsByNameAssets.set(cleanedEntry.name, cleanedEntry.id);
        allEntriesByIdAssets.set(cleanedEntry.id, cleanedEntry);
      });
    });

    setAllIdsByName(allIdsByNameAssets);
    setAllContentById(allEntriesByIdAssets);
  }
}
