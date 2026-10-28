import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export function NotFoundView() {
  return (
    <PageContainer
      title="404 — Page Not Found"
      description="The requested page route does not exist."
    >
      <div className="max-w-lg mx-auto py-12">
        <StatusState
          type="empty"
          title="Page Not Found"
          description="The route you requested could not be found within the application."
        />
        <div className="text-center mt-6">
          <Link to="/">
            <Button size="sm" className="gap-2">
              <Home className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

