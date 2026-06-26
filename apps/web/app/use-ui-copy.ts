"use client";

import { useEffect, useState } from "react";
import { Locale, getLocale } from "@taxilao/shared";
import { getUiCopy } from "./ui-copy";

export function useUiCopy() {
  const [locale, setLocale] = useState<Locale>("lo");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("lang");
    const saved = localStorage.getItem("taxilao_locale") ?? undefined;
    setLocale(getLocale(query ?? saved));
  }, []);

  return { locale, copy: getUiCopy(locale) };
}
