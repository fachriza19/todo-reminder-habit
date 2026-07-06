import { handle, ok, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { habitHistoryQuerySchema } from "@/lib/validations/habit";
import { getHabitHistory } from "@/server/services/habit.service";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const { from, to } = validate(habitHistoryQuerySchema, {
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });
    const data = await getHabitHistory(userId, id, from, to);
    return ok(data);
  });
}
