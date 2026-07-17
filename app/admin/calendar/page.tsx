"use client";

import { useEffect, useState } from "react";

type CalendarEntry = {
  id: string;
  calendarDate: string;
  topic: string;
  contentType: string;
  categorySlug: string | null;
  notes: string | null;
};

export default function AdminCalendarPage() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [calendarDate, setCalendarDate] = useState("");
  const [topic, setTopic] = useState("");
  const [categorySlug, setCategorySlug] = useState("blog");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function load() {
    fetch("/api/cms/calendar")
      .then(async (response) => {
        const data = (await response.json()) as { entries?: CalendarEntry[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load calendar.");
        setEntries(data.entries ?? []);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function saveEntry(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const response = await fetch("/api/cms/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarDate, topic, categorySlug }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to save entry.");
      return;
    }

    setMessage("Calendar entry saved.");
    setCalendarDate("");
    setTopic("");
    load();
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <h1>Content calendar</h1>
        <form className="admin-grid" onSubmit={saveEntry} style={{ marginTop: "1rem" }}>
          <input className="admin-input" type="date" value={calendarDate} onChange={(e) => setCalendarDate(e.target.value)} required />
          <input className="admin-input" placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} required />
          <input className="admin-input" placeholder="Category slug" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} />
          <button className="admin-button" type="submit">
            Save entry
          </button>
        </form>
        {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
        {message ? <p style={{ color: "#047857" }}>{message}</p> : null}
        <table className="admin-table" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Topic</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.calendarDate}</td>
                <td>{entry.topic}</td>
                <td>{entry.categorySlug}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
