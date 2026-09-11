import '@frontend/pages/not-found/styles/not-found-page.react-data-r-e17337c8.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';
import ProductLogo from '@frontend/shared/ui/ProductLogo';
import { RouterLink } from '@frontend/shared/lib/router';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './NotFoundPage.model';

export default function NotFoundPage($incomingProps: ComponentProps) {
  const { props: $props, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <main
        {...$attributes}
        className={$class('not-found-page', $attributes.className)}
        data-r-e17337c8=""
      >
        <section data-r-e17337c8="">
          <ProductLogo className="not-found-logo" data-r-e17337c8="" />
          <h1 data-r-e17337c8="">{'Страница не найдена'}</h1>
          <p data-r-e17337c8="">
            {'Проверьте адрес или вернитесь в раздел с ответами.'}
          </p>
          <RouterLink to="/manage" className="button-link" data-r-e17337c8="">
            {'Открыть ответы'}
          </RouterLink>
        </section>
      </main>
    </ModelScopeProvider>
  );
}
