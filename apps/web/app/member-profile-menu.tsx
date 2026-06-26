"use client";

import Link from "next/link";
import { BookOpen, ChevronDown, CircleUserRound, Gauge, LogIn, LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiCopy } from "./use-ui-copy";

type Member = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

export function MemberProfileMenu({ mobile = false }: { mobile?: boolean }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const { locale, copy } = useUiCopy();
  const [member, setMember] = useState<Member | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("taxilao_member_access_token");
    if (!token) {
      setLoaded(true);
      return;
    }

    fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired");
        setMember(await response.json());
      })
      .catch(() => setMember(null))
      .finally(() => setLoaded(true));
  }, [apiUrl]);

  function logout() {
    localStorage.removeItem("taxilao_member_access_token");
    localStorage.removeItem("taxilao_member_refresh_token");
    window.location.replace("/");
  }

  if (!loaded) {
    return <span className={mobile ? "member-menu-loading mobile" : "member-menu-loading"} aria-hidden="true" />;
  }

  if (!member) {
    return (
      <Link className={mobile ? "btn member-login-link mobile" : "btn member-login-link"} href={`/login?lang=${locale}`}>
        <LogIn size={16} /> {copy.signIn}
      </Link>
    );
  }

  return (
    <details className={mobile ? "member-menu mobile" : "member-menu"}>
      <summary>
        {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <UserRound size={20} />}
        <span>{member.name || copy.member}</span>
        <ChevronDown className="chevron" size={15} />
      </summary>
      <div className="member-menu-panel">
        <div className="member-menu-head">
          {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <CircleUserRound size={34} />}
          <div><strong>{member.name}</strong><span>{member.email}</span></div>
        </div>
        <Link href={`/profile?lang=${locale}`}><CircleUserRound size={17} /> {copy.customerProfile}</Link>
        <Link href={`/profile?view=trips&lang=${locale}`}><BookOpen size={17} /> {copy.tripHistory}</Link>
        <Link href={`/dashboard?lang=${locale}`}><Gauge size={17} /> {copy.bookingStatus}</Link>
        <button onClick={logout} type="button"><LogOut size={17} /> {copy.logout}</button>
      </div>
    </details>
  );
}
