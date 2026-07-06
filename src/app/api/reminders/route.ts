import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { createReminderSchema } from "@/lib/validations/reminder";
import {
  createReminder,
  listReminders,
} from "@/server/services/reminder.service";

export function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const data = await listReminders(userId);
    return ok(data);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(createReminderSchema, await readJson(req));
    const data = await createReminder(userId, input);
    return ok(data, { status: 201 });
  });
}
