import { useState, type FormEvent } from 'react';

import styles from '@frontend/features/admin-auth/styles/admin-login-form.module.css';

interface Props {
  pending: boolean;
  onSubmit: (password: string, remember: boolean) => Promise<boolean>;
}

export function AdminLoginForm({ pending, onSubmit }: Props) {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!password || pending) {
      return;
    }
    void onSubmit(password, remember);
    setPassword('');
  }
  return (
    <form className={styles['auth-card']} onSubmit={submit}>
      <h1>Вход в управление</h1>
      <p>Введите пароль администратора.</p>
      <label htmlFor="admin-password">Пароль</label>
      <input
        id="admin-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        required
        type="password"
      />
      <label className={styles['remember-device']}>
        <input
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          type="checkbox"
        />
        <span>Запомнить это устройство на 30 дней</span>
      </label>
      <button disabled={pending} type="submit">
        {pending ? 'Проверяем…' : 'Войти'}
      </button>
    </form>
  );
}
