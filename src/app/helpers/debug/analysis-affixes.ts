import { getEntriesByType } from '@helpers/content/content';
import { affixCanRollOn } from '@helpers/item/affix';
import { isReforgeable } from '@helpers/item/reforge';
import type {
  AffixContent,
  AnalysisCheck,
  AnalysisRunResult,
  EquipmentContent,
} from '@interfaces';

function isRestricted(affix: AffixContent): boolean {
  return (
    affix.fluxOnly || affix.gearSlots.length > 0 || affix.gearTypes.length > 0
  );
}

function checkAffix(
  affix: AffixContent,
  equipment: EquipmentContent[],
): AnalysisCheck {
  const hosts = equipment.filter(
    (item) =>
      !item.unobtainable &&
      isReforgeable(item) &&
      affixCanRollOn(affix, item, affix.fluxOnly),
  );

  return {
    id: `affixes:${affix.id}`,
    label: affix.name,
    status: hosts.length > 0 ? 'pass' : 'fail',
    message:
      hosts.length > 0
        ? `${affix.name}: can roll on ${hosts.length} equipment item(s).`
        : `${affix.name}: no obtainable gear matches its level/slot/type restrictions.`,
  };
}

export function runAffixesAnalysis(): AnalysisRunResult {
  const equipment = getEntriesByType<EquipmentContent>('equipment');
  const affixes = getEntriesByType<AffixContent>('affix').filter(isRestricted);
  const checks = affixes.map((affix) => checkAffix(affix, equipment));
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every restricted or flux-only affix (${affixes.length} checked) can roll on some gear.`
        : `${failures} of ${affixes.length} restricted affix(es) can never roll.`,
  };
}
