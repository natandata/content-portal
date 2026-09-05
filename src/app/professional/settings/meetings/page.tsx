import type { Metadata } from "next";

import { MeetingSettings } from "@/features/workspace/meeting-settings";

export const metadata: Metadata = { title: "Reunioes" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { error } = await searchParams;
  return <MeetingSettings error={error} />;
}
