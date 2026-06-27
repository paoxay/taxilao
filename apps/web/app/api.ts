import { drivers as fallbackDrivers, tourPackages as fallbackTours } from "@taxilao/shared";
import { getApiUrl } from "./config";

const apiUrl = getApiUrl();

export async function getDrivers(query = "") {
  try {
    const response = await fetch(`${apiUrl}/drivers${query}`, { cache: "no-store" });
    if (!response.ok) throw new Error("drivers api failed");
    const data = await response.json();
    return Array.isArray(data) ? data : fallbackDrivers;
  } catch {
    return fallbackDrivers;
  }
}

export async function getDriver(id: string) {
  try {
    const response = await fetch(`${apiUrl}/drivers/${id}`, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return fallbackDrivers.find((driver) => driver.id === id) ?? null;
  }
}

export async function getTours() {
  try {
    const response = await fetch(`${apiUrl}/tours`, { cache: "no-store" });
    if (!response.ok) throw new Error("tours api failed");
    const data = await response.json();
    return Array.isArray(data) ? data : fallbackTours;
  } catch {
    return fallbackTours;
  }
}
