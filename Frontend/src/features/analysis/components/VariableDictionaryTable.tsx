import { VariableDefinition } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search } from 'lucide-react';

interface VariableDictionaryTableProps {
  variables: VariableDefinition[];
  selectedVariable?: string;
  onSelectVariable?: (variableName: string) => void;
  selectable?: boolean;
}

export function VariableDictionaryTable({
  variables,
  selectedVariable,
  onSelectVariable,
  selectable = false,
}: VariableDictionaryTableProps) {
  const [search, setSearch] = useState('');

  const filtered = variables.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.label.toLowerCase().includes(search.toLowerCase()) ||
      v.dataType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Filter variables by name or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>
        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {variables.length} variables
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                {selectable && <th className="w-10 px-4 py-3 text-center">Select</th>}
                <th className="px-4 py-3">Variable Name</th>
                <th className="px-4 py-3">Variable Label / Description</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Missing (%)</th>
                <th className="px-4 py-3 text-right">Unique Values</th>
                <th className="px-4 py-3">Summary / Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={selectable ? 8 : 7} className="px-4 py-8 text-center text-slate-500">
                    No variables match your filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const isSelected = selectedVariable === v.name;
                  return (
                    <tr
                      key={v.name}
                      onClick={() => selectable && onSelectVariable?.(v.name)}
                      className={`transition-colors ${
                        selectable ? 'cursor-pointer hover:bg-blue-50/50' : 'hover:bg-slate-50'
                      } ${isSelected ? 'bg-blue-50/80 font-medium' : ''}`}
                    >
                      {selectable && (
                        <td className="px-4 py-3 text-center">
                          <input
                            type="radio"
                            name="selected_var"
                            checked={isSelected}
                            onChange={() => onSelectVariable?.(v.name)}
                            className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">{v.name}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={v.label}>
                        {v.label}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {v.dataType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-slate-600">{v.role}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={v.missingPercentage > 10 ? 'text-amber-600 font-semibold' : 'text-slate-600'}>
                          {v.missingCount} ({v.missingPercentage.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">{v.uniqueValuesCount}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {v.summaryStats?.mean !== undefined && (
                          <span>
                            $\mu$={v.summaryStats.mean.toFixed(2)}, $\sigma$={v.summaryStats.sd?.toFixed(2)} [
                            {v.summaryStats.min}–{v.summaryStats.max}]
                          </span>
                        )}
                        {v.summaryStats?.categories && (
                          <span className="truncate max-w-xs block">
                            {v.summaryStats.categories.map((c) => `${c.value}: ${c.percentage}%`).join(', ')}
                          </span>
                        )}
                        {!v.summaryStats && <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

