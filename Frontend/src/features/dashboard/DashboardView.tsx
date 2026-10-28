import { PageContainer } from '@/components/shared/PageContainer';
import { QuickActionsBar } from './components/QuickActionsBar';
import { MetricsGrid } from './components/MetricsGrid';
import { StudyStatusSummarySection } from './components/StudyStatusSummarySection';
import { RecentStudiesTable } from './components/RecentStudiesTable';
import { WorkflowProgressTracker } from './components/WorkflowProgressTracker';
import { AiAssistantWidget } from './components/AiAssistantWidget';

export function DashboardView() {
  return (
    <PageContainer
      title="Research Overview"
      description="Real-time monitoring of clinical and observational studies, protocol milestones, and participant data collection."
      breadcrumbs={[{ label: 'Dashboard', isCurrent: true }]}
    >
      <div className="space-y-6">
        {/* Conditional AI Assistant Entry point */}
        <AiAssistantWidget />

        {/* Quick Action Navigation Buttons */}
        <QuickActionsBar />

        {/* Dynamic Study Status Summaries */}
        <StudyStatusSummarySection />

        {/* Dynamic Participant & Questionnaire Metrics */}
        <MetricsGrid />

        {/* Live Studies Table */}
        <RecentStudiesTable />

        {/* Research Workflow Progress Tracker */}
        <WorkflowProgressTracker />
      </div>
    </PageContainer>
  );
}

