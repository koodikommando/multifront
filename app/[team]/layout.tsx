import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { getTeam } from "@/lib/teams";

type TeamParams = Promise<{ team: string }>;

export async function generateMetadata({
  params,
}: {
  params: TeamParams;
}): Promise<Metadata> {
  const { team } = await params;
  const config = getTeam(team);
  if (!config) return {};
  return {
    title: config.name,
    robots: { index: false, follow: false },
  };
}

export default async function TeamLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: TeamParams;
}) {
  const { team } = await params;
  const config = getTeam(team);
  if (!config) notFound();

  const themeVars = {
    "--team-primary": config.theme.primary,
    "--team-accent": config.theme.accent,
    "--team-background": config.theme.background,
    "--team-foreground": config.theme.foreground,
    "--team-surface": config.theme.surface,
  } as CSSProperties;

  return (
    <div
      style={themeVars}
      className="min-h-screen bg-(--team-background) text-(--team-foreground)"
    >
      <header className="bg-(--team-primary) px-6 py-4">
        <p className="mx-auto max-w-6xl text-xl font-bold tracking-tight text-(--team-surface)">
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-(--team-accent)" />
          {config.name}
        </p>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
