import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { logHabitSchema } from "@/lib/validations/habit";
import { logHabit } from "@/server/services/habit.service";

type Ctx = { params: Promise<{ id: string }> };

export function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(logHabitSchema, await readJson(req));
    const data = await logHabit(userId, id, input);
    return ok(data);
  });
}
