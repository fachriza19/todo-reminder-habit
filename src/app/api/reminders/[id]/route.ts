import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { updateReminderSchema } from "@/lib/validations/reminder";
import {
  deleteReminder,
  updateReminder,
} from "@/server/services/reminder.service";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(updateReminderSchema, await readJson(req));
    const data = await updateReminder(userId, id, input);
    return ok(data);
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteReminder(userId, id);
    return ok({ id });
  });
}
