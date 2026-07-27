import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * UI-only state for the add/edit sheet. The input mode is a genuine personal
 * preference — some people want the numpad, some want the system keyboard — so
 * it persists per device and the sheet reopens the way it was last used.
 *
 * As with the todo view store, consumers must gate the restored value behind
 * useIsMounted so the first client render matches the server default.
 */
type ExpenseSheetState = {
  inputMode: "numpad" | "keyboard";
  setInputMode: (mode: "numpad" | "keyboard") => void;
};

export const useExpenseSheet = create<ExpenseSheetState>()(
  persist(
    (set) => ({
      inputMode: "numpad",
      setInputMode: (inputMode) => set({ inputMode }),
    }),
    { name: "flow-expense-sheet" },
  ),
);
