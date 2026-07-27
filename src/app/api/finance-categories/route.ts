import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { createFinanceCategorySchema } from "@/lib/validations/finance-category";
import {
  createFinanceCategory,
  listFinanceCategories,
} from "@/server/services/finance-category.service";

export function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    return ok(await listFinanceCategories(userId));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(createFinanceCategorySchema, await readJson(req));
    return ok(await createFinanceCategory(userId, input), { status: 201 });
  });
}
