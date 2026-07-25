"use client";

import { useEffect, useState } from "react";

type SettingsResponse = {
  autopilot: {
    enabled: boolean;
    autoPublish: boolean;
    timezone: string;
  };
  telegramConfigured: boolean;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cms/settings")
      .then(async (response) => {
        const data = (await response.json()) as SettingsResponse & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load settings.");
        setSettings(data);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, []);

  async function save() {
    if (!settings) return;
    setError("");
    setMessage("");

    const response = await fetch("/api/cms/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        autopilotEnabled: settings.autopilot.enabled,
        autopilotAutoPublish: settings.autopilot.autoPublish,
        autopilotTimezone: settings.autopilot.timezone,
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to save settings.");
      return;
    }

    setMessage("Settings saved.");
  }

  if (!settings) {
    return <p>{error || "Loading..."}</p>;
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <h1>Autopilot settings</h1>
        <div className="admin-grid" style={{ marginTop: "1rem" }}>
          <label>
            <input
              type="checkbox"
              checked={settings.autopilot.enabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autopilot: { ...settings.autopilot, enabled: e.target.checked },
                })
              }
            />{" "}
            Enable daily autopilot cron
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.autopilot.autoPublish}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autopilot: { ...settings.autopilot, autoPublish: e.target.checked },
                })
              }
            />{" "}
            Auto-publish when quality gates pass
          </label>
          <input
            className="admin-input"
            value={settings.autopilot.timezone}
            onChange={(e) =>
              setSettings({
                ...settings,
                autopilot: { ...settings.autopilot, timezone: e.target.value },
              })
            }
          />
          <p>Telegram configured: {settings.telegramConfigured ? "Yes" : "No"}</p>
          {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
          {message ? <p style={{ color: "#047857" }}>{message}</p> : null}
          <button className="admin-button" type="button" onClick={save}>
            Save settings
          </button>
        </div>
      </section>
    </div>
  );
}
