import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { MainLayout } from "@/components/layout/main-layout";
import { ThemeProvider } from "@/components/layout/theme-provider";

const fontSans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "MiniAlice",
  description: "文件驱动的 AI 交易代理，内置交易流程与沙箱回放能力。"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="darkreader-lock" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
  var darkReaderAttrs = [
    "data-darkreader-inline-stroke",
    "data-darkreader-inline-fill",
    "data-darkreader-inline-color",
    "data-darkreader-inline-bgcolor"
  ];

  function sanitizeElement(element) {
    if (!element || element.nodeType !== 1) {
      return;
    }

    for (var i = 0; i < darkReaderAttrs.length; i += 1) {
      if (element.hasAttribute(darkReaderAttrs[i])) {
        element.removeAttribute(darkReaderAttrs[i]);
      }
    }

    if (!element.hasAttribute("style")) {
      return;
    }

    var rawStyle = element.getAttribute("style");
    if (!rawStyle || rawStyle.indexOf("--darkreader-inline-") === -1) {
      return;
    }

    var cleaned = rawStyle.replace(/--darkreader-inline-[^:;]+:[^;]+;?/g, "").trim();
    if (cleaned.length > 0) {
      element.setAttribute("style", cleaned);
    } else {
      element.removeAttribute("style");
    }
  }

  function sanitizeTree(root) {
    sanitizeElement(root);
    if (!root || !root.querySelectorAll) {
      return;
    }

    var matched = root.querySelectorAll(
      "[data-darkreader-inline-stroke], [data-darkreader-inline-fill], [data-darkreader-inline-color], [data-darkreader-inline-bgcolor], [style*=\\"--darkreader-inline-\\"]"
    );

    for (var i = 0; i < matched.length; i += 1) {
      sanitizeElement(matched[i]);
    }
  }

  sanitizeTree(document.documentElement);

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i += 1) {
      var mutation = mutations[i];
      sanitizeElement(mutation.target);

      if (mutation.type === "childList" && mutation.addedNodes) {
        for (var j = 0; j < mutation.addedNodes.length; j += 1) {
          sanitizeTree(mutation.addedNodes[j]);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style"].concat(darkReaderAttrs)
  });

  window.addEventListener("load", function () {
    sanitizeTree(document.documentElement);
    setTimeout(function () {
      observer.disconnect();
    }, 4000);
  });
})();`
          }}
        />
      </head>
      <body suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MainLayout>
            {children}
          </MainLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}