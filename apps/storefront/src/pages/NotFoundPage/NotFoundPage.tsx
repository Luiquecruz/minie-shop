import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useI18n } from '../../i18n';
import './NotFoundPage.css';

export interface NotFoundPageProps {
  title?: string;
  description?: string;
}

export function NotFoundPage({ title, description }: NotFoundPageProps) {
  const { t } = useI18n();
  const resolvedTitle = title ?? t('notFound.title');
  const resolvedDescription = description ?? t('notFound.description');

  return (
    <div className="not-found-page">
      <Helmet>
        <title>{t('notFound.metaTitle')}</title>
        <meta name="description" content={t('notFound.metaDescription')} />
      </Helmet>

      <div className="not-found-page__card">
        <span className="not-found-page__badge">{t('notFound.badge')}</span>
        <h1 className="not-found-page__title">{resolvedTitle}</h1>
        <p className="not-found-page__desc">{resolvedDescription}</p>
        <Link to="/" className="not-found-page__cta">
          {t('notFound.backToCatalog')}
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
