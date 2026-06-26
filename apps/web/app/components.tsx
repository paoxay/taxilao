"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, ChevronDown, Crown, Languages, Menu, Star } from "lucide-react";
import { Driver, Locale, TourPackage, formatLak, homepageCopy, i18n } from "@taxilao/shared";
import { MemberProfileMenu } from "./member-profile-menu";
import { useUiCopy } from "./use-ui-copy";

export function Nav({ locale = "lo" }: { locale?: Locale }) {
  const [activeLocale, setActiveLocale] = useState<Locale>(locale);
  const copy = homepageCopy[activeLocale];
  const suffix = `?lang=${activeLocale}`;

  useEffect(() => {
    const queryLocale = new URLSearchParams(window.location.search).get("lang");
    const savedLocale = localStorage.getItem("taxilao_locale");
    const nextLocale = i18n.locales.includes(queryLocale as Locale)
      ? (queryLocale as Locale)
      : i18n.locales.includes(savedLocale as Locale)
        ? (savedLocale as Locale)
        : locale;

    setActiveLocale(nextLocale);
    localStorage.setItem("taxilao_locale", nextLocale);
    document.documentElement.lang = nextLocale;
  }, [locale]);

  function selectLocale(nextLocale: Locale) {
    localStorage.setItem("taxilao_locale", nextLocale);
    document.cookie = `taxilao_locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLocale;

    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLocale);
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <nav className="nav">
      <div className="nav-main">
        <Link className="brand" href={`/${suffix}`}>
          <span className="brand-mark">TL</span>
          <span className="brand-name">TAXILAO.COM</span>
        </Link>
      </div>
      <div className="nav-links">
        <Link href={`/drivers${suffix}`}>{copy.navDrivers}</Link>
        <Link href={`/tours${suffix}`}>{copy.navTours}</Link>
        <Link href={`/booking${suffix}`}>{copy.navBooking}</Link>
      </div>
      <LanguageMenu locale={activeLocale} onSelect={selectLocale} />
      <div className="nav-actions">
        <MemberProfileMenu />
        <Link className="btn btn-primary nav-book" href={`/booking${suffix}`}>{copy.book}</Link>
      </div>
      <details className="mobile-menu">
        <summary aria-label="ເປີດເມນູ">
          <Menu size={21} />
        </summary>
        <div className="mobile-menu-panel">
          <Link href={`/drivers${suffix}`}>{copy.navDrivers}</Link>
          <Link href={`/tours${suffix}`}>{copy.navTours}</Link>
          <Link href={`/booking${suffix}`}>{copy.navBooking}</Link>
          <div className="mobile-menu-actions">
            <MemberProfileMenu mobile />
            <Link className="btn btn-primary nav-book" href={`/booking${suffix}`}>{copy.book}</Link>
          </div>
        </div>
      </details>
    </nav>
  );
}

const flagCodes: Record<Locale, string> = {
  lo: "la",
  en: "gb",
  th: "th",
  zh: "cn",
  vi: "vn",
  ja: "jp",
  ko: "kr"
};

export function LanguageMenu({ locale, onSelect }: { locale: Locale; onSelect?: (locale: Locale) => void }) {
  return (
    <details className="language-menu">
      <summary aria-label="Language selector">
        <img className="flag-image" src={`https://flagcdn.com/w40/${flagCodes[locale]}.png`} alt="" />
        <span className="language-current">{i18n.labels[locale]}</span>
        <ChevronDown className="chevron" size={16} />
      </summary>
      <div className="language-panel">
        {i18n.locales.map((item) => (
          <button
            className={item === locale ? "language-option active" : "language-option"}
            key={item}
            onClick={() => onSelect?.(item)}
            type="button"
          >
            <img className="flag-image" src={`https://flagcdn.com/w40/${flagCodes[item]}.png`} alt="" />
            <span>{i18n.nativeNames[item]}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  return (
    <div className="language-switcher" aria-label="Language shortcuts">
      {i18n.locales.map((item) => (
        <Link className={item === locale ? "lang active" : "lang"} href={`/?lang=${item}`} key={item}>
          <span className="flag" aria-hidden="true">{i18n.flags[item]}</span>
          <span>{i18n.labels[item]}</span>
        </Link>
      ))}
    </div>
  );
}

export function DriverCard({ driver }: { driver: Driver }) {
  const { copy } = useUiCopy();
  return (
        <Link className="card" href={`/drivers/${driver.id}`}>
      <img src={driver.vehicleUrl ?? "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1200&q=85"} alt={`${driver.vehicleType} in ${driver.city}`} />
      <div className="card-body">
        <div className="meta" style={{ marginBottom: 10 }}>
          {driver.premium ? (
            <span className="badge gold">
              <Crown size={14} /> {copy.premium}
            </span>
          ) : null}
          {driver.verified ? (
            <span className="badge blue">
              <BadgeCheck size={14} /> {copy.verified}
            </span>
          ) : null}
        </div>
        <h3>{driver.name}</h3>
        <div className="meta">
          <span>{driver.city}</span>
          <span>{driver.vehicleType}</span>
          <span>
            <Star size={14} fill="currentColor" /> {driver.rating} ({driver.reviewCount})
          </span>
        </div>
        <p>{copy.startingPrice}: {formatLak(driver.startingPriceLak ?? 50000)}</p>
      </div>
    </Link>
  );
}

export function TourCard({ tour, driverName }: { tour: TourPackage; driverName: string }) {
  const { copy } = useUiCopy();
  return (
    <article className="card">
      <img src={tour.imageUrl ?? "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=85"} alt={tour.title} />
      <div className="card-body">
        <div className="meta">
          <span>{tour.city}</span>
          <span>{tour.duration}</span>
        </div>
        <h3>{tour.title}</h3>
        <p>{tour.description}</p>
        <div className="meta">
          <span className="badge gold">{formatLak(tour.priceLak)}</span>
          <span>{copy.driver}: {driverName}</span>
        </div>
        <Link className="btn btn-primary" href={`/booking?tourId=${tour.id}`} style={{ width: "100%", marginTop: 14 }}>
          {copy.bookTour}
        </Link>
      </div>
    </article>
  );
}
