import type { Metadata } from "next";

import { FeedBoard } from "@/features/workspace/feed-board";

export const metadata: Metadata = { title: "Feed" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  return <FeedBoard clientId={client} />;
}
