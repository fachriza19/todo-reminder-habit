import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { updateTodoSchema } from "@/lib/validations/todo";
import { deleteTodo, updateTodo } from "@/server/services/todo.service";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(updateTodoSchema, await readJson(req));
    const data = await updateTodo(userId, id, input);
    return ok(data);
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteTodo(userId, id);
    return ok({ id });
  });
}
