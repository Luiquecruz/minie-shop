import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { t } from '../../i18n';
import './NotFoundPage.css';

export interface NotFoundPageProps {
  title?: string;
  description?: string;
}

export function NotFoundPage({
  title = t('notFound.title'),
  description = t('notFound.description'),
}: NotFoundPageProps) {
  return (
    <main className="not-found-page" role="main">
      <Helmet>
        <title>{t('notFound.metaTitle')}</title>
        <meta name="description" content={t('notFound.metaDescription')} />
      </Helmet>

      <div className="not-found-page__card">
        <span className="not-found-page__badge">{t('notFound.badge')}</span>
        <h1 className="not-found-page__title">{title}</h1>
        <p className="not-found-page__desc">{description}</p>
        <Link to="/" className="not-found-page__cta">
          {t('notFound.backToCatalog')}
        </Link>
      </div>
    </main>
  );
}

export default NotFoundPage;
