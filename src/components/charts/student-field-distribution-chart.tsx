"use client"

import * as React from "react"
import { Pie, PieChart } from "recharts"

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
            .map(([fieldId, count], index) => ({
                fieldId: fieldId,
                name: fields.find(f => f.id === fieldId)?.name || 'Inconnue',
                count: count,
                fill: `var(--color-${fieldId})`
            }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count);

        const config: ChartConfig = {};
        chartData.forEach((item, index) => {
            config[item.name] = {
                label: item.name,
                color: `hsl(var(--chart-${index + 1}))`
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
          content={<ChartTooltipContent 
            formatter={(value, name) => [`${value} étudiant(s)`, name]}
            hideLabel 
          />}
        />
        <Pie 
            data={data} 
            dataKey="count" 
            nameKey="name" 
            innerRadius={60} 
            strokeWidth={5}
        >
        </Pie>
         <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
        />
      </PieChart>
    </ChartContainer>
  )
}
