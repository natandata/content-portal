import type { Metadata } from "next";

import { TasksList } from "@/features/workspace/tasks-list";

export const metadata: Metadata = { title: "Tarefas" };

export default function Page() {
  return <TasksList />;
}
