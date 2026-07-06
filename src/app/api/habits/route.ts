import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { createHabitSchema } from "@/lib/validations/habit";
import {
  createHabit,
  listHabits,
  listArchivedHabits,
} from "@/server/services/habit.service";

export function GET(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    if (searchParams.get("archived") === "1") {
      return ok(await listArchivedHabits(userId));
    }
    return ok(await listHabits(userId));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(createHabitSchema, await readJson(req));
    const data = await createHabit(userId, input);
    return ok(data, { status: 201 });
  });
}
