import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-blue-600 text-white',
        secondary:
          'border-transparent bg-slate-100 text-slate-800',
        destructive:
          'border-transparent bg-red-100 text-red-800 border-red-200',
        success:
          'border-transparent bg-emerald-100 text-emerald-800 border-emerald-200',
        warning:
          'border-transparent bg-amber-100 text-amber-800 border-amber-200',
        info:
          'border-transparent bg-sky-100 text-sky-800 border-sky-200',
        outline: 'text-slate-700 border-slate-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

