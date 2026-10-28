import { useWorkflowProgress } from '@/hooks/useDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusState } from '@/components/shared/StatusState';
import { 
  CheckCircle, 
  Clock, 
  Circle, 
  AlertCircle 
} from 'lucide-react';
import { WorkflowStepStatus } from '@/types/study';

const STEP_STATUS_STYLES: Record<WorkflowStepStatus, { icon: React.ElementType; color: string; badge: string }> = {
  completed: {
    icon: CheckCircle,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  in_progress: {
    icon: Clock,
    color: 'text-blue-600 bg-blue-50 border-blue-200 ring-2 ring-blue-500/20',
    badge: 'bg-blue-100 text-blue-800',
  },
  pending: {
    icon: Circle,
    color: 'text-slate-400 bg-slate-50 border-slate-200',
    badge: 'bg-slate-100 text-slate-600',
  },
  blocked: {
    icon: AlertCircle,
    color: 'text-red-600 bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-800',
  },
};

export function WorkflowProgressTracker() {
  const { data: steps, isLoading, isUnavailable, isError, errorDetail, refetch } = useWorkflowProgress();

  if (isUnavailable) {
    return (
      <StatusState
        type="unavailable"
        title="Workflow Milestone Progress Unavailable"
        description="Backend endpoint (`/dashboard/workflow-progress`) is not responding."
        endpoint="/dashboard/workflow-progress"
        action={{
          label: 'Retry Fetching Workflow',
          onClick: () => refetch(),
        }}
      />
    );
  }

  if (isError) {
    return (
      <StatusState
        type="error"
        title="Error Loading Workflow Progress"
        description={errorDetail?.message || 'Failed to retrieve workflow progress.'}
        action={{
          label: 'Retry',
          onClick: () => refetch(),
        }}
      />
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Research Workflow Pipeline</h3>
            <p className="text-xs text-slate-500">End-to-end clinical and empirical protocol stages</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : !steps || steps.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No active workflow milestones configured on the server.
          </div>
        ) : (
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {steps.map((step) => {
                const meta = STEP_STATUS_STYLES[step.status] || STEP_STATUS_STYLES.pending;
                const Icon = meta.icon;

                return (
                  <div
                    key={step.id}
                    className="p-3.5 rounded-lg border border-slate-200/80 bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-full border ${meta.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          Step {step.stepNumber}: {step.title}
                        </span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${meta.badge}`}>
                        {step.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      {step.description}
                    </p>

                    {step.assignedRole && (
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-50">
                        Lead: <span className="font-medium text-slate-600">{step.assignedRole}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

