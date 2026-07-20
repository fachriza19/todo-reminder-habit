import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { createHabitSchema, todayQuerySchema } from "@/lib/validations/habit";
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
    // The client's local date drives "today" — the server's timezone is not
    // the user's. Omitted only by callers with no browser context.
    const today = searchParams.get("today");
    return ok(
      await listHabits(
        userId,
        today === null ? undefined : validate(todayQuerySchema, today),
      ),
    );
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
