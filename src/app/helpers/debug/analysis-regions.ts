import { getEntriesByType, getEntry } from '@helpers/content/content';
import { allMaps, getMap } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  EncounterContent,
  RegionContent,
  TiledMap,
} from '@interfaces';

function checkRegion(
  region: RegionContent,
  regions: RegionContent[],
): AnalysisCheck {
  const id = `regions:${region.id}`;
  const duplicates = regions.filter(
    (other) => other.mapName === region.mapName,
  );

  if (!getMap(region.mapName)) {
    return {
      id,
      label: region.name,
      status: 'fail',
      message: `${region.name}'s mapName "${region.mapName}" is not a map, so its intro never shows.`,
    };
  }

  if (duplicates.length > 1) {
    return {
      id,
      label: region.name,
      status: 'fail',
      message: `${region.name} shares map "${region.mapName}" with another region.`,
    };
  }

  return {
    id,
    label: region.name,
    status: 'pass',
    message: `${region.name} introduces map "${region.mapName}".`,
  };
}

function checkMapHasRegion(
  mapName: string,
  regions: RegionContent[],
): AnalysisCheck {
  const hasRegion = regions.some((region) => region.mapName === mapName);
  return {
    id: `regions:map:${mapName}`,
    label: mapName,
    status: hasRegion ? 'pass' : 'warning',
    message: hasRegion
      ? `${mapName} has a region intro.`
      : `${mapName} has no region, so arriving there shows no intro.`,
  };
}

function mapHasNode(mapName: string, nodeName: string): boolean {
  const map = getMap(mapName)?.data as TiledMap | undefined;
  return (map?.layers ?? [])
    .flatMap((layer) => layer.objects ?? [])
    .some((node) => node.name === nodeName);
}

function regionSealProblem(
  region: RegionContent,
  regions: RegionContent[],
): string | undefined {
  const { sealEncounterId, parTicks } = region.seal ?? {};
  const encounter = sealEncounterId
    ? getEntry<EncounterContent>(sealEncounterId)
    : undefined;

  if (encounter?.__type !== 'encounter') {
    return `seal "${sealEncounterId}" is not an encounter, so the region can never be sealed.`;
  }
  if (!mapHasNode(region.mapName, encounter.name)) {
    return `seal "${encounter.name}" is not placed on map "${region.mapName}".`;
  }
  const sharing = regions.filter(
    (other) => other.seal?.sealEncounterId === sealEncounterId,
  );
  if (sharing.length > 1) {
    return `seal "${encounter.name}" is also another region's seal.`;
  }
  if (!(parTicks > 0)) {
    return `seal parTicks must be above 0, got ${parTicks}.`;
  }
  return undefined;
}

function checkRegionSeal(
  region: RegionContent,
  regions: RegionContent[],
): AnalysisCheck {
  const problem = regionSealProblem(region, regions);
  return {
    id: `regions:seal:${region.id}`,
    label: `${region.name} seal`,
    status: problem ? 'fail' : 'pass',
    message: `${region.name}: ${problem ?? 'seal encounter is placed on its map.'}`,
  };
}

export function runRegionsAnalysis(): AnalysisRunResult {
  const regions = getEntriesByType<RegionContent>('region');
  // Template.json is the blank map new regions are copied from, not a playable map.
  const mapNames = [...allMaps().keys()].filter((name) => name !== 'Template');

  const checks = [
    ...regions.map((region) => checkRegion(region, regions)),
    ...regions.map((region) => checkRegionSeal(region, regions)),
    ...mapNames.map((mapName) => checkMapHasRegion(mapName, regions)),
  ];
  const failures = checks.filter((c) => c.status !== 'pass').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every region (${regions.length}) has a unique map and a valid seal, and every map has a region.`
        : `${failures} region/map problem(s).`,
  };
}
