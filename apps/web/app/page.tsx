import Link from "next/link";
import { cookies } from "next/headers";
import { CarFront } from "lucide-react";
import { getLocale, homepageCopy } from "@taxilao/shared";
import { Nav } from "./components";
import { BookingEstimator } from "./booking-estimator";

export default async function HomePage({ searchParams }: { searchParams?: { lang?: string } }) {
  const locale = getLocale(searchParams?.lang ?? cookies().get("taxilao_locale")?.value);
  const copy = homepageCopy[locale];

  return (
    <main className="shell">
      <Nav locale={locale} />
      <section className="hero home-booking-hero">
        <div className="home-intro">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.headline}</h1>
          <p className="lead">{copy.lead}</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href={`/booking?lang=${locale}`}>
              <CarFront size={18} /> {copy.bookPremiumDriver}
            </Link>
          </div>
        </div>
        <BookingEstimator />
      </section>
    </main>
  );
}
