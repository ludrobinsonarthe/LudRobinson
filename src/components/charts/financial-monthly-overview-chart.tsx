
"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { format, subMonths, getMonth, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  type ChartConfig,
} from "@/components/ui/chart"
import { CashTransaction } from "@/lib/types";
import { useMemo } from "react";

interface FinancialMonthlyOverviewChartProps {
    transactions: CashTransaction[];
}

const chartConfig = {
  income: {
    label: "Entrées",
    color: "hsl(var(--chart-2))",
  },
  expense: {
    label: "Sorties",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig

export default function FinancialMonthlyOverviewChart({ transactions }: FinancialMonthlyOverviewChartProps) {
  
    const chartData = useMemo(() => {
        const data: { month: string, income: number, expense: number }[] = [];
        const today = new Date();

        for (let i = 11; i >= 0; i--) {
            const date = subMonths(today, i);
            const month = getMonth(date);
            const year = getYear(date);
            const monthName = format(date, 'MMM', { locale: fr });
            
            const monthlyTransactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                return getMonth(tDate) === month && getYear(tDate) === year;
            });

            const income = monthlyTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
            const expense = monthlyTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

            data.push({ month: monthName.charAt(0).toUpperCase() + monthName.slice(1), income, expense });
        }
        return data;

    }, [transactions]);
    
  if (transactions.length === 0) {
    return (
      <div className="flex h-[250px] w-full items-center justify-center">
        <p className="text-muted-foreground">Aucune transaction à afficher.</p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dashed" />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={4} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
