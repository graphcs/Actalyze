"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { BudgetCategory } from '@/types/charts';

interface BudgetBreakdownChartProps {
  data: BudgetCategory[]
  title: string
  description?: string
  total?: number
  currency?: string
}

// BudgIT-inspired color palette
const COLORS = [
  '#1c4e63', // Teal/Navy primary
  '#2d7a8f', // Lighter teal
  '#4da6bb', // Sky blue
  '#7bc9d6', // Light blue
  '#a8dfe6', // Very light blue
  '#c8a882', // Warm tan
  '#8ab88a', // Sage green
  '#f59e42', // Warm orange
];

export default function BudgetBreakdownChart({
  data,
  title,
  description,
  total,
}: BudgetBreakdownChartProps) {

  const formatCurrency = (value: number) => {
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(2)}T`;
    }
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    return `$${value.toLocaleString()}`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 my-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-slate-600">{description}</p>
        )}
        {total && (
          <div className="mt-2 text-2xl font-bold text-[#1c4e63]">
            Total: {formatCurrency(total)}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data as unknown as Record<string, unknown>[]}
              cx="50%"
              cy="50%"
              labelLine={false}
              label
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px'
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value, entry: unknown) => {
                const typedEntry = entry as { payload?: BudgetCategory };
                const categoryValue = typedEntry.payload?.value || 0;
                return `${value}: ${formatCurrency(categoryValue)}`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Data Table */}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Breakdown Details</h4>
        <div className="space-y-2">
          {data.map((category, index) => {
            const percentage = category.percentage || ((category.value / (total || 1)) * 100);
            return (
              <div key={index} className="flex items-center justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: category.color || COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium text-slate-700">{category.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800">
                    {formatCurrency(category.value)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
