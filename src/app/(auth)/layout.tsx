export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-3 flex size-10 items-center justify-center rounded-lg text-lg font-semibold">
            T
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Toreha</h1>
          <p className="text-muted-foreground text-sm">
            Todos, reminders, and habits in one calm place.
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
