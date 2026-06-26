import { getLocale } from "@taxilao/shared";
import { Nav } from "../../components";
import { BookingEstimator } from "../../booking-estimator";
import { getUiCopy } from "../../ui-copy";

export default function DriverBookingPage({
  searchParams
}: {
  searchParams?: { driverId?: string; lang?: string };
}) {
  const locale = getLocale(searchParams?.lang);
  const copy = getUiCopy(locale);

  return (
    <main className="shell">
      <Nav locale={locale} />
      <section className="booking-screen driver-booking-screen">
        <div className="booking-screen-copy">
          <p className="eyebrow">{copy.driverReservation}</p>
          <h1>{copy.bookSelectedDriver}</h1>
          <p className="lead">{copy.driverReservationLead}</p>
        </div>
        <BookingEstimator bookingMode="driver" initialDriverId={searchParams?.driverId ?? ""} />
      </section>
    </main>
  );
}
