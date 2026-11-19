import Script from "next/script";

/**
 * Qontak webchat (staging) widget, based on the vendor snippet with two fixes:
 *
 * 1. Load order. The vendor snippet loads qchatInitialize.js and js/app.js in
 *    parallel, but app.js reads qchat_id / qchat_code from localStorage at load
 *    time and qchatInitialize() is what writes them. On a first visit app.js
 *    usually wins the race and the iframe opens with `c=null&i=null` (empty
 *    widget). Here app.js is only injected after qchatInitialize() has run.
 *
 * 2. color-scheme. next-themes puts `color-scheme: dark` on <html> in dark
 *    mode. A cross-origin iframe whose color-scheme differs from its embedder
 *    is painted with an opaque backdrop, so the widget showed as a white box.
 *    Resetting the iframe's color-scheme keeps its background transparent.
 */
export function QontakWebchat() {
  return (
    <Script id="qontak-webchat" strategy="afterInteractive">
      {`
  const qchatInit = document.createElement('script');
  qchatInit.src = "https://webchat-staging.qontak.net/qchatInitialize.js";
  qchatInit.onload = function() {
    qchatInitialize({
      id: "c8c288e1-056e-454d-b2f3-0b52c38d994d",
      code: "QswFgwifJTn7rSq3HAEKQg"
    });
    const qchatWidget = document.createElement('script');
    qchatWidget.src = "https://webchat-staging.qontak.net/js/app.js";
    qchatWidget.onload = function() {
      const frame = document.getElementById('qontak-webchat-widget');
      if (frame) frame.style.colorScheme = 'normal';
    };
    document.head.prepend(qchatWidget);
  };
  document.head.prepend(qchatInit);
`}
    </Script>
  );
}
