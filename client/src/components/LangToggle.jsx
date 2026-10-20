import { useI18n } from '../i18n.jsx';
import Segmented from './Segmented.jsx';

export default function LangToggle({ className = '' }) {
  const { lang, setLang, t } = useI18n();
  return (
    <Segmented
      className={`lang-toggle ${className}`}
      label={t('lang.label')}
      value={lang}
      onChange={setLang}
      options={[
        { value: 'en', label: 'EN' },
        { value: 'th', label: 'ไทย' },
      ]}
    />
  );
}
