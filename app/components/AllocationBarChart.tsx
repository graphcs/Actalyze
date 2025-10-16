"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BudgetAllocation } from '@/types/charts';

interface AllocationBarChartProps {
  data: BudgetAllocation[]
  title: string
  description?: string
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

export default function AllocationBarChart({
  data,
  title,
  description,
}: AllocationBarChartProps) {

  const formatCurrency = (value: number) => {
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(1)}T`;
    }
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const formatFullCurrency = (value: number) => {
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(2)} Trillion`;
    }
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)} Billion`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)} Million`;
    }
    return `$${value.toLocaleString()}`;
  };

  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 my-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-slate-600">{description}</p>
        )}
        <div className="mt-2 text-2xl font-bold text-[#1c4e63]">
          Total: {formatFullCurrency(totalAmount)}
        </div>
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data as unknown as Record<string, unknown>[]}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              tickFormatter={formatCurrency}
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              type="category"
              dataKey="category"
              width={150}
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              formatter={(value: number) => [formatFullCurrency(value), 'Amount']}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px'
              }}
              cursor={{ fill: 'rgba(28, 78, 99, 0.1)' }}
            />
            <Bar dataKey="amount" radius={[0, 8, 8, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Data Table */}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Allocation Details</h4>
        <div className="space-y-2">
          {data.map((allocation, index) => {
            const percentage = (allocation.amount / totalAmount) * 100;
            return (
              <div key={index} className="py-3 border-b border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-slate-700">{allocation.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-800">
                      {formatFullCurrency(allocation.amount)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
                {allocation.description && (
                  <p className="text-xs text-slate-600 ml-7 mt-1">{allocation.description}</p>
                )}
                {/* Progress bar */}
                <div className="ml-7 mt-2">
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length]
                      }}
                    />
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
