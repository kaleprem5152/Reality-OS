"use client";

import type { AppSettings } from "@/lib/types";

/**
 * Display/preferences persistence.
 * Client-side localStorage is appropriate here (display prefs only).
 * API keys are NEVER stored here — AI configuration lives server-side.
 */

export const DEFAULT_SETTINGS: AppSettings = {
  currency: "INR",
  defaultStations: 42,
  defaultCorridorKm: 68,
  defaultBudgetCrore: 18500,
  defaultYears: 8,
  mapDefaultLayer: "light",
  mapShowLabels: true,
  compactTables: false,
};

const KEY = "realityos.settings.v1";

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings stay in memory */
  }
}

const PROJECT_KEY = "realityos.currentProject.v1";

export function loadCurrentProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PROJECT_KEY);
  } catch {
    return null;
  }
}

export function saveCurrentProjectId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROJECT_KEY, id);
  } catch {
    /* ignore */
  }
}
