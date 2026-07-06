import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { createCategorySchema } from "@/lib/validations/category";
import {
  createCategory,
  listCategories,
} from "@/server/services/category.service";

export function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const data = await listCategories(userId);
    return ok(data);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(createCategorySchema, await readJson(req));
    const data = await createCategory(userId, input);
    return ok(data, { status: 201 });
  });
}
