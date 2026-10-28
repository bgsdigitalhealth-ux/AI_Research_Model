import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  title: string;
  value?: string | number | null;
  subtitle?: string;
  description?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  isLoading?: boolean;
  loading?: boolean;
  isUnavailable?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  description,
  icon: Icon,
  iconColor = 'text-blue-600',
  iconBgColor = 'bg-blue-50',
  isLoading = false,
  loading = false,
  isUnavailable = false,
  isError = false,
  errorMessage,
  onRetry,
  className,
}: MetricCardProps) {
  const effectiveSubtitle = subtitle || description;
  const effectiveLoading = isLoading || loading;
  return (
    <Card className={cn('relative overflow-hidden transition-all hover:border-slate-300', className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {title}
          </span>
          <div className={cn('p-2.5 rounded-lg', iconBgColor)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>

        <div className="mt-3">
          {effectiveLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3.5 w-36" />
            </div>
          ) : isUnavailable || isError ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-amber-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold">
                  {isUnavailable ? 'Unavailable' : 'Error'}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                {errorMessage || 'Service endpoint disconnected'}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium underline mt-1"
                >
                  Retry
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                {value !== undefined && value !== null ? value : '—'}
              </div>
              {effectiveSubtitle && (
                <p className="text-xs text-slate-500 mt-1">
                  {effectiveSubtitle}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

