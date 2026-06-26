"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";
import { useUiCopy } from "./use-ui-copy";

type AuthState = "loading" | "authenticated" | "guest";

export function MemberAuthGate({ children }: { children: React.ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const { locale, copy } = useUiCopy();
  const [state, setState] = useState<AuthState>("loading");
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    const currentReturnTo = `${window.location.pathname}${window.location.search}`;
    setReturnTo(currentReturnTo);

    async function verifyMember() {
      let accessToken = localStorage.getItem("taxilao_member_access_token");
      const refreshToken = localStorage.getItem("taxilao_member_refresh_token");
      if (!accessToken) {
        setState("guest");
        return;
      }

      let response = await fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      });

      if (response.status === 401 && refreshToken) {
        const refreshResponse = await fetch(`${apiUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });
        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json();
          accessToken = tokens.accessToken;
          localStorage.setItem("taxilao_member_access_token", tokens.accessToken);
          localStorage.setItem("taxilao_member_refresh_token", tokens.refreshToken);
          response = await fetch(`${apiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store"
          });
        }
      }

      if (response.ok) {
        setState("authenticated");
        return;
      }

      localStorage.removeItem("taxilao_member_access_token");
      localStorage.removeItem("taxilao_member_refresh_token");
      setState("guest");
    }

    verifyMember().catch(() => setState("guest"));
  }, [apiUrl]);

  if (state === "loading") {
    return (
      <section className="booking-auth-gate loading">
        <LoaderCircle className="spin" size={28} />
        <p>{copy.checkingAccount}</p>
      </section>
    );
  }

  if (state === "guest") {
    const loginUrl = `/login?lang=${locale}&returnTo=${encodeURIComponent(returnTo)}`;
    return (
      <section className="booking-auth-gate">
        <span className="booking-auth-icon"><LockKeyhole size={25} /></span>
        <div>
          <p className="eyebrow">{copy.memberOnly}</p>
          <h2>{copy.loginBeforeBooking}</h2>
          <p>{copy.loginBeforeBookingHelp}</p>
        </div>
        <Link className="btn btn-primary" href={loginUrl}>
          <LogIn size={18} /> {copy.signIn}
        </Link>
        <small><ShieldCheck size={14} /> {copy.accountBookingSafety}</small>
      </section>
    );
  }

  return <>{children}</>;
}
