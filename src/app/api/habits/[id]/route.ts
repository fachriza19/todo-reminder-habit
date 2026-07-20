import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { todayQuerySchema, updateHabitSchema } from "@/lib/validations/habit";
import {
  deleteHabit,
  getHabit,
  updateHabit,
} from "@/server/services/habit.service";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    // See the habits list route: "today" belongs to the client, not the server.
    const today = new URL(req.url).searchParams.get("today");
    const data = await getHabit(
      userId,
      id,
      today === null ? undefined : validate(todayQuerySchema, today),
    );
    return ok(data);
  });
}

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(updateHabitSchema, await readJson(req));
    const data = await updateHabit(userId, id, input);
    return ok(data);
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteHabit(userId, id);
    return ok({ id });
  });
}
