"use client"

import * as React from "react"
import { Pie, PieChart, Cell } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart"
import { User, Field } from "@/lib/types"
import { useMemo } from "react"

interface StudentFieldDistributionChartProps {
    students: User[];
    fields: Field[];
}

const chartColors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(25, 95%, 53%)',
    'hsl(160, 60%, 45%)',
    'hsl(220, 80%, 65%)',
    'hsl(260, 70%, 60%)',
    'hsl(330, 75%, 55%)',
]


export default function StudentFieldDistributionChart({ students, fields }: StudentFieldDistributionChartProps) {

    const { data, chartConfig } = useMemo(() => {
        const fieldCounts: { [key: string]: number } = {};
        fields.forEach(f => fieldCounts[f.id] = 0);

        students.forEach(s => {
            if (s.student?.fieldId && fieldCounts.hasOwnProperty(s.student.fieldId)) {
                fieldCounts[s.student.fieldId]++;
            }
        });
        
        const chartData = Object.entries(fieldCounts)
            .map(([fieldId, count]) => ({
                fieldId: fieldId,
                name: fields.find(f => f.id === fieldId)?.name || 'Inconnue',
                count: count,
                fill: 'var(--color-' + fieldId.replace(/-/g, '_') + ')'
            }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count);

        const config: ChartConfig = {};
        chartData.forEach((item, index) => {
            config[item.name] = {
                label: item.name,
                color: chartColors[index % chartColors.length]
            }
        });

        return { data: chartData, chartConfig: config };

    }, [students, fields]);


  if (data.length === 0) {
    return (
      <div className="flex h-[250px] w-full items-center justify-center">
        <p className="text-muted-foreground">Aucune donnée sur les étudiants à afficher.</p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie data={data} dataKey="count" nameKey="name" innerRadius={60} strokeWidth={5}>
            {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
            ))}
        </Pie>
         <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
        />
      </PieChart>
    </ChartContainer>
  )
}
