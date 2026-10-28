import * as React from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import { BreadcrumbItem } from '@/types/navigation';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className,
}: PageContainerProps) {
  return (
    <div className={cn('p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6', className)}>
      {/* Top Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="space-y-1">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="mb-2">
              <Breadcrumbs items={breadcrumbs} />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-slate-500 max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>

      {/* Main Page Content Body */}
      <div>{children}</div>
    </div>
  );
}

