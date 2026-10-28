import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
} from 'recharts';
import { DistributionDataPoint, ScatterPlotDataPoint, SurvivalDataPoint } from '@/types/analysis';

interface DistributionChartProps {
  data: DistributionDataPoint[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

export function DistributionChart({ data, title, xLabel = 'Bucket / Value', yLabel = 'Frequency' }: DistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        No distribution data points available for this variable.
      </div>
    );
  }

  const hasExpected = data.some((d) => d.expectedCount !== undefined);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
      {title && <h4 className="mb-3 text-sm font-semibold text-slate-900">{title}</h4>}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={{ value: xLabel, position: 'insideBottom', offset: -15, fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                border: 'none',
              }}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="observedCount" name="Observed Count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            {hasExpected && (
              <Bar dataKey="expectedCount" name="Expected (Theoretical)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface RegressionScatterChartProps {
  data: ScatterPlotDataPoint[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

export function RegressionScatterChart({
  data,
  title = 'Fitted Regression & Residual Distribution',
  xLabel = 'Independent Predictor (X)',
  yLabel = 'Observed Outcome (Y)',
}: RegressionScatterChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        No scatter plot coordinates returned by the statistical backend.
      </div>
    );
  }

  // Sort by x for line rendering if predicted line is present
  const sortedLineData = [...data]
    .filter((d) => d.predicted !== undefined)
    .sort((a, b) => a.x - b.x);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span className="text-xs text-slate-500">N = {data.length} data points</span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={{ value: xLabel, position: 'insideBottom', offset: -15, fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                backgroundColor: '#0f172a',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                border: 'none',
              }}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
            <Scatter name="Observed Response" data={data} fill="#3b82f6" />
            {sortedLineData.length > 0 && (
              <Scatter
                name="Fitted Model (OLS)"
                data={sortedLineData.map((d) => ({ x: d.x, y: d.predicted }))}
                line={{ stroke: '#dc2626', strokeWidth: 2 }}
                shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={0} />}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface SurvivalCurveChartProps {
  data: SurvivalDataPoint[];
  title?: string;
}

export function SurvivalCurveChart({ data, title = 'Kaplan-Meier Survival Estimation' }: SurvivalCurveChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        No survival or time-to-event curves available for this model.
      </div>
    );
  }

  // Group by arm/cohort
  const groups = Array.from(new Set(data.map((d) => d.group || 'All Subjects')));
  const colors = ['#2563eb', '#16a34a', '#d97706', '#9333ea'];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span className="text-xs text-slate-500">Step function with 95% Confidence Bounds</span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              type="number"
              dataKey="time"
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={{ value: 'Time (Days/Follow-up)', position: 'insideBottom', offset: -15, fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={{
                value: 'Cumulative Survival Probability',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fill: '#64748b',
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                border: 'none',
              }}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
            {groups.map((grp, idx) => {
              const groupData = data.filter((d) => (d.group || 'All Subjects') === grp);
              return (
                <Line
                  key={grp}
                  type="stepAfter"
                  data={groupData}
                  dataKey="survivalProb"
                  name={`Cohort: ${grp}`}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
