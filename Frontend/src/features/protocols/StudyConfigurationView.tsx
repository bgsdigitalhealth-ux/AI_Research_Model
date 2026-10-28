import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageContainer } from '@/components/shared/PageContainer';
import { useProtocolDetail, useStudyConfiguration, useSaveStudyConfiguration } from '@/hooks/useProtocols';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Sliders,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  BarChart,
  GitBranch
} from 'lucide-react';

const configurationSchema = z.object({
  studyType: z.string().min(2, 'Study type is required'),
  randomizationMethod: z.string().optional(),
  allocationRatio: z.string().optional(),
  blindingType: z.enum(['double_blind', 'single_blind', 'open_label', 'triple_blind']),
  numberOfArms: z.coerce.number().min(1, 'At least 1 arm is required'),
  primaryHypothesis: z.string().min(5, 'Primary statistical hypothesis statement is required'),
  significanceAlpha: z.coerce.number().min(0.0001).max(0.5, 'Alpha must be between 0.0001 and 0.5 (e.g. 0.05)'),
  powerThreshold: z.coerce.number().min(50).max(99.9, 'Statistical power must be between 50% and 99.9% (e.g. 80 or 90)'),
  plannedStatisticalTest: z.string().min(2, 'Planned primary statistical test is required'),
  missingDataStrategy: z.enum([
    'complete_case',
    'multiple_imputation',
    'last_observation_carried_forward',
    'mixed_effects_model',
  ]),
  subgroupAnalyses: z.string().optional(),
  interimAnalysesPlanned: z.boolean().optional(),
});

type ConfigurationFormValues = z.infer<typeof configurationSchema>;

