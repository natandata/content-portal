import type { Metadata } from "next";

import { ClientContentHub } from "@/features/client/content-hub";
import { getServerDictionary } from "@/lib/i18n/server";
import type { ContentFilter } from "@/features/client/contents";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.content };
}

const VALID_FILTERS: ContentFilter[] = ["awaiting", "approved", "revision"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const contentFilter = VALID_FILTERS.includes(filter as ContentFilter) ? (filter as ContentFilter) : undefined;

  return <ClientContentHub defaultTab="content" contentFilter={contentFilter} />;
}
