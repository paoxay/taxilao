import { Nav } from "../../components";
import { DriverApplyForm } from "./apply-form";
import { getLocale } from "@taxilao/shared";
import { getUiCopy } from "../../ui-copy";

export default function DriverApplyPage({ searchParams }: { searchParams?: { lang?: string } }) {
  const locale = getLocale(searchParams?.lang);
  const copy = getUiCopy(locale);
  return (
    <main className="shell">
      <Nav locale={locale} />
      <section className="section">
        <p className="eyebrow">{copy.becomeDriver}</p>
        <h1 style={{ fontSize: "clamp(38px, 6vw, 72px)" }}>{copy.applyTitle}</h1>
        <DriverApplyForm />
      </section>
    </main>
  );
}
