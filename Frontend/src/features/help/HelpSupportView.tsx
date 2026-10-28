import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { HelpCircle, BookOpen, ExternalLink, LifeBuoy } from 'lucide-react';

export function HelpSupportView() {
  return (
    <PageContainer
      title="Help & Support"
      description="Documentation, standard operating procedures (SOP), and system guidance for research personnel."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Help & Support', isCurrent: true },
      ]}
    >
      <div className="space-y-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="hover:border-slate-300 transition-all">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Research Flow Protocol Guide</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Step-by-step guidance on creating a study, configuring questionnaire instruments, collecting patient-reported outcome measures, and producing statistical pipelines.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-slate-300 transition-all">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Technical Support & API Status</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                If endpoints report unavailable or disconnected, inspect your backend server process and check that <span className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">VITE_API_BASE_URL</span> matches your backend address.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

