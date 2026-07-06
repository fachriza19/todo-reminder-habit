import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * UI-only state for the Todo view (PRD: Zustand for UI state).
 * `activeCategory`: null = all, "none" = uncategorized, string = category id.
 *
 * Persists to localStorage and restores synchronously on the client. Because
 * the restored value can differ from the server-rendered defaults, consumers
 * must gate store-derived DOM attributes behind a mount flag (useIsMounted) so
 * the first client render matches the server (see todos-view).
 */
type TodoViewState = {
  showDone: boolean;
  activeCategory: string | null;
  toggleShowDone: () => void;
  setActiveCategory: (value: string | null) => void;
};

export const useTodoView = create<TodoViewState>()(
  persist(
    (set) => ({
      showDone: true,
      activeCategory: null,
      toggleShowDone: () => set((s) => ({ showDone: !s.showDone })),
      setActiveCategory: (value) => set({ activeCategory: value }),
    }),
    { name: "flow-todo-view" },
  ),
);
