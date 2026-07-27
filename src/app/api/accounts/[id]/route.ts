import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { updateAccountSchema } from "@/lib/validations/account";
import {
  archiveAccount,
  updateAccount,
} from "@/server/services/account.service";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(updateAccountSchema, await readJson(req));
    return ok(await updateAccount(userId, id, input));
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await archiveAccount(userId, id);
    return ok({ id });
  });
}
