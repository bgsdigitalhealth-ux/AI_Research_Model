import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  PlusCircle, 
  Upload, 
  Sparkles, 
  ClipboardList, 
  Database, 
  BarChart3,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateStudy } from '@/hooks/useStudies';
import { useToast } from '@/components/ui/use-toast';

const createStudySchema = z.object({
  title: z.string().min(3, 'Study title must be at least 3 characters'),
  protocolNumber: z.string().min(2, 'Protocol number is required (e.g. IRB-2026-001)'),
  phase: z.string().optional(),
  principalInvestigator: z.string().optional(),
  targetParticipants: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : Number(v)),
    z.number().positive('Must be a positive integer').optional()
  ),
});

type CreateStudyFormValues = z.infer<typeof createStudySchema>;

export function QuickActionsBar() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const createStudyMutation = useCreateStudy();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStudyFormValues>({
    resolver: zodResolver(createStudySchema),
  });

  const onSubmit = async (data: CreateStudyFormValues) => {
    try {
      await createStudyMutation.mutateAsync(data);
      toast({
        title: 'Study Created',
        description: `Study "${data.title}" was registered on the server.`,
        variant: 'success',
      });
      setIsCreateOpen(false);
      reset();
    } catch (err: unknown) {
      const errorMsg = (err as { message?: string })?.message || 'Failed to submit study to backend.';
      toast({
        title: 'Submission Failed',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Quick Actions
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {/* Action: AI Generator */}
        <Button
          type="button"
          onClick={() => navigate('/questionnaires/generate')}
          className="h-auto py-3 px-4 flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-purple-50/50 border border-slate-200 text-slate-800 hover:text-purple-700 hover:border-purple-200 shadow-xs transition-all"
        >
          <Sparkles className="h-5 w-5 text-purple-600" />
          <span className="text-xs font-semibold">AI Generator</span>
        </Button>

        {/* Action 1: Create Study */}
        <Button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="h-auto py-3 px-4 flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-blue-50/50 border border-slate-200 text-slate-800 hover:text-blue-700 hover:border-blue-200 shadow-xs transition-all"
        >
          <PlusCircle className="h-5 w-5 text-blue-600" />
          <span className="text-xs font-semibold">Create Study</span>
        </Button>

        {/* Action 2: Upload Protocol */}
        <Button
          type="button"
          onClick={() => navigate('/protocols/upload')}
          className="h-auto py-3 px-4 flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-blue-50/50 border border-slate-200 text-slate-800 hover:text-blue-700 hover:border-blue-200 shadow-xs transition-all"
        >
          <Upload className="h-5 w-5 text-indigo-600" />
          <span className="text-xs font-semibold">Upload Protocol</span>
        </Button>

        {/* Action 3: Manage Questionnaires */}
        <Button
          type="button"
          onClick={() => navigate('/questionnaires')}
          className="h-auto py-3 px-4 flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-blue-50/50 border border-slate-200 text-slate-800 hover:text-blue-700 hover:border-blue-200 shadow-xs transition-all"
        >
          <ClipboardList className="h-5 w-5 text-emerald-600" />
          <span className="text-xs font-semibold">Questionnaires</span>
        </Button>

        {/* Action 4: Collect Data */}
        <Button
          type="button"
          onClick={() => navigate('/data-collection')}
          className="h-auto py-3 px-4 flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-blue-50/50 border border-slate-200 text-slate-800 hover:text-blue-700 hover:border-blue-200 shadow-xs transition-all"
        >
          <Database className="h-5 w-5 text-amber-600" />
          <span className="text-xs font-semibold">Collect Data</span>
        </Button>

        {/* Action 5: View Analysis */}
        <Button
          type="button"
          onClick={() => navigate('/analysis')}
          className="h-auto py-3 px-4 flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-blue-50/50 border border-slate-200 text-slate-800 hover:text-blue-700 hover:border-blue-200 shadow-xs transition-all col-span-2 sm:col-span-1"
        >
          <BarChart3 className="h-5 w-5 text-sky-600" />
          <span className="text-xs font-semibold">View Analysis</span>
        </Button>
      </div>

      {/* Modal: Create Study */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create New Research Study</h3>
                <p className="text-xs text-slate-500">
                  Registers study record with backend endpoint (`POST /studies`)
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Study Title *</label>
                <Input
                  {...register('title')}
                  placeholder="e.g. Randomized Clinical Evaluation of Neural Markers"
                />
                {errors.title && (
                  <p className="text-xs text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Protocol / IRB Number *</label>
                  <Input
                    {...register('protocolNumber')}
                    placeholder="e.g. PROTO-2026-X8"
                  />
                  {errors.protocolNumber && (
                    <p className="text-xs text-red-600">{errors.protocolNumber.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Study Phase</label>
                  <Input
                    {...register('phase')}
                    placeholder="e.g. Phase II, Observational"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Principal Investigator</label>
                  <Input
                    {...register('principalInvestigator')}
                    placeholder="e.g. Dr. Jane Smith"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Target Cohort Size</label>
                  <Input
                    type="number"
                    {...register('targetParticipants')}
                    placeholder="e.g. 150"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createStudyMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createStudyMutation.isPending}
                  className="gap-2"
                >
                  {createStudyMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {createStudyMutation.isPending ? 'Submitting...' : 'Register Study'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload Protocol info */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Upload Protocol Document</h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload PDF or Word protocol submissions directly into your study repository. Protocol file parsing will connect to the protocol intake endpoint when available.
            </p>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50">
              <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-700">Drag and drop protocol files</p>
              <p className="text-[11px] text-slate-400 mt-1">PDF, DOCX up to 50MB</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUploadOpen(false)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsUploadOpen(false);
                  navigate('/protocols');
                }}
              >
                Go to Protocols
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

