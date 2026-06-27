import { Chrome, LockKeyhole, ShieldCheck } from "lucide-react";
import { Nav } from "../components";
import { getLocale } from "@taxilao/shared";
import { getApiUrl } from "../config";
import { getUiCopy } from "../ui-copy";

const errorMessages: Record<string, string> = {
  google_not_configured: "ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Google OAuth",
  invalid_state: "ການຢືນຢັນໝົດອາຍຸ ກະລຸນາລອງໃໝ່",
  google_login_failed: "Google ບໍ່ສາມາດຢືນຢັນບັນຊີນີ້ໄດ້",
  missing_token: "ບໍ່ພົບຂໍ້ມູນເຂົ້າລະບົບ"
};

function safeReturnTo(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/dashboard";
}

export default function LoginPage({ searchParams }: { searchParams?: { error?: string; lang?: string; returnTo?: string } }) {
  const apiUrl = getApiUrl();
  const locale = getLocale(searchParams?.lang);
  const copy = getUiCopy(locale);
  const error = searchParams?.error ? errorMessages[searchParams.error] : "";
  const returnTo = safeReturnTo(searchParams?.returnTo);

  return (
    <main className="shell">
      <Nav locale={locale} />
      <section className="member-login">
        <div className="member-login-copy">
          <p className="eyebrow">TAXILAO MEMBER</p>
          <h1>{copy.loginTitle}</h1>
          <p className="lead">{copy.loginLead}</p>
        </div>
        <div className="member-login-panel">
          <div className="member-login-icon"><ShieldCheck size={28} /></div>
          <h2>{copy.loginGoogle}</h2>
          <p>{copy.loginGoogleLead}</p>
          {error ? <p className="form-message error">{error}</p> : null}
          <a className="btn google-login-button" href={`${apiUrl}/auth/google?returnTo=${encodeURIComponent(returnTo)}`}>
            <Chrome size={20} /> {copy.continueGoogle}
          </a>
          <div className="member-login-note">
            <LockKeyhole size={15} />
            <span>{copy.passwordNote}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
