import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useI18n } from '../../i18n';

export interface NotFoundPageProps {
  title?: string;
  description?: string;
}

export function NotFoundPage({ title, description }: NotFoundPageProps) {
  const { t } = useI18n();
  const resolvedTitle = title ?? t('notFound.title');
  const resolvedDescription = description ?? t('notFound.description');

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[1280px] items-center justify-center px-4 py-16 sm:px-6">
      <Helmet>
        <title>{t('notFound.metaTitle')}</title>
        <meta name="description" content={t('notFound.metaDescription')} />
      </Helmet>

      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl border border-border bg-surface px-8 py-12 text-center shadow-card-md">
        <span className="inline-flex items-center rounded-full border border-brand-border bg-brand-subtle px-3.5 py-1 text-sm font-extrabold tracking-widest text-brand">
          {t('notFound.badge')}
        </span>
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-fg-heading sm:text-3xl">
          {resolvedTitle}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-fg-muted">
          {resolvedDescription}
        </p>
        <Link
          to="/"
          className="mt-2 inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white no-underline shadow-card-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {t('notFound.backToCatalog')}
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
