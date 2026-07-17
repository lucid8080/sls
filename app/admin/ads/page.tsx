"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AdPlacementDefinition } from "@/lib/ads/types";
import type { AdSettings } from "@/lib/ads/types";

type AdsResponse = {
  settings: AdSettings;
  placements: AdPlacementDefinition[];
  groups: Array<{ id: AdPlacementDefinition["group"]; label: string }>;
};

export default function AdminAdsPage() {
  const [data, setData] = useState<AdsResponse | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/cms/ads")
      .then(async (response) => {
        const payload = (await response.json()) as AdsResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Failed to load ad settings.");
        setData(payload);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, []);

  const grouped = useMemo(() => {
    if (!data) return [];
    return data.groups
      .map((group) => ({
        ...group,
        placements: data.placements.filter((placement) => placement.group === group.id),
      }))
      .filter((group) => group.placements.length > 0);
  }, [data]);

  async function save(next: AdsResponse) {
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/cms/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        globalEnabled: next.settings.globalEnabled,
        placements: next.settings.placements,
      }),
    });

    const payload = (await response.json()) as { error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to save ad settings.");
      return;
    }

    setMessage("Ad settings saved.");
  }

  async function resetDefaults() {
    if (!data) return;
    setSaving(true);
    const response = await fetch("/api/cms/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });
    const payload = (await response.json()) as AdsResponse & { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(payload.error ?? "Failed to reset ad settings.");
      return;
    }
    setData({ ...data, settings: payload.settings });
    setMessage("Reset to default placement map.");
  }

  function togglePlacement(key: string, enabled: boolean) {
    if (!data) return;
    setData({
      ...data,
      settings: {
        ...data.settings,
        placements: {
          ...data.settings.placements,
          [key]: { enabled },
        },
      },
    });
  }

  function setGroupEnabled(groupId: AdPlacementDefinition["group"], enabled: boolean) {
    if (!data) return;
    const placements = { ...data.settings.placements };
    for (const placement of data.placements.filter((entry) => entry.group === groupId)) {
      placements[placement.key] = { enabled };
    }
    setData({
      ...data,
      settings: {
        ...data.settings,
        placements,
      },
    });
  }

  if (!data) {
    return <p>{error || "Loading ad settings..."}</p>;
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <div className="admin-ads-header">
          <div>
            <h1>Ad placements</h1>
            <p>Manage Ezoic slots for the public site. Preview links open mock wireframes for each placement.</p>
          </div>
          <div className="admin-ads-actions">
            <button className="admin-button secondary" type="button" onClick={resetDefaults} disabled={saving}>
              Reset defaults
            </button>
            <button className="admin-button" type="button" onClick={() => save(data)} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        <label className="admin-ads-global">
          <input
            type="checkbox"
            checked={data.settings.globalEnabled}
            onChange={(event) =>
              setData({
                ...data,
                settings: { ...data.settings, globalEnabled: event.target.checked },
              })
            }
          />
          Enable ads globally (loads Ezoic scripts on the public site)
        </label>

        {error ? <p className="admin-error">{error}</p> : null}
        {message ? <p className="admin-success">{message}</p> : null}
      </section>

      {grouped.map((group) => (
        <section className="admin-card" key={group.id}>
          <div className="admin-ads-group-header">
            <h2>{group.label}</h2>
            <div className="admin-ads-group-actions">
              <button className="admin-button secondary" type="button" onClick={() => setGroupEnabled(group.id, true)}>
                Enable all
              </button>
              <button className="admin-button secondary" type="button" onClick={() => setGroupEnabled(group.id, false)}>
                Disable all
              </button>
            </div>
          </div>

          <table className="admin-table admin-ads-table">
            <thead>
              <tr>
                <th>Placement</th>
                <th>Ezoic ID</th>
                <th>Enabled</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {group.placements.map((placement) => (
                <tr key={placement.key}>
                  <td>
                    <strong>{placement.label}</strong>
                    <p className="admin-ads-description">{placement.description}</p>
                    {placement.coverageNote ? <p className="admin-ads-note">{placement.coverageNote}</p> : null}
                    {placement.afterParagraph ? (
                      <p className="admin-ads-note">After paragraph {placement.afterParagraph}</p>
                    ) : null}
                  </td>
                  <td>{placement.ezoicId}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={data.settings.placements[placement.key]?.enabled ?? placement.defaultEnabled}
                      onChange={(event) => togglePlacement(placement.key, event.target.checked)}
                    />
                  </td>
                  <td>
                    <Link className="admin-button secondary" href={`/admin/ads/preview/${placement.key}`}>
                      Mock preview
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
