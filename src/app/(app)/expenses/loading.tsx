import { TransactionSkeleton } from "@/components/expenses/transaction-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <TransactionSkeleton />
    </div>
  );
}
