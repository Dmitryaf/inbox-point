import { readonly, ref } from 'vue';

const name = ref('');
export const organizationName = readonly(name);

export function setOrganizationName(value: string | undefined): void {
  name.value = value ?? '';
}
