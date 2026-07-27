import { AppError, handle, ok, readJson, validate } from "@/lib/api";
import { currentMonthKey, isValidMonthKey } from "@/lib/expenses";
import { requireUserId } from "@/lib/get-session";
import { createTransactionSchema } from "@/lib/validations/transaction";
import {
  createTransaction,
  listMonth,
  type MonthFilters,
} from "@/server/services/transaction.service";

export function GET(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);

    const month = searchParams.get("month") ?? currentMonthKey();
    if (!isValidMonthKey(month)) {
      throw new AppError("VALIDATION_ERROR", "Pick a valid month.");
    }

    const type = searchParams.get("type");
    const filters: MonthFilters = {
      type: type === "expense" || type === "income" ? type : undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      accountId: searchParams.get("accountId") ?? undefined,
      q: searchParams.get("q")?.trim() || undefined,
    };

    return ok(await listMonth(userId, month, filters));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(createTransactionSchema, await readJson(req));
    return ok(await createTransaction(userId, input), { status: 201 });
  });
}
