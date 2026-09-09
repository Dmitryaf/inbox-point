import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

export type AdminSection = 'channels' | 'information' | 'status';
export type ComponentProps = {
  authenticated: boolean;
  current: AdminSection;
  intro: string;
  title: string;
} & EventProps<{
  logout: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const sections: readonly {
    href: string;
    id: AdminSection;
    label: string;
  }[] = [
    { href: '/manage', id: 'information', label: 'Информация' },
    { href: '/setup', id: 'channels', label: 'Каналы' },
    { href: '/ops', id: 'status', label: 'Состояние' },
  ];
  return { $emit, sections };
}
