import type { FFSelectOptionGroup } from '@ff/interfaces/ff-input';
import type { NgOption } from '@ng-select/ng-select';

// ng-select lists a group's header option (it has children) right before those children.
export function ffGroupSelectOptions(
  options: NgOption[],
): FFSelectOptionGroup[] {
  return options.reduce<FFSelectOptionGroup[]>((groups, option) => {
    if (option.children) return [...groups, { header: option, items: [] }];

    const last = groups.at(-1);
    if (last) last.items.push(option);
    else groups.push({ items: [option] });
    return groups;
  }, []);
}
