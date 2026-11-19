import type { Metadata } from "next";
import { QontakWebchat } from "./qontak-webchat";

export const metadata: Metadata = {
  title: "Webchat test — staging",
  robots: { index: false, follow: false },
};

export default function WebchatTestStagingPage() {
  return (
    <>
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-full max-w-md">
          <span className="bg-muted text-muted-foreground mb-4 inline-block rounded-full px-3 py-1 text-xs font-medium">
            Staging
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Webchat test page
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            The Qontak webchat widget loads on this page. Open it from the chat
            bubble in the bottom corner.
          </p>
        </div>
      </main>
      {/* Webchat script goes last, after all page content. */}
      <QontakWebchat />
    </>
  );
}
