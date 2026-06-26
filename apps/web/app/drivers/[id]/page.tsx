import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Crown, MessageCircle, Star } from "lucide-react";
import { formatLak, getLocale } from "@taxilao/shared";
import { Nav } from "../../components";
import { getDriver } from "../../api";
import { getUiCopy } from "../../ui-copy";

export default async function DriverProfilePage({ params, searchParams }: { params: { id: string }; searchParams?: { lang?: string } }) {
  const locale = getLocale(searchParams?.lang);
  const copy = getUiCopy(locale);
  const driver = await getDriver(params.id);

  if (!driver) {
    notFound();
  }

  const routes: string[] = Array.isArray(driver.routes) ? driver.routes : [];
  const languages: string[] = Array.isArray(driver.languages) ? driver.languages : [];

  return (
    <main className="shell">
      <Nav locale={locale} />
      <section className="section">
        {driver.coverUrl ? <img className="driver-cover" src={driver.coverUrl} alt={`${driver.name} cover`} /> : null}
        <div className="profile">
          <div className="panel" style={{ padding: 16, borderRadius: 8 }}>
            <img className="profile-photo" src={driver.portraitUrl ?? "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=900&q=85"} alt={driver.name} />
            <img className="profile-photo" style={{ marginTop: 14 }} src={driver.vehicleUrl ?? "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1200&q=85"} alt={driver.vehicleType} />
          </div>
          <div>
            <div className="meta" style={{ marginBottom: 12 }}>
              {driver.premium ? (
                <span className="badge gold">
                  <Crown size={14} /> {copy.premium} {copy.driver}
                </span>
              ) : null}
              {driver.verified ? (
                <span className="badge blue">
                  <BadgeCheck size={14} /> {copy.verified}
                </span>
              ) : null}
            </div>
            <h1 style={{ fontSize: "clamp(38px, 6vw, 76px)" }}>{driver.name}</h1>
            <p className="lead">{driver.bio ?? "Verified TAXILAO driver ready for airport transfers, private routes, and premium travel across Laos."}</p>
            <div className="cards" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 26 }}>
              <div className="panel" style={{ padding: 18, borderRadius: 8 }}>
                <div className="meta">{copy.city}</div>
                <h3>{driver.city}</h3>
              </div>
              <div className="panel" style={{ padding: 18, borderRadius: 8 }}>
                <div className="meta">{copy.rating}</div>
                <h3>
                  <Star size={18} fill="currentColor" /> {driver.rating ?? 0} / {driver.reviewCount ?? 0} {copy.reviews}
                </h3>
              </div>
              <div className="panel" style={{ padding: 18, borderRadius: 8 }}>
                <div className="meta">{copy.vehicle}</div>
                <h3>{driver.vehicleType}</h3>
              </div>
              <div className="panel" style={{ padding: 18, borderRadius: 8 }}>
                <div className="meta">{copy.startingPrice}</div>
                <h3>{formatLak(driver.startingPriceLak ?? 50000)}</h3>
              </div>
            </div>
            <h2>{copy.routes}</h2>
            <div className="meta">
              {routes.map((route) => (
                <span className="badge" key={route}>{route}</span>
              ))}
            </div>
            <h2>{copy.languages}</h2>
            <div className="meta">
              {languages.map((language) => (
                <span className="badge" key={language}>{language}</span>
              ))}
            </div>
            <div className="hero-actions">
              <Link className="btn btn-primary" href={`/booking/driver?driverId=${driver.id}&lang=${locale}`}>{copy.bookDriver}</Link>
              <Link className="btn" href={`/login?lang=${locale}`}>
                <MessageCircle size={16} /> {copy.contact}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
