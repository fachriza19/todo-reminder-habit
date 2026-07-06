import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { updateHabitSchema } from "@/lib/validations/habit";
import {
  deleteHabit,
  getHabit,
  updateHabit,
} from "@/server/services/habit.service";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const data = await getHabit(userId, id);
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
