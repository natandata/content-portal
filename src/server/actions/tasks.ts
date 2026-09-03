"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { TaskRow, TaskStatus } from "@/types/database";

const taskSchema = z.object({
  title: z.string().trim().min(2, "Informe o titulo da tarefa"),
  description: z.string().trim().max(2000).optional(),
  clientId: z.union([z.uuid(), z.literal("")]).optional(),
  dueDate: z.union([z.iso.date(), z.literal("")]).optional(),
  tag: z.string().trim().max(40).optional(),
});

function revalidateTasks() {
  revalidatePath("/professional/tasks");
  revalidatePath("/professional/dashboard");
}

export async function createTaskAction(
  input: z.input<typeof taskSchema>,
): Promise<ActionResult<TaskRow>> {
  const actor = await requireStaff();

  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      professional_id: actor.authUser.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      client_id: parsed.data.clientId || null,
      due_date: parsed.data.dueDate || null,
      tag: parsed.data.tag || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel criar a tarefa."));
  }

  revalidateTasks();
  return ok(data);
}

export async function updateTaskAction(
  taskId: string,
  input: z.input<typeof taskSchema>,
): Promise<ActionResult<TaskRow>> {
  await requireStaff();

  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      client_id: parsed.data.clientId || null,
      due_date: parsed.data.dueDate || null,
      tag: parsed.data.tag || null,
    })
    .eq("id", taskId)
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel atualizar a tarefa."));
  }

  revalidateTasks();
  return ok(data);
}

export async function setTaskStatusAction(
  taskId: string,
  status: TaskStatus,
): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel alterar o status da tarefa."));
  }

  revalidateTasks();
  return done();
}

/** Usado pelo Calendario: muda so o prazo, sem tocar no resto da tarefa. */
export async function setTaskDueDateAction(
  taskId: string,
  dueDate: string | null,
): Promise<ActionResult<null>> {
  await requireStaff();

  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return fail("Data invalida.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ due_date: dueDate })
    .eq("id", taskId);

  if (error) {
    return fail(describeError(error, "Nao foi possivel alterar o prazo da tarefa."));
  }

  revalidateTasks();
  revalidatePath("/professional/calendar");
  return done();
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel excluir a tarefa."));
  }

  revalidateTasks();
  return done();
}
