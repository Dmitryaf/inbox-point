import { RouterLink } from '@frontend/shared/lib/router';

export function renderNotFoundPagePart1() {
  return (
    <>
      <section data-r-e17337c8="">
        <p className="brand" data-r-e17337c8="">
          {'Inbox Point'}
        </p>
        <h1 data-r-e17337c8="">{'Страница не найдена'}</h1>
        <p data-r-e17337c8="">
          {'Проверьте адрес или вернитесь в раздел с ответами.'}
        </p>
        <RouterLink to="/manage" className="button-link" data-r-e17337c8="">
          {'Открыть ответы'}
        </RouterLink>
      </section>
    </>
  );
}
