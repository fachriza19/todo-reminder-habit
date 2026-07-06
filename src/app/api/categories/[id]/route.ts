import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { updateCategorySchema } from "@/lib/validations/category";
import {
  deleteCategory,
  updateCategory,
} from "@/server/services/category.service";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(updateCategorySchema, await readJson(req));
    const data = await updateCategory(userId, id, input);
    return ok(data);
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteCategory(userId, id);
    return ok({ id });
  });
}
