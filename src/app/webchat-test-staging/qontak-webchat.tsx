"use client";

import Script from "next/script";

declare global {
  interface Window {
    qchatInitialize?: (config: { id: string; code: string }) => void;
  }
}

const QCHAT_BASE = "https://webchat-staging.qontak.net";

/**
 * Qontak webchat (staging) widget. Mirrors the vendor snippet: load the widget
 * bundle, then the initializer, and call qchatInitialize once it is ready.
 */
export function QontakWebchat() {
  return (
    <>
      <Script src={`${QCHAT_BASE}/js/app.js`} strategy="afterInteractive" />
      <Script
        src={`${QCHAT_BASE}/qchatInitialize.js`}
        strategy="afterInteractive"
        onLoad={() => {
          window.qchatInitialize?.({
            id: "c8c288e1-056e-454d-b2f3-0b52c38d994d",
            code: "QswFgwifJTn7rSq3HAEKQg",
          });
        }}
      />
    </>
  );
}
