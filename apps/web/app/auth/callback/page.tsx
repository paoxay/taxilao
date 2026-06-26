"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useUiCopy } from "../../use-ui-copy";

export default function GoogleCallbackPage() {
  const { copy } = useUiCopy();
  const handled = useRef(false);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Google...");

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const requestedReturnTo = params.get("returnTo") || "/dashboard";
    const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") && !requestedReturnTo.includes("\\")
      ? requestedReturnTo
      : "/dashboard";

    window.history.replaceState(null, "", "/auth/callback");

    if (!accessToken || !refreshToken) {
      setStatus("error");
      setMessage(copy.bookingFailed);
      window.setTimeout(() => window.location.replace("/login?error=missing_token"), 1800);
      return;
    }

    try {
      localStorage.setItem("taxilao_member_access_token", accessToken);
      localStorage.setItem("taxilao_member_refresh_token", refreshToken);
      setStatus("success");
      setMessage(copy.verified);
      window.setTimeout(() => window.location.replace(returnTo), 500);
    } catch {
      setStatus("error");
      setMessage(copy.bookingFailed);
      window.setTimeout(() => window.location.replace("/login?error=missing_token"), 1800);
    }
  }, []);

  return (
    <main className="auth-callback-screen">
      <section className="auth-status-panel">
        {status === "loading" ? <LoaderCircle className="auth-spinner" size={38} /> : null}
        {status === "success" ? <CheckCircle2 size={38} /> : null}
        {status === "error" ? <AlertCircle className="auth-error-icon" size={38} /> : null}
        <h1>{message}</h1>
        <p>{copy.customerProfile}</p>
      </section>
    </main>
  );
}
