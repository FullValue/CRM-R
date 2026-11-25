"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const fmtEuro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const fmtAxeEuro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtMois = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" });
const fmtJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function libelleDate(iso: string, parMois: boolean) {
  const [a, m, j] = iso.split("-").map(Number);
  return (parMois ? fmtMois : fmtJour).format(new Date(Date.UTC(a, m - 1, j)));
}

const config = { ca: { label: "CA suivi", color: "var(--chart-1)" } } satisfies ChartConfig;

/** CA suivi par date de vente. */
export function GraphiqueCAJour({ donnees, parMois = false }: { donnees: readonly { date: string; ca: number }[]; parMois?: boolean }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-52 w-full sm:h-60">
      <BarChart data={donnees} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(date: string) => libelleDate(date, parMois)} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => fmtAxeEuro.format(v)} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent labelFormatter={(_, p) => (p?.[0]?.payload?.date ? libelleDate(p[0].payload.date, parMois) : "")} formatter={(v) => <span className="tabular-nums font-medium">{fmtEuro.format(Number(v))}</span>} />}
        />
        <Bar dataKey="ca" fill="var(--color-ca)" radius={[6, 6, 1, 1]} maxBarSize={34} isAnimationActive={false} />
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
        <Bar dataKey="montant" fill="var(--color-montant)" radius={4} maxBarSize={23} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
