import { PageContainer } from '@/components/shared/PageContainer';
import { QuickActionsBar } from './components/QuickActionsBar';
import { MetricsGrid } from './components/MetricsGrid';
import { StudyStatusSummarySection } from './components/StudyStatusSummarySection';
import { RecentStudiesTable } from './components/RecentStudiesTable';

export function DashboardView() {
  return (
    <PageContainer
      title="Research Overview"
      description="Real-time monitoring of clinical and observational studies, protocol milestones, and participant data collection."
      breadcrumbs={[{ label: 'Dashboard', isCurrent: true }]}
    >
      <div className="space-y-6">
        {/* Quick Action Navigation Buttons */}
        <QuickActionsBar />

        {/* Dynamic Study Status Summaries */}
        <StudyStatusSummarySection />

        {/* Dynamic Participant & Questionnaire Metrics */}
        <MetricsGrid />

        {/* Live Studies Table */}
        <RecentStudiesTable />
      </div>
    </PageContainer>
  );
}

