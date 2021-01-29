export interface DropdownOption {
  label: string;
  value: any;
  category?: string;
  categoryLabel?: string;
}

export interface InternalGroupedDropdownOption {
  label: string;
  value: any;
  category?: string;
  categoryLabel: string;
  isSubOption: boolean;
}

export function getInternalGroupedDropdownOptions(options: DropdownOption[]): InternalGroupedDropdownOption[] {
  return options.map((o: DropdownOption) => {
    return {
      value: o.value,
      label: o.label,
      category: o.category,
      categoryLabel: o.categoryLabel || o.label,
      isSubOption: !!o.category
    };
  }).sort((a: InternalGroupedDropdownOption, b: InternalGroupedDropdownOption) =>
    a.categoryLabel < b.categoryLabel ? -1 :
      (a.categoryLabel > b.categoryLabel ? 1 :
          (!!a.isSubOption && !b.isSubOption ? 1 :
              (!a.isSubOption && !!b.isSubOption ? -1 :
                  (a.label < b.label ? -1 :
                      (a.label > b.label ? 1 : 0)
                  )
              )
          )
      )
  );
}

export function getAllOptions(arr: any[], ids?: number[]): any[] {
  return ids ? arr.filter((o: any) => ids.includes(o.value)) : arr;
}

export function getSubOptions(arr: any[], ids?: number[]): any[] {
  return ids
    ? arr.filter((o: any) => !!o.category && ids.includes(o.value))
    : arr.filter((o: any) => !!o.category);
}

export function getTopOptions(arr: any[], ids?: number[]): any[] {
  return ids
    ? arr.filter((o: any) => !o.category && ids.includes(o.value))
    : arr.filter((o: any) => !o.category);
}
