import Script from "next/script";

/**
 * Qontak webchat (staging) widget — vendor snippet, verbatim.
 * Inline <Script> needs an `id` so Next can track and dedupe it.
 */
export function QontakWebchat() {
  return (
    <Script id="qontak-webchat" strategy="afterInteractive">
      {`
  const qchatInit = document.createElement('script');
  qchatInit.src = "https://webchat-staging.qontak.net/qchatInitialize.js";
  const qchatWidget = document.createElement('script');
  qchatWidget.src = "https://webchat-staging.qontak.net/js/app.js";
  document.head.prepend(qchatInit);
  document.head.prepend(qchatWidget);
  qchatInit.onload = function() { qchatInitialize({
    id: "c8c288e1-056e-454d-b2f3-0b52c38d994d",
    code: "QswFgwifJTn7rSq3HAEKQg"
  })};
`}
    </Script>
  );
}
