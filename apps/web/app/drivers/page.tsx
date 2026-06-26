import Link from "next/link";
import { BadgeCheck, Car, Crown, Filter, Languages, MapPin, Search, Star } from "lucide-react";
import { Nav } from "../components";
import { getDrivers } from "../api";
import { formatLak, getLocale } from "@taxilao/shared";
import { getUiCopy } from "../ui-copy";

export default async function DriversPage({
  searchParams
}: {
  searchParams?: { city?: string; language?: string; premium?: string; rating?: string; lang?: string };
}) {
  const locale = getLocale(searchParams?.lang);
  const copy = getUiCopy(locale);
  const params = new URLSearchParams();
  if (searchParams?.city) params.set("city", searchParams.city);
  if (searchParams?.language) params.set("language", searchParams.language);
  if (searchParams?.premium) params.set("premium", searchParams.premium);
  const query = params.toString() ? `?${params.toString()}` : "";
  const drivers = await getDrivers(query);
  const minRating = searchParams?.rating ? Number(searchParams.rating) : 0;
  const sortedDrivers = [...drivers]
    .filter((driver) => Number(driver.rating ?? 0) >= minRating)
    .sort((a, b) => Number(b.premium) - Number(a.premium) || Number(b.rating ?? 0) - Number(a.rating ?? 0));
  const cities = Array.from(new Set(drivers.map((driver) => driver.city).filter(Boolean))).sort();
  const languages = Array.from(new Set(drivers.flatMap((driver) => driver.languages ?? []).filter(Boolean))).sort();

  return (
    <main className="shell">
      <Nav locale={locale} />
      <section className="drivers-market">
        <div className="drivers-toolbar">
          <div>
            <p className="eyebrow">{copy.marketplace}</p>
            <h1>{copy.availableDrivers}</h1>
          </div>
          <span className="driver-count-pill"><Car size={16} /> {sortedDrivers.length} {copy.items}</span>
        </div>

        <div className="driver-board">
          <details className="driver-filter-panel">
            <summary className="filter-title">
              <Search size={18} />
              <div>
                <p className="eyebrow">{copy.filter}</p>
                <h2>{copy.filterList}</h2>
              </div>
            </summary>
            <form className="driver-filters">
              <input name="lang" type="hidden" value={locale} />
              <div className="field">
                <label htmlFor="city">{copy.city}</label>
                <select id="city" name="city" defaultValue={searchParams?.city ?? ""}>
                  <option value="">{copy.allCities}</option>
                  {cities.map((city) => <option value={city} key={city}>{city}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="language">{copy.languages}</label>
                <select id="language" name="language" defaultValue={searchParams?.language ?? ""}>
                  <option value="">{copy.allLanguages}</option>
                  {languages.map((language) => <option value={language} key={language}>{language}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="premium">{copy.type}</label>
                <select id="premium" name="premium" defaultValue={searchParams?.premium ?? ""}>
                  <option value="">{copy.everyone}</option>
                  <option value="true">Premium only</option>
                  <option value="false">Standard</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="rating">Rating</label>
                <select id="rating" name="rating" defaultValue={searchParams?.rating ?? ""}>
                  <option value="">{copy.allRatings}</option>
                  <option value="4.5">4.5+ stars</option>
                  <option value="4.8">4.8+ stars</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit">
                <Filter size={16} /> {copy.applyFilter}
              </button>
              <Link className="btn" href={`/drivers?lang=${locale}`}>{copy.clearFilter}</Link>
            </form>
          </details>

          <section className="driver-results">
            <div className="driver-results-head">
              <div>
                <p className="eyebrow">{copy.available}</p>
                <h2>{sortedDrivers.length} {copy.foundDrivers}</h2>
              </div>
              <div className="driver-view-chip">{copy.scrollList}</div>
            </div>
            <div className="driver-order-list">
              {sortedDrivers.map((driver, index) => (
                <DriverOrderRow driver={driver} index={index} locale={locale} key={driver.id} />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function DriverOrderRow({ driver, index, locale }: { driver: any; index: number; locale: ReturnType<typeof getLocale> }) {
  const copy = getUiCopy(locale);
  const routes = Array.isArray(driver.routes) ? driver.routes.slice(0, 2) : [];
  const languages = Array.isArray(driver.languages) ? driver.languages.slice(0, 3) : [];
  const imageUrl = driver.vehicleUrl ?? "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1200&q=85";

  return (
    <article className={driver.premium ? "driver-order premium" : "driver-order"}>
      <div className="driver-rank">#{String(index + 1).padStart(2, "0")}</div>
      <Link className="driver-order-media" href={`/drivers/${driver.id}`}>
        <img src={imageUrl} alt={`${driver.vehicleType} in ${driver.city}`} />
      </Link>
      <div className="driver-order-main">
        <div className="driver-order-top">
          <div>
            <div className="driver-badges">
              {driver.premium ? <span className="badge gold"><Crown size={14} /> {copy.premium}</span> : null}
              {driver.verified ? <span className="badge blue"><BadgeCheck size={14} /> {copy.verified}</span> : null}
              <span className="badge"><Car size={14} /> {copy.available}</span>
            </div>
            <h3>{driver.name}</h3>
          </div>
          <div className="driver-price">
            <span>{copy.startingPrice}</span>
            <strong>{formatLak(driver.startingPriceLak ?? 50000)}</strong>
          </div>
        </div>

        <div className="driver-order-meta">
          <span><MapPin size={15} /> {driver.city}</span>
          <span><Car size={15} /> {driver.vehicleType}</span>
          <span><Star size={15} fill="currentColor" /> {driver.rating ?? 0} ({driver.reviewCount ?? 0})</span>
          <span><Languages size={15} /> {languages.join(", ") || "Lao"}</span>
        </div>

        <div className="route-strip">
          {routes.length ? routes.map((route: string) => <span key={route}>{route}</span>) : <span>{copy.customRoute}</span>}
        </div>
      </div>

      <div className="driver-order-actions">
        <Link className="btn btn-primary" href={`/booking/driver?driverId=${driver.id}&lang=${locale}`}>{copy.bookDriver}</Link>
        <Link className="btn" href={`/drivers/${driver.id}?lang=${locale}`}>{copy.details}</Link>
      </div>
    </article>
  );
}
