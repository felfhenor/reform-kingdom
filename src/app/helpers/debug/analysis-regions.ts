import { getEntriesByType } from '@helpers/content/content';
import { allMaps, getMap } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  RegionContent,
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

export function runRegionsAnalysis(): AnalysisRunResult {
  const regions = getEntriesByType<RegionContent>('region');
  // Template.json is the blank map new regions are copied from, not a playable map.
  const mapNames = [...allMaps().keys()].filter((name) => name !== 'Template');

  const checks = [
    ...regions.map((region) => checkRegion(region, regions)),
    ...mapNames.map((mapName) => checkMapHasRegion(mapName, regions)),
  ];
  const failures = checks.filter((c) => c.status !== 'pass').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every region (${regions.length}) points at a unique map, and every map has a region.`
        : `${failures} region/map problem(s).`,
  };
}
