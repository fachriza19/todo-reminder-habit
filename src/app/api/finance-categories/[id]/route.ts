import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { updateFinanceCategorySchema } from "@/lib/validations/finance-category";
import {
  archiveFinanceCategory,
  updateFinanceCategory,
} from "@/server/services/finance-category.service";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(updateFinanceCategorySchema, await readJson(req));
    return ok(await updateFinanceCategory(userId, id, input));
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await archiveFinanceCategory(userId, id);
    return ok({ id });
  });
}
