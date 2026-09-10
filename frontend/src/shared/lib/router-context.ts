import * as React from 'react';
import type { InjectionKey } from './model-state';
import type { Router } from './router-types';
export const RouterContext = React.createContext<Router | undefined>(undefined);
export const RouterKey: InjectionKey<Router> = Symbol('router');
export const RouteProps = React.createContext<Record<string, unknown>>({});