export function StudyConfigurationView() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data: protocol } = useProtocolDetail(id || '');
  const {
    data: configData,
    isLoading,
    isUnavailable,
    isError,
    errorDetail,
    refetch,
  } = useStudyConfiguration(id || '');

  const saveConfigMutation = useSaveStudyConfiguration(id || '');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ConfigurationFormValues>({
    resolver: zodResolver(configurationSchema),
    defaultValues: {
      studyType: 'Randomized Controlled Trial',
      blindingType: 'double_blind',
      numberOfArms: 2,
      significanceAlpha: 0.05,
      powerThreshold: 80,
      plannedStatisticalTest: 'ANCOVA / Mixed Model Repeated Measures',
      missingDataStrategy: 'multiple_imputation',
      interimAnalysesPlanned: false,
    },
  });

  // Populate form with real backend data when loaded
  useEffect(() => {
    if (configData) {
      reset({
        studyType: configData.studyType || 'Randomized Controlled Trial',
        randomizationMethod: configData.randomizationMethod || '',
        allocationRatio: configData.allocationRatio || '1:1',
        blindingType: configData.blindingType || 'double_blind',
        numberOfArms: configData.numberOfArms || 2,
        primaryHypothesis: configData.primaryHypothesis || '',
        significanceAlpha: configData.significanceAlpha || 0.05,
        powerThreshold: configData.powerThreshold || 80,
        plannedStatisticalTest: configData.plannedStatisticalTest || '',
        missingDataStrategy: configData.missingDataStrategy || 'multiple_imputation',
        subgroupAnalyses: configData.subgroupAnalyses || '',
        interimAnalysesPlanned: configData.interimAnalysesPlanned || false,
      });
    }
  }, [configData, reset]);

  const onSubmit = async (values: ConfigurationFormValues) => {
    try {
      await saveConfigMutation.mutateAsync({
        protocolId: id,
        ...values,
      });
      toast({
        title: 'Configuration Saved',
        description: 'Study methodology and statistical plan have been recorded on the backend.',
        variant: 'success',
      });
    } catch (err: unknown) {
      toast({
        title: 'Save Failed',
        description: (err as { message?: string })?.message || 'Could not update study configuration.',
        variant: 'destructive',
      });
    }
  };

  return (
    <PageContainer
      title="Study Methods & Statistical Analysis Plan"
      description="Configure formal epidemiological design, trial blinding, hypothesis statements, and prespecified analytical parameters."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Protocols', path: '/protocols' },
        { label: protocol?.title || 'Details', path: `/protocols/${id}` },
        { label: 'Study Configuration', isCurrent: true },
      ]}
      actions={
        <Link to={`/protocols/${id}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Protocol</span>
          </Button>
        </Link>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Study Configuration Service Unavailable"
            description={`Backend configuration endpoint (/protocols/${id}/study-configuration) is currently unreachable.`}
            endpoint={`/protocols/${id}/study-configuration`}
            action={{
              label: 'Retry Loading Configuration',
              onClick: () => refetch(),
            }}
          />
        ) : isError ? (
          <StatusState
            type="error"
            title="Failed to Load Configuration"
            description={errorDetail?.message || 'Could not load study configuration.'}
            action={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Study Design & Trial Architecture */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center gap-2">
                <GitBranch className="h-4 w-4 text-blue-600" />
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    1. Study Design & Methodological Architecture
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Specify protocol methodology, trial blinding, and allocation strategy.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">Study Design Type *</label>
                    <Input
                      {...register('studyType')}
                      placeholder="e.g. Randomized Parallel-Group Controlled Trial"
                    />
                    {errors.studyType && (
                      <p className="text-xs text-red-600">{errors.studyType.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">Blinding Scheme *</label>
                    <select
                      {...register('blindingType')}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                    >
                      <option value="double_blind">Double-Blind (Participant & Investigator)</option>
                      <option value="triple_blind">Triple-Blind (Participant, Investigator & Analyst)</option>
                      <option value="single_blind">Single-Blind (Participant only)</option>
                      <option value="open_label">Open-Label (Unblinded)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">Number of Study Arms *</label>
                    <Input
                      type="number"
                      {...register('numberOfArms')}
                      placeholder="2"
                    />
                    {errors.numberOfArms && (
                      <p className="text-xs text-red-600">{errors.numberOfArms.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">Allocation Ratio</label>
                    <Input
                      {...register('allocationRatio')}
                      placeholder="e.g. 1:1 or 2:1"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">Randomization Method</label>
                    <Input
                      {...register('randomizationMethod')}
                      placeholder="e.g. Permuted Block Stratified by Site"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Prespecified Statistical Analysis Plan */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center gap-2">
                <BarChart className="h-4 w-4 text-indigo-600" />
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    2. Prespecified Statistical Analysis Plan (SAP)
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Prespecify formal hypothesis, alpha error, power, and handling of missing data.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Primary Statistical Hypothesis Statement (H0 / H1) *
                  </label>
                  <textarea
                    rows={3}
                    {...register('primaryHypothesis')}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="e.g. H0: Mean difference in primary biomarker between treatment and control is 0. H1: Treatment yields a statistically significant difference at 12 weeks."
                  />
                  {errors.primaryHypothesis && (
                    <p className="text-xs text-red-600">{errors.primaryHypothesis.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Significance Alpha (α) *
                    </label>
                    <Input
                      type="number"
                      step="0.001"
                      {...register('significanceAlpha')}
                      placeholder="0.05"
                    />
                    {errors.significanceAlpha && (
                      <p className="text-xs text-red-600">{errors.significanceAlpha.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Target Statistical Power (1-β %) *
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register('powerThreshold')}
                      placeholder="80"
                    />
                    {errors.powerThreshold && (
                      <p className="text-xs text-red-600">{errors.powerThreshold.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Missing Data Strategy *
                    </label>
                    <select
                      {...register('missingDataStrategy')}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                    >
                      <option value="multiple_imputation">Multiple Imputation (MICE)</option>
                      <option value="mixed_effects_model">Mixed Model Repeated Measures (MMRM)</option>
                      <option value="complete_case">Complete Case Analysis</option>
                      <option value="last_observation_carried_forward">Last Observation Carried Forward (LOCF)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Planned Primary Statistical Test *
                  </label>
                  <Input
                    {...register('plannedStatisticalTest')}
                    placeholder="e.g. Mixed Effects Model with Baseline Covariates Adjustment"
                  />
                  {errors.plannedStatisticalTest && (
                    <p className="text-xs text-red-600">{errors.plannedStatisticalTest.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Planned Subgroup Analyses (Optional)
                  </label>
                  <Input
                    {...register('subgroupAnalyses')}
                    placeholder="e.g. Stratified by Age (<65 vs >=65), Baseline Severity, Biological Sex"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submit Action */}
            <div className="flex justify-end gap-3 pt-2">
              <Link to={`/protocols/${id}`}>
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                size="sm"
                disabled={saveConfigMutation.isPending}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saveConfigMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Configuration...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Study Configuration</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </PageContainer>
  );
}

