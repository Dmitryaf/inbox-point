import type * as React from 'react';
import type { DataRouter, RouteObject } from 'react-router';
import type { Ref } from './model-state';

export interface RouterHistory {
  kind: 'browser' | 'memory';
  base?: string;
}
export type AdminSection = 'answers' | 'channels' | 'analytics' | 'monitoring';
export interface RouteMeta {
  [key: string]: unknown;
  documentTitle?: string;
  pageTitle?: string;
  description?: string;
  adminSection?: AdminSection;
}
export interface RouteRecordRaw {
  path: string;
  name?: string;
  component?: React.ElementType;
  redirect?: string;
  children?: RouteRecordRaw[];
  meta?: RouteMeta;
}
export interface ResolvedRoute {
  path: string;
  fullPath: string;
  name?: string;
  meta: RouteMeta;
  query: Record<string, string | string[]>;
  hash: string;
}
export type RouteTarget =
  | string
  | {
      path?: string;
      name?: string;
      query?: Record<string, string | number | undefined>;
      hash?: string;
    };
export type NavigationGuard = (
  to: ResolvedRoute,
  from: ResolvedRoute,
) => boolean | void;
export interface Router {
  readonly __reactRouter: true;
  readonly native: DataRouter;
  readonly records: RouteObject[];
  readonly currentRoute: Ref<ResolvedRoute>;
  rootContent: React.ReactNode;
  activate(): void;
  push(to: RouteTarget): Promise<void>;
  replace(to: RouteTarget): Promise<void>;
  isReady(): Promise<void>;
  beforeEach(guard: NavigationGuard): () => void;
  afterEach(
    guard: (to: ResolvedRoute, from: ResolvedRoute) => void,
  ): () => void;
  resolve(to: RouteTarget): ResolvedRoute;
  render(children: React.ReactNode): React.ReactNode;
}
