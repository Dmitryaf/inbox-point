import * as React from 'react';
import { Link, Outlet, useLocation, useOutlet } from 'react-router';
import type { Router, RouteTarget } from './router-types';
import { RouterContext, RouteProps } from './router-context';
export { RouterContext, RouteProps, RouterKey } from './router-context';
export { useRouter, useRoute } from './router-hooks';

type Slot = (props: { Component: React.ElementType }) => React.ReactNode;
interface RouterViewProps extends React.HTMLAttributes<HTMLElement> {
  slots?: { default?: Slot };
}
export function RouterView({ slots, ...attributes }: RouterViewProps) {
  const outlet = useOutlet();
  const latest = React.useRef(attributes);
  latest.current = attributes;
  const Component = React.useMemo(
    () =>
      function RouteOutlet(props: Record<string, unknown>) {
        return (
          <RouteProps.Provider value={{ ...latest.current, ...props }}>
            {outlet}
          </RouteProps.Provider>
        );
      },
    [outlet],
  );
  return slots?.default ? (
    slots.default({ Component })
  ) : (
    <RouteProps.Provider value={attributes}>{outlet}</RouteProps.Provider>
  );
}
interface LinkProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  to: RouteTarget;
  replace?: boolean;
  activeClass?: string;
  exactActiveClass?: string;
}
export function RouterLink(props: LinkProps) {
  const router = React.useContext(RouterContext);
  if (!router) {
    const { to, ...attributes } = props;
    delete attributes.replace;
    delete attributes.activeClass;
    delete attributes.exactActiveClass;
    return (
      <a
        {...attributes}
        href={typeof to === 'string' ? to : (to.path ?? '/')}
      />
    );
  }
  return <ActiveRouterLink {...props} router={router} />;
}
function ActiveRouterLink({
  router,
  to,
  activeClass = 'router-link-active',
  exactActiveClass = 'router-link-exact-active',
  className = '',
  ...props
}: LinkProps & { router: Router }) {
  const location = useLocation();
  const target = router.resolve(to);
  const exact = location.pathname === target.path;
  const active =
    exact || location.pathname.startsWith(target.path.replace(/\/$/, '') + '/');
  const classes = [className, active && activeClass, exact && exactActiveClass]
    .filter(Boolean)
    .join(' ');
  return (
    <Link
      {...props}
      to={target.fullPath}
      className={classes}
      aria-current={exact ? 'page' : undefined}
    />
  );
}
export function EmptyRoute() {
  return <Outlet />;
}
