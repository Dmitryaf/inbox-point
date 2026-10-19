import { Link } from 'react-router';

import { ProductLogo } from '@frontend/shared/ui/ProductLogo';
import styles from '@frontend/pages/not-found/styles/not-found-page.module.css';

export function NotFoundPage() {
  return (
    <main className={styles['not-found-page']}>
      <section>
        <ProductLogo className={styles['not-found-logo']} />
        <h1>Страница не найдена</h1>
        <p>Проверьте адрес или вернитесь в раздел с ответами.</p>
        <Link className={styles['button-link']} to="/manage">
          Открыть ответы
        </Link>
      </section>
    </main>
  );
}
