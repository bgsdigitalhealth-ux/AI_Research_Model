import { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string | number;
  isExternal?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
  isCurrent?: boolean;
}

