"use client";

import { useEffect, useState } from "react";
import {
  AGENT_SCOPES,
  AGENT_SCOPE_DESCRIPTIONS,
  DEFAULT_AGENT_SCOPES,
  type AgentScope,
} from "@/lib/cms/schemas";

type ApiKey = {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
};

function toggleScope(scopes: AgentScope[], scope: AgentScope, checked: boolean): AgentScope[] {
  const next = new Set(scopes);
  if (checked) {
    next.add(scope);
  } else {
    next.delete(scope);
  }
  return AGENT_SCOPES.filter((candidate) => next.has(candidate));
}

export default function AdminAgentsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("OpenClaw");
  const [newScopes, setNewScopes] = useState<AgentScope[]>(DEFAULT_AGENT_SCOPES);
  const [createdKey, setCreatedKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScopes, setEditScopes] = useState<AgentScope[]>([]);
  const [busy, setBusy] = useState(false);

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
    setMessage("");
    setCreatedKey("");

    if (newScopes.length === 0) {
      setError("Select at least one scope.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/cms/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, scopes: newScopes }),
      });

      const data = await parseJsonResponse<{ key?: string; error?: string }>(response, "create key");
      if (!response.ok) {
        setError(data.error ?? "Failed to create key.");
        return;
      }

      setCreatedKey(data.key ?? "");
      load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create key.");
    } finally {
      setBusy(false);
    }
  }

  function startEditing(key: ApiKey) {
    setError("");
    setMessage("");
    setEditingId(key.id);
    setEditScopes(AGENT_SCOPES.filter((scope) => key.scopes.includes(scope)));
  }

  async function saveScopes(id: string) {
    setError("");
    setMessage("");

    if (editScopes.length === 0) {
      setError("Select at least one scope.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/cms/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, scopes: editScopes }),
      });

      const data = await parseJsonResponse<{ error?: string }>(response, "update key");
      if (!response.ok) {
        setError(data.error ?? "Failed to update scopes.");
        return;
      }

      setEditingId(null);
      setMessage("Scopes updated.");
      load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update scopes.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteKey(key: ApiKey) {
    if (!window.confirm(`Delete API key "${key.label}" (${key.prefix})? Agents using it stop working immediately.`)) {
      return;
    }

    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch(`/api/cms/keys?id=${encodeURIComponent(key.id)}`, {
        method: "DELETE",
      });

      const data = await parseJsonResponse<{ error?: string }>(response, "delete key");
      if (!response.ok) {
        setError(data.error ?? "Failed to delete key.");
        return;
      }

      if (editingId === key.id) {
        setEditingId(null);
      }
      setMessage(`Deleted ${key.label}.`);
      load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete key.");
    } finally {
      setBusy(false);
    }
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
          <fieldset className="agent-scope-fieldset">
            <legend>Scopes</legend>
            <div className="agent-scope-options">
              {AGENT_SCOPES.map((scope) => (
                <label className="agent-scope-option" key={scope}>
                  <input
                    type="checkbox"
                    checked={newScopes.includes(scope)}
                    onChange={(event) =>
                      setNewScopes((current) => toggleScope(current, scope, event.target.checked))
                    }
                  />
                  <span>
                    <code>{scope}</code>
                    <small>{AGENT_SCOPE_DESCRIPTIONS[scope]}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="admin-button" type="submit" disabled={busy}>
            Create API key
          </button>
        </form>
        {createdKey ? (
          <p>
            <strong>New key:</strong> <code>{createdKey}</code>
          </p>
        ) : null}
        {error ? <p className="admin-error">{error}</p> : null}
        {message ? <p className="admin-success">{message}</p> : null}
        <table className="admin-table" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Label</th>
              <th>Prefix</th>
              <th>Scopes</th>
              <th>Last used</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td>{key.label}</td>
                <td>{key.prefix}</td>
                <td>
                  {editingId === key.id ? (
                    <div className="agent-scope-options">
                      {AGENT_SCOPES.map((scope) => (
                        <label className="agent-scope-option" key={scope}>
                          <input
                            type="checkbox"
                            checked={editScopes.includes(scope)}
                            onChange={(event) =>
                              setEditScopes((current) =>
                                toggleScope(current, scope, event.target.checked),
                              )
                            }
                          />
                          <span>
                            <code>{scope}</code>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    key.scopes.join(", ")
                  )}
                </td>
                <td>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}</td>
                <td>
                  <div className="agent-key-actions">
                    {editingId === key.id ? (
                      <>
                        <button
                          className="admin-button"
                          type="button"
                          disabled={busy}
                          onClick={() => saveScopes(key.id)}
                        >
                          Save
                        </button>
                        <button
                          className="admin-button secondary"
                          type="button"
                          disabled={busy}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="admin-button secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => startEditing(key)}
                      >
                        Edit scopes
                      </button>
                    )}
                    <button
                      className="admin-button admin-button-danger"
                      type="button"
                      disabled={busy}
                      onClick={() => deleteKey(key)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
