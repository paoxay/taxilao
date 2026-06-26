"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Car, ChevronLeft, ChevronRight, Crown, Languages, MapPin, Star } from "lucide-react";
import { formatLak, Locale } from "@taxilao/shared";
import { getUiCopy } from "./ui-copy";

type HomeDriver = {
  id: string;
  name: string;
  city: string;
  languages?: string[];
  vehicleType: string;
  rating?: number;
  reviewCount?: number;
  startingPriceLak?: number;
  premium?: boolean;
  verified?: boolean;
  vehicleUrl?: string;
};

type HomeTour = {
  id: string;
  title: string;
  city: string;
  duration: string;
  priceLak: number;
  description: string;
  imageUrl?: string;
  featuredOnHome?: boolean;
  sortOrder?: number;
};

export function HomeDriverList({ drivers, locale }: { drivers: HomeDriver[]; locale: Locale }) {
  const copy = getUiCopy(locale);

  return (
    <div className="home-driver-list">
      {drivers.slice(0, 6).map((driver, index) => (
        <article className={driver.premium ? "home-driver-row premium" : "home-driver-row"} key={driver.id}>
          <span className="home-driver-rank">{String(index + 1).padStart(2, "0")}</span>
          <img src={driver.vehicleUrl || "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=640&q=82"} alt={driver.vehicleType} />
          <div className="home-driver-main">
            <div className="home-driver-name">
              <h3>{driver.name}</h3>
              <div>
                {driver.premium ? <span><Crown size={13} /> {copy.premium}</span> : null}
                {driver.verified ? <span><BadgeCheck size={13} /> {copy.verified}</span> : null}
              </div>
            </div>
            <div className="home-driver-meta">
              <span><MapPin size={14} /> {driver.city}</span>
              <span><Car size={14} /> {driver.vehicleType}</span>
              <span><Star size={14} fill="currentColor" /> {driver.rating ?? 0}</span>
              <span><Languages size={14} /> {(driver.languages || []).slice(0, 2).join(", ") || "Lao"}</span>
            </div>
          </div>
          <div className="home-driver-price">
            <small>{copy.startingPrice}</small>
            <strong>{formatLak(driver.startingPriceLak ?? 50000)}</strong>
          </div>
          <div className="home-driver-actions">
            <Link className="btn btn-primary" href={`/booking/driver?driverId=${driver.id}&lang=${locale}`}>{copy.bookDriver}</Link>
            <Link className="btn" href={`/drivers/${driver.id}?lang=${locale}`}>{copy.details}</Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export function TourBannerCarousel({ tours, locale }: { tours: HomeTour[]; locale: Locale }) {
  const copy = getUiCopy(locale);
  const slides = useMemo(
    () => [...tours].filter((tour) => tour.featuredOnHome !== false).sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)),
    [tours]
  );
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;
  const tour = slides[active];

  function move(direction: number) {
    setActive((current) => (current + direction + slides.length) % slides.length);
  }

  return (
    <section className="tour-banner" aria-label={copy.tourPackages}>
      <img src={tour.imageUrl || "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1800&q=88"} alt={tour.title} />
      <div className="tour-banner-shade" />
      <div className="tour-banner-content">
        <p className="eyebrow">{copy.tourPackages} · {tour.city}</p>
        <h2>{tour.title}</h2>
        <p>{tour.description}</p>
        <div className="tour-banner-meta">
          <span>{tour.duration}</span>
          <strong>{formatLak(tour.priceLak)}</strong>
        </div>
        <div className="tour-banner-actions">
          <Link className="btn btn-primary" href={`/booking?tourId=${tour.id}&lang=${locale}`}>{copy.bookTour}</Link>
          <Link className="btn" href={`/tours?lang=${locale}`}>{copy.allTours}</Link>
        </div>
      </div>
      {slides.length > 1 ? (
        <>
          <button className="tour-banner-arrow previous" onClick={() => move(-1)} aria-label="Previous tour" type="button"><ChevronLeft /></button>
          <button className="tour-banner-arrow next" onClick={() => move(1)} aria-label="Next tour" type="button"><ChevronRight /></button>
          <div className="tour-banner-dots">
            {slides.map((slide, index) => <button className={index === active ? "active" : ""} onClick={() => setActive(index)} aria-label={slide.title} key={slide.id} type="button" />)}
          </div>
        </>
      ) : null}
    </section>
  );
}
