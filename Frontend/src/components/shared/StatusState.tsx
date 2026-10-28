import * as React from 'react';
import { 
  AlertCircle, 
  ServerCrash, 
  FolderOpen, 
  ShieldAlert, 
  RotateCcw, 
  Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface StatusStateProps {
  type: 'loading' | 'unavailable' | 'error' | 'empty' | 'access-denied';
  title?: string;
  description?: string;
  endpoint?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function StatusState({
  type,
  title,
  description,
  endpoint,
  action,
  actionLabel,
  onAction,
  className,
}: StatusStateProps) {
  const effectiveAction = action || (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);
  if (type === 'loading') {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center space-y-3 min-h-[160px]', className)}>
        <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">
          {title || 'Loading data...'}
        </p>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>
    );
  }

  if (type === 'unavailable') {
    return (
      <div className={cn('rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-6 sm:p-8 text-center space-y-3', className)}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <ServerCrash className="h-6 w-6" />
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h4 className="text-base font-semibold text-slate-900">
              {title || 'Service Endpoint Unavailable'}
            </h4>
            <Badge variant="warning">Not Connected</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            {description || 'The requested backend API service is currently not connected or has not been deployed.'}
          </p>
          {endpoint && (
            <p className="text-xs font-mono text-slate-500 bg-amber-100/60 inline-block px-2.5 py-1 rounded">
              Endpoint: {endpoint}
            </p>
          )}
        </div>

        {effectiveAction && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={effectiveAction.onClick}
              className="gap-2 border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {effectiveAction.label}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className={cn('rounded-xl border border-red-200 bg-red-50/50 p-6 sm:p-8 text-center space-y-3', className)}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-red-950">
            {title || 'Failed to Load Data'}
          </h4>
          <p className="text-xs sm:text-sm text-red-700 max-w-md mx-auto">
            {description || 'An error occurred while fetching information from the server.'}
          </p>
        </div>

        {effectiveAction && (
          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={effectiveAction.onClick}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {effectiveAction.label}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (type === 'empty') {
    return (
      <div className={cn('rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3', className)}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <FolderOpen className="h-6 w-6" />
        </div>
        
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-slate-800">
            {title || 'No Records Found'}
          </h4>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {description || 'There are no active records in the database yet.'}
          </p>
        </div>

        {effectiveAction && (
          <div className="pt-2">
            <Button
              variant="default"
              size="sm"
              onClick={effectiveAction.onClick}
            >
              {effectiveAction.label}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // access-denied
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3', className)}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <ShieldAlert className="h-6 w-6" />
      </div>
      
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-slate-900">
          {title || 'Access Restricted'}
        </h4>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          {description || 'You do not have the required permissions or credentials to access this research resource.'}
        </p>
      </div>

      {action && (
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

