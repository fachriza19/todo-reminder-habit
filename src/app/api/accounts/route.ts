import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { createAccountSchema } from "@/lib/validations/account";
import { createAccount, listAccounts } from "@/server/services/account.service";

export function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    return ok(await listAccounts(userId));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(createAccountSchema, await readJson(req));
    return ok(await createAccount(userId, input), { status: 201 });
  });
}
