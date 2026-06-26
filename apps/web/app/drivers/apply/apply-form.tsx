"use client";

import { useState } from "react";
import { useUiCopy } from "../../use-ui-copy";

export function DriverApplyForm() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const { copy } = useUiCopy();
  const [name, setName] = useState("");
  const [city, setCity] = useState("Vientiane");
  const [languages, setLanguages] = useState("Lao, English, Thai");
  const [vehicleType, setVehicleType] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(copy.applicationSending);

    try {
      const response = await fetch(`${apiUrl}/drivers/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          city,
          languages: languages.split(",").map((item) => item.trim()).filter(Boolean),
          vehicleType
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Application failed");
      }

      setStatus("success");
      setMessage(`${copy.applicationSuccess}: ${data.id}`);
      setName("");
      setVehicleType("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : copy.applicationFailed);
    }
  }

  return (
    <form className="booking-panel" onSubmit={submitApplication} style={{ maxWidth: 760, marginTop: 24 }}>
      <div className="grid">
        <div className="field">
          <label htmlFor="driverName">{copy.name}</label>
          <input id="driverName" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="driverCity">{copy.city}</label>
          <input id="driverCity" placeholder="Vientiane" value={city} onChange={(event) => setCity(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="driverLanguages">{copy.languages}</label>
          <input id="driverLanguages" placeholder="Lao, English, Thai" value={languages} onChange={(event) => setLanguages(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="driverVehicle">{copy.vehicle}</label>
          <input id="driverVehicle" placeholder="Toyota Alphard" value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="driverDocuments">{copy.documents}</label>
          <input id="driverDocuments" type="file" />
        </div>
      </div>
      <button className="btn btn-primary" disabled={status === "loading"} style={{ marginTop: 16 }} type="submit">
        {status === "loading" ? copy.submitting : copy.submitApplication}
      </button>
      {message ? <p className={status === "error" ? "form-message error" : "form-message"}>{message}</p> : null}
    </form>
  );
}
