"use client";

import { useState } from "react";
import { Calculator, Keyboard } from "lucide-react";
import { toast } from "sonner";

import { useAccounts } from "@/hooks/use-accounts";
import { useFinanceCategories } from "@/hooks/use-finance-categories";
import { useIsMounted } from "@/hooks/use-is-mounted";
import {
  useCreateTransaction,
  useUpdateTransaction,
  type TransactionRefs,
} from "@/hooks/use-transactions";
import type { TransactionType } from "@/lib/expenses";
import { applyNumpadKey, type NumpadKey } from "@/lib/money";
import { cn, getLocalToday } from "@/lib/utils";
import type { TransactionRow } from "@/server/services/transaction.service";
import { useExpenseSheet } from "@/stores/expense-sheet";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { AmountField } from "./amount-field";
import { CategoryChips } from "./category-chips";
import { Numpad } from "./numpad";

export function TransactionSheet({
  open,
  onOpenChange,
  month,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  editing: TransactionRow | null;
}) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit entry" : "Add entry"}
    >
      {/* Mounting the form only while open — and keying it on the entry —
          resets every field on each open. Cheaper and less error-prone than
          syncing seven pieces of state in an effect. */}
      {open ? (
        <TransactionForm
          key={editing?.id ?? "new"}
          month={month}
          editing={editing}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </ResponsiveModal>
  );
}

function TransactionForm({
  month,
  editing,
  onDone,
}: {
  month: string;
  editing: TransactionRow | null;
  onDone: () => void;
}) {
  const { data: categories = [] } = useFinanceCategories();
  const { data: accounts = [] } = useAccounts();
  const create = useCreateTransaction(month);
  const update = useUpdateTransaction(month);

  // The persisted input mode differs from the server default, so gate it on
  // mount to keep the first client render identical to the server's.
  const mounted = useIsMounted();
  const storedMode = useExpenseSheet((s) => s.inputMode);
  const setInputMode = useExpenseSheet((s) => s.setInputMode);
  const inputMode = mounted ? storedMode : "numpad";

  const [type, setType] = useState<TransactionType>(editing?.type ?? "expense");
  const [digits, setDigits] = useState(
    editing ? String(editing.amountMinor) : "",
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    editing?.categoryId ?? null,
  );
  const [accountId, setAccountId] = useState<string | null>(
    editing?.accountId ?? null,
  );
  const [occurredOn, setOccurredOn] = useState(
    editing?.occurredOn ?? getLocalToday(),
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [showNote, setShowNote] = useState(Boolean(editing?.note));

  // A new entry defaults to the first account, but the list may arrive after
  // the first render, so resolve it at use time rather than storing a null.
  const effectiveAccountId = accountId ?? accounts[0]?.id ?? null;

  const amountMinor = digits === "" ? 0 : Number(digits);
  const canSave = amountMinor > 0;
  const visibleCategories = categories.filter((c) => c.kind === type);

  function handleKey(key: NumpadKey) {
    setDigits((d) => applyNumpadKey(d, key));
  }

  function submit() {
    if (!canSave) return;

    const payload = {
      type,
      amountMinor,
      categoryId,
      accountId: effectiveAccountId,
      occurredOn,
      note: note.trim() || null,
    };

    // Labels for the optimistic row, so it renders complete instead of
    // flickering from "Uncategorized" to its real name on refetch.
    const category = categories.find((c) => c.id === categoryId);
    const account = accounts.find((a) => a.id === effectiveAccountId);
    const refs: TransactionRefs = {
      category: category
        ? {
            id: category.id,
            name: category.name,
            color: category.color,
            icon: category.icon,
          }
        : null,
      account: account
        ? { id: account.id, name: account.name, type: account.type }
        : null,
    };

    if (editing) {
      update.mutate(
        { id: editing.id, patch: payload, refs },
        {
          onSuccess: () => toast.success("Entry updated"),
          onError: (e) => toast.error(e.message),
        },
      );
    } else {
      create.mutate(
        { input: payload, refs },
        {
          onSuccess: () =>
            toast.success(type === "income" ? "Income added" : "Expense added"),
          onError: (e) => toast.error(e.message),
        },
      );
    }

    onDone();
  }

  const saveLabel = editing
    ? "Save changes"
    : type === "income"
      ? "Save income"
      : "Save expense";

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* expense/income switch + input mode toggle */}
      <div className="flex items-center justify-between gap-2 px-4 pb-2">
        <div className="bg-muted flex gap-1 rounded-full p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => {
                setType(t);
                setCategoryId(null);
              }}
              className={cn(
                "min-h-11 rounded-full px-4 text-sm font-semibold capitalize transition-colors",
                type === t
                  ? cn(
                      "bg-card shadow-sm",
                      t === "income" ? "text-success" : "text-foreground",
                    )
                  : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            setInputMode(inputMode === "numpad" ? "keyboard" : "numpad")
          }
        >
          {inputMode === "numpad" ? (
            <>
              <Keyboard className="size-4" aria-hidden /> Keyboard
            </>
          ) : (
            <>
              <Calculator className="size-4" aria-hidden /> Numpad
            </>
          )}
        </Button>
      </div>

      <AmountField
        digits={digits}
        onDigitsChange={setDigits}
        type={type}
        inputMode={inputMode}
      />

      <CategoryChips
        categories={visibleCategories}
        value={categoryId}
        onChange={setCategoryId}
      />

      {/* account, date, note — all pre-filled or optional */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={a.id === effectiveAccountId}
            onClick={() => setAccountId(a.id)}
            className={cn(
              "min-h-11 rounded-full border px-3 text-sm transition-colors",
              a.id === effectiveAccountId
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {a.name}
          </button>
        ))}

        <label className="sr-only" htmlFor="expense-date">
          Date
        </label>
        <input
          id="expense-date"
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value || getLocalToday())}
          className="bg-card min-h-11 rounded-full border px-3 text-sm"
        />

        {!showNote ? (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="text-muted-foreground hover:text-foreground min-h-11 rounded-full border border-dashed px-3 text-sm"
          >
            + Note
          </button>
        ) : null}
      </div>

      {showNote ? (
        <div className="px-4 pb-3">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was it for?"
            aria-label="Note"
            maxLength={200}
            className="h-11"
            autoFocus
          />
        </div>
      ) : null}

      {/* In keyboard mode Save moves above the system keyboard, which would
            otherwise cover it — the classic quick-add failure on mobile. */}
      {inputMode === "keyboard" ? (
        <div className="px-4 pb-2">
          <Button
            type="submit"
            disabled={!canSave}
            className={cn(
              "h-12 w-full text-base",
              type === "income" && "bg-success hover:bg-success/90",
            )}
          >
            {saveLabel}
          </Button>
        </div>
      ) : (
        <div className="bg-muted/40 mt-1 border-t">
          <Numpad
            onKey={handleKey}
            onSave={submit}
            saveDisabled={!canSave}
            saveLabel="Save"
            type={type}
          />
        </div>
      )}
    </form>
  );
}
