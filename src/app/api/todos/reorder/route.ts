import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { reorderTodosSchema } from "@/lib/validations/todo";
import { reorderTodos } from "@/server/services/todo.service";

export function PATCH(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(reorderTodosSchema, await readJson(req));
    await reorderTodos(userId, input);
    return ok({ ok: true });
  });
}
