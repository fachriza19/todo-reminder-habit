import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { createTodoSchema } from "@/lib/validations/todo";
import { createTodo, listTodos } from "@/server/services/todo.service";

export function GET(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);

    const categoryParam = searchParams.get("category");
    const categoryId =
      categoryParam === null
        ? undefined
        : categoryParam === "none"
          ? null
          : categoryParam;

    const showDone = searchParams.get("showDone") !== "false";

    const data = await listTodos(userId, { categoryId, showDone });
    return ok(data);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(createTodoSchema, await readJson(req));
    const data = await createTodo(userId, input);
    return ok(data, { status: 201 });
  });
}
