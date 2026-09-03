import type { Metadata } from "next";

import { CalendarBoard } from "@/features/workspace/calendar-board";

export const metadata: Metadata = { title: "Calendario" };

export default function Page() {
  return <CalendarBoard />;
}
