import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { LoginView } from '@/features/auth/LoginView';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { StudiesView } from '@/features/studies/StudiesView';
import { StudyDetailView } from '@/features/studies/StudyDetailView';
import { ProtocolsView } from '@/features/protocols/ProtocolsView';
import { ProtocolUploadView } from '@/features/protocols/ProtocolUploadView';
import { ProtocolDetailView } from '@/features/protocols/ProtocolDetailView';
import { ProtocolVerificationView } from '@/features/protocols/ProtocolVerificationView';
import { StudyConfigurationView } from '@/features/protocols/StudyConfigurationView';
import { ProtocolVersionHistoryView } from '@/features/protocols/ProtocolVersionHistoryView';
import { QuestionnairesView } from '@/features/questionnaires/QuestionnairesView';
import { QuestionnaireGenerateView } from '@/features/questionnaires/QuestionnaireGenerateView';
import { QuestionnaireBuilderView } from '@/features/questionnaires/QuestionnaireBuilderView';
import { QuestionnairePreviewView } from '@/features/questionnaires/QuestionnairePreviewView';
import { QuestionnaireReviewView } from '@/features/questionnaires/QuestionnaireReviewView';
import { QuestionnaireVersionHistoryView } from '@/features/questionnaires/QuestionnaireVersionHistoryView';
import { DataCollectionView } from '@/features/data-collection/DataCollectionView';
import { PublishedSurveysView } from '@/features/data-collection/PublishedSurveysView';
import { ParticipantConsentView } from '@/features/data-collection/ParticipantConsentView';
import { ParticipantSurveyFormView } from '@/features/data-collection/ParticipantSurveyFormView';
import { OfflineQueueView } from '@/features/data-collection/OfflineQueueView';
import { CollectionMonitoringView } from '@/features/data-collection/CollectionMonitoringView';
import { AnalysisWorkbenchView } from '@/features/analysis/AnalysisWorkbenchView';
import { AnalysisRunConfigView } from '@/features/analysis/AnalysisRunConfigView';
import { AnalysisExecutionStatusView } from '@/features/analysis/AnalysisExecutionStatusView';
import { AnalysisResultsView } from '@/features/analysis/AnalysisResultsView';
import { DataQualityView } from '@/features/analysis/DataQualityView';
import { AnalysisHistoryView } from '@/features/analysis/AnalysisHistoryView';
import { ReportsView } from '@/features/reports/ReportsView';
import { ReportDetailView } from '@/features/reports/ReportDetailView';
import { ExportCenterView } from '@/features/reports/ExportCenterView';
import { ParticipantsView } from '@/features/participants/ParticipantsView';
import { CollaboratorsView } from '@/features/collaborators/CollaboratorsView';
import { SettingsView } from '@/features/settings/SettingsView';
import { HelpSupportView } from '@/features/help/HelpSupportView';
import { AccessDeniedView } from '@/features/auth/AccessDeniedView';
import { NotFoundView } from '@/features/shared/NotFoundView';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route path="login" element={<LoginView />} />

      {/* Main Workspace with AppShell */}
      <Route element={<AppShell />}>
        {/* Core Dashboard */}
        <Route index element={<DashboardView />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />

        {/* My Studies */}
        <Route path="studies" element={<StudiesView />} />
        <Route path="studies/:id" element={<StudyDetailView />} />

        {/* Protocols (Part 2 Screens) */}
        <Route path="protocols" element={<ProtocolsView />} />
        <Route path="protocols/upload" element={<ProtocolUploadView />} />
        <Route path="protocols/:id" element={<ProtocolDetailView />} />
        <Route path="protocols/:id/verify" element={<ProtocolVerificationView />} />
        <Route path="protocols/:id/study-configuration" element={<StudyConfigurationView />} />
        <Route path="protocols/:id/versions" element={<ProtocolVersionHistoryView />} />

        {/* Questionnaires (Part 3 Screens) */}
        <Route path="questionnaires" element={<QuestionnairesView />} />
        <Route path="questionnaires/new" element={<QuestionnaireBuilderView />} />
        <Route path="questionnaires/generate" element={<QuestionnaireGenerateView />} />
        <Route path="questionnaires/:id/builder" element={<QuestionnaireBuilderView />} />
        <Route path="questionnaires/:id/preview" element={<QuestionnairePreviewView />} />
        <Route path="questionnaires/:id/review" element={<QuestionnaireReviewView />} />
        <Route path="questionnaires/:id/versions" element={<QuestionnaireVersionHistoryView />} />

        {/* Data Collection & Offline Sync (Part 4 Screens) */}
        <Route path="data-collection" element={<DataCollectionView />} />
        <Route path="data-collection/surveys" element={<PublishedSurveysView />} />
        <Route path="data-collection/queue" element={<OfflineQueueView />} />
        <Route path="data-collection/monitoring" element={<CollectionMonitoringView />} />
        <Route path="surveys/:id/consent" element={<ParticipantConsentView />} />
        <Route path="surveys/:id/respond" element={<ParticipantSurveyFormView />} />

        {/* Analysis (Part 5 Screens) */}
        <Route path="analysis" element={<AnalysisWorkbenchView />} />
        <Route path="analysis/new" element={<AnalysisRunConfigView />} />
        <Route path="analysis/workbench" element={<Navigate to="/analysis" replace />} />
        <Route path="analysis/data-quality" element={<DataQualityView />} />
        <Route path="analysis/history" element={<AnalysisHistoryView />} />
        <Route path="analysis/:id/results" element={<AnalysisResultsView />} />
        <Route path="analysis/:id/status" element={<AnalysisExecutionStatusView />} />

        {/* Reports & Exports (Part 5 Screens) */}
        <Route path="reports" element={<ReportsView />} />
        <Route path="reports/:id" element={<ReportDetailView />} />
        <Route path="reports/exports" element={<ExportCenterView />} />
        <Route path="exports" element={<Navigate to="/reports/exports" replace />} />

        {/* Participants */}
        <Route path="participants" element={<ParticipantsView />} />

        {/* Collaborators */}
        <Route path="collaborators" element={<CollaboratorsView />} />

        {/* Settings */}
        <Route path="settings" element={<SettingsView />} />

        {/* Help & Support */}
        <Route path="help" element={<HelpSupportView />} />

        {/* Access Denied */}
        <Route path="access-denied" element={<AccessDeniedView />} />

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundView />} />
      </Route>
    </Routes>
  );
}
