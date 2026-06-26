import { Nav } from "../components";
import { BookingEstimator } from "../booking-estimator";
import { getLocale } from "@taxilao/shared";
import { getUiCopy } from "../ui-copy";

export default function BookingPage({ searchParams }: { searchParams?: { tourId?: string; lang?: string } }) {
  const locale = getLocale(searchParams?.lang);
  const copy = getUiCopy(locale);
  return (
    <main className="shell">
      <Nav locale={locale} />
      <section className="booking-screen">
        <div className="booking-screen-copy">
          <p className="eyebrow">{copy.bookingEyebrow}</p>
          <h1>{copy.bookingTitle}</h1>
          <p className="lead">{copy.bookingLead}</p>
          <div className="booking-mini-steps">
            <span>{copy.stepPickup}</span>
            <span>{copy.stepDropoff}</span>
            <span>{copy.stepConfirm}</span>
          </div>
        </div>
        <BookingEstimator initialTourId={searchParams?.tourId ?? ""} />
      </section>
    </main>
  );
}
