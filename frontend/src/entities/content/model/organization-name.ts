import { readonly, ref } from '@frontend/shared/lib/model-state';

const name = ref('');
export const organizationName = readonly(name);

export function setOrganizationName(value: string | undefined): void {
  name.value = value ?? '';
}
