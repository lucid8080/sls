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

  async function parseJsonResponse<T>(response: Response, context: string): Promise<T> {
    const raw = await response.text();
    if (!raw.trim()) {
      throw new Error(`${context}: empty response body (HTTP ${response.status}).`);
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(`${context}: response was not valid JSON (HTTP ${response.status}).`);
    }
  }

  function load() {
    fetch("/api/cms/keys")
      .then(async (response) => {
        const data = await parseJsonResponse<{ keys?: ApiKey[]; error?: string }>(response, "load keys");
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

    const data = await parseJsonResponse<{ key?: string; error?: string }>(response, "create key");
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
        <p>Create keys for OpenClaw, Hermes, or other automation agents. Keys are shown once.</p>
        <p>
          Hermes connection URL: <code>/api/agent/v1</code> with{" "}
          <code>Authorization: Bearer &lt;key&gt;</code>. Use GET (authenticated) or OPTIONS (health
          check). Do not use HEAD — HTTP clients drop HEAD response bodies.
        </p>
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
