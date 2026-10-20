import { useState } from 'react';
import LangToggle from '../components/LangToggle.jsx';
import Logo from '../components/Logo.jsx';
import { useI18n } from '../i18n.jsx';
import { NAME_MAX, PIN_LENGTH } from '../lib/constants.js';
import { loadName, saveName } from '../lib/session.js';

export default function Home({ actions, busy, error, clearError }) {
  const { t, te } = useI18n();
  const [name, setName] = useState(loadName);
  const [pin, setPin] = useState(
    () => new URLSearchParams(location.search).get('pin')?.replace(/\D/g, '').slice(0, PIN_LENGTH) || '',
  );
  const [localError, setLocalError] = useState(''); // an error code, translated at render time

  const trimmed = name.trim();
  const needName = () => {
    if (trimmed) return false;
    setLocalError('BAD_NAME');
    return true;
  };

  const create = () => {
    clearError();
    if (needName()) return;
    saveName(trimmed);
    actions.create(trimmed);
  };
  const join = (e) => {
    e.preventDefault();
    clearError();
    if (needName()) return;
    if (pin.length !== PIN_LENGTH) return setLocalError('BAD_PIN');
    saveName(trimmed);
    actions.join(pin, trimmed);
  };

  const code = localError || error;

  return (
    <main className="home">
      <LangToggle className="lang-corner" />

      <header className="home-head">
        <Logo />
        <h1>{t('app.name')}</h1>
        <p>{t('app.tagline')}</p>
      </header>

      <section className="panel home-panel" aria-label={t('home.start')}>
        <label className="field">
          <span className="field-label">{t('home.nameLabel')}</span>
          <input
            type="text"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="nickname"
            placeholder={t('home.namePlaceholder')}
            onChange={(e) => { setName(e.target.value); setLocalError(''); }}
          />
          <span className="field-hint">{t('home.nameHint')}</span>
        </label>

        <button type="button" className="btn btn-primary btn-block" onClick={create} disabled={busy}>
          {t('home.create')}
        </button>

        <div className="or" aria-hidden="true"><span>{t('home.or')}</span></div>

        <form className="join-row" onSubmit={join}>
          <label className="field grow">
            <span className="field-label">{t('home.pinLabel')}</span>
            <input
              className="pin-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              placeholder="000000"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setLocalError(''); }}
            />
          </label>
          <button type="submit" className="btn btn-secondary" disabled={busy}>{t('home.join')}</button>
        </form>

        {code && <p role="alert" className="form-error">{te(code)}</p>}
      </section>
    </main>
  );
}
