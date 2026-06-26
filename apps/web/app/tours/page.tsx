import { drivers as fallbackDrivers, getLocale } from "@taxilao/shared";
import { Nav, TourCard } from "../components";
import { getDrivers, getTours } from "../api";
import { getUiCopy } from "../ui-copy";

export default async function ToursPage({ searchParams }: { searchParams?: { lang?: string } }) {
  const locale = getLocale(searchParams?.lang);
  const copy = getUiCopy(locale);
  const drivers = await getDrivers();
  const tourPackages = await getTours();

  return (
    <main className="shell">
      <Nav locale={locale} />
      <section className="section alt">
        <div className="section-head">
          <div>
            <p className="eyebrow">{copy.tourPackages}</p>
            <h1 style={{ fontSize: "clamp(38px, 6vw, 72px)" }}>{copy.toursTitle}</h1>
            <p>{copy.toursLead}</p>
          </div>
        </div>
        <div className="cards driver-grid">
          {tourPackages.map((tour) => (
            <TourCard key={tour.id} tour={tour} driverName={drivers.find((driver) => driver.id === tour.driverId)?.name ?? fallbackDrivers.find((driver) => driver.id === tour.driverId)?.name ?? "TAXILAO"} />
          ))}
        </div>
      </section>
    </main>
  );
}
