"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const fmtEuro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function jour(iso: string) {
  const [a, m, j] = iso.split("-").map(Number);
  return fmtJour.format(new Date(Date.UTC(a, m - 1, j)));
}

const config = { ca: { label: "CA suivi", color: "var(--chart-1)" } } satisfies ChartConfig;

/** CA suivi par date de vente. */
export function GraphiqueCAJour({ donnees }: { donnees: { date: string; ca: number }[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={donnees} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={jour} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => fmtEuro.format(v)} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent labelFormatter={(_, p) => (p?.[0]?.payload?.date ? jour(p[0].payload.date) : "")} formatter={(v) => <span className="tabular-nums font-medium">{fmtEuro.format(Number(v))}</span>} />}
        />
        <Bar dataKey="ca" fill="var(--color-ca)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

const configPostes = { montant: { label: "Montant", color: "var(--chart-2)" } } satisfies ChartConfig;

export function GraphiqueBarresHorizontales({ donnees }: { donnees: { libelle: string; montant: number }[] }) {
  return (
    <ChartContainer config={configPostes} className="aspect-auto w-full" style={{ height: Math.max(120, donnees.length * 40) }}>
      <BarChart data={donnees} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="libelle" tickLine={false} axisLine={false} width={140} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(v) => <span className="tabular-nums font-medium">{fmtEuro.format(Number(v))}</span>} />} />
        <Bar dataKey="montant" fill="var(--color-montant)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
