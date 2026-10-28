import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

export function ParticipantsView() {
  return (
    <PageContainer
      title="Study Participants"
      description="Patient cohort enrollment, demographic screening, informed consent records, and retention tracking."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Participants', isCurrent: true },
      ]}
      actions={
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          <span>Enroll Subject</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <StatusState
          type="unavailable"
          title="Participants Registry Unavailable"
          description="Backend participant cohort registry endpoint (`/participants`) is not answering."
          endpoint="/participants"
        />
      </div>
    </PageContainer>
  );
}

