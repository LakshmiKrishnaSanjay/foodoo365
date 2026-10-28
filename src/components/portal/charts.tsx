"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

function AxisTick({ value }: { value: number }) {
  return money.format(value);
}

const axisTick = { fill: "var(--foreground)", fontSize: 12 };

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--popover-foreground)",
  },
  labelStyle: { color: "var(--popover-foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--popover-foreground)" },
};

export function TrendChart({
  data,
  series,
}: {
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; name: string; color: string }>;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(value) => AxisTick({ value })} tick={axisTick} axisLine={false} tickLine={false} width={72} />
          <Tooltip formatter={(value) => money.format(Number(value))} {...tooltipStyle} />
          {series.map((item) => (
            <Area key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} fill={item.color} fillOpacity={0.12} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineTrend({ data, series }: { data: Array<Record<string, string | number>>; series: Array<{ key: string; name: string; color: string }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(value) => AxisTick({ value })} tick={axisTick} axisLine={false} tickLine={false} width={72} />
          <Tooltip formatter={(value) => money.format(Number(value))} {...tooltipStyle} />
          <Legend wrapperStyle={{ color: "var(--foreground)" }} />
          {series.map((item) => (
            <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompareBars({ data, xKey = "name", bars }: { data: Array<Record<string, string | number>>; xKey?: string; bars: Array<{ key: string; name: string; color: string }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(value) => AxisTick({ value })} tick={axisTick} axisLine={false} tickLine={false} width={72} />
          <Tooltip formatter={(value) => money.format(Number(value))} {...tooltipStyle} />
          <Legend
            content={() => (
              <ul className="flex flex-wrap justify-center gap-4 pt-2 text-xs text-foreground">
                {bars.map((item) => (
                  <li key={item.key} className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-sm" style={{ background: item.color }} />
                    {item.name}
                  </li>
                ))}
              </ul>
            )}
          />
          {bars.map((item) => (
            <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} radius={4} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CountBars({ data, bars }: { data: Array<Record<string, string | number>>; bars: Array<{ key: string; name: string; color: string }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ color: "var(--foreground)" }} />
          {bars.map((item) => (
            <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} radius={4} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
