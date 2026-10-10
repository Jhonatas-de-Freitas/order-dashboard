import { useEffect, type ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} | Balcão`;
  }, [title]);

  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-8">
      <div>
        <h1 className="type-wide text-2xl sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-[64ch] text-ink-muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}
