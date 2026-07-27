import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { updateTransactionSchema } from "@/lib/validations/transaction";
import {
  deleteTransaction,
  updateTransaction,
} from "@/server/services/transaction.service";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(updateTransactionSchema, await readJson(req));
    return ok(await updateTransaction(userId, id, input));
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteTransaction(userId, id);
    return ok({ id });
  });
}
