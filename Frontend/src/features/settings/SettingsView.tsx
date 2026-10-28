import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Shield, Database, Sliders } from 'lucide-react';

export function SettingsView() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const apiTimeout = import.meta.env.VITE_API_TIMEOUT || '15000';
  const aiAssistant = import.meta.env.VITE_ENABLE_AI_ASSISTANT || 'false';

  return (
    <PageContainer
      title="System Settings"
      description="Client environment parameters, endpoint endpoints, and research security configuration."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Settings', isCurrent: true },
      ]}
    >
      <div className="space-y-6 max-w-4xl">
        {/* Environment Configuration Card */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Server className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">API & Server Configuration</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Configured API Base URL</p>
                <p className="font-mono text-slate-800 break-all">{apiBaseUrl}</p>
              </div>

              <div className="space-y-1 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Network Request Timeout</p>
                <p className="font-mono text-slate-800">{apiTimeout} ms</p>
              </div>

              <div className="space-y-1 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">AI Assistant Feature Flag</p>
                <div className="flex items-center gap-2 pt-0.5">
                  <Badge variant={aiAssistant === 'true' ? 'success' : 'secondary'}>
                    {aiAssistant === 'true' ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <span className="text-slate-400 font-mono text-[10px]">VITE_ENABLE_AI_ASSISTANT</span>
                </div>
              </div>

              <div className="space-y-1 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Authentication Mode</p>
                <p className="text-slate-700">Strict JWT Bearer Header via <span className="font-mono">localStorage('auth_token')</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & Compliance Card */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Shield className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Compliance & Regulatory Standards</h3>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p>
                This frontend application shell is structured according to <strong>Good Clinical Practice (GCP)</strong> and <strong>21 CFR Part 11</strong> interface guidelines.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                <li>No fabricated test subjects, fake participants, or mock statistics are permitted.</li>
                <li>API failures are explicitly rendered with status badges rather than zero values.</li>
                <li>Session security is maintained with Bearer token authentication against the backend service.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

