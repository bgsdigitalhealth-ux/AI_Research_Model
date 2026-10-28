import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

export function CollaboratorsView() {
  return (
    <PageContainer
      title="Research Collaborators"
      description="Manage cross-institutional investigators, biostatisticians, data safety monitoring boards (DSMB), and trial monitors."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Collaborators', isCurrent: true },
      ]}
      actions={
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          <span>Invite Collaborator</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <StatusState
          type="unavailable"
          title="Collaborators Service Unavailable"
          description="Backend collaboration endpoint (`/collaborators`) is currently unreachable."
          endpoint="/collaborators"
        />
      </div>
    </PageContainer>
  );
}

