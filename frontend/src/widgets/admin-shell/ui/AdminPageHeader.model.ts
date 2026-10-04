import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

export type AdminSection = 'answers' | 'channels' | 'analytics' | 'monitoring';
export type ComponentProps = {
  current: AdminSection;
  intro: string;
  pending: boolean;
  showLogout: boolean;
  title: string;
} & EventProps<{
  logout: [];
  revokeAll: [];
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
    { href: '/manage', id: 'answers', label: 'Ответы' },
    { href: '/setup', id: 'channels', label: 'Каналы' },
    { href: '/analytics', id: 'analytics', label: 'Аналитика' },
    { href: '/ops', id: 'monitoring', label: 'Мониторинг' },
  ];
  return { $emit, sections };
}
