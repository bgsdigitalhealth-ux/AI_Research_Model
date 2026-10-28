import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export function AccessDeniedView() {
  return (
    <PageContainer
      title="403 — Access Denied"
      description="You do not have permission to view this resource."
    >
      <div className="max-w-lg mx-auto py-12">
        <StatusState
          type="access-denied"
          title="Access Restricted"
          description="Your current user role or credentials do not authorize access to this study data or administrative module."
        />
        <div className="text-center mt-6">
          <Link to="/">
            <Button size="sm" className="gap-2">
              <Home className="h-4 w-4" />
              <span>Return to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

