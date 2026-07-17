"use client";

import { useEffect, useState } from "react";

type ApiKey = {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
};

export default function AdminAgentsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("OpenClaw");
  const [createdKey, setCreatedKey] = useState("");
  const [error, setError] = useState("");

  function load() {
    fetch("/api/cms/keys")
      .then(async (response) => {
        const data = (await response.json()) as { keys?: ApiKey[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load keys.");
        setKeys(data.keys ?? []);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setCreatedKey("");

    const response = await fetch("/api/cms/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        scopes: ["agent:read", "agent:write", "agent:publish", "agent:calendar"],
      }),
    });

    const data = (await response.json()) as { key?: string; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to create key.");
      return;
    }

    setCreatedKey(data.key ?? "");
    load();
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <h1>Agent API keys</h1>
        <p>Create keys for OpenClaw or other automation agents. Keys are shown once.</p>
        <form className="admin-grid" onSubmit={createKey} style={{ marginTop: "1rem" }}>
          <input className="admin-input" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="admin-button" type="submit">
            Create API key
          </button>
        </form>
        {createdKey ? (
          <p>
            <strong>New key:</strong> <code>{createdKey}</code>
          </p>
        ) : null}
        {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
        <table className="admin-table" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Label</th>
              <th>Prefix</th>
              <th>Scopes</th>
              <th>Last used</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td>{key.label}</td>
                <td>{key.prefix}</td>
                <td>{key.scopes.join(", ")}</td>
                <td>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
