"use client";

import { useEffect, useState } from "react";

type MediaAsset = {
  id: string;
  filename: string;
  publicPath: string;
  alt: string | null;
  createdAt: string;
};

export default function AdminMediaPage() {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function load() {
    fetch("/api/cms/media")
      .then(async (response) => {
        const data = (await response.json()) as { media?: MediaAsset[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load media.");
        setMedia(data.media ?? []);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);
    formData.set("alt", alt);

    const response = await fetch("/api/cms/media", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Upload failed.");
      return;
    }

    setMessage("Uploaded.");
    setFile(null);
    setAlt("");
    load();
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <h1>Media library</h1>
        <form className="admin-grid" onSubmit={upload} style={{ marginTop: "1rem" }}>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <input className="admin-input" placeholder="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} />
          <button className="admin-button" type="submit">
            Upload
          </button>
        </form>
        {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
        {message ? <p style={{ color: "#047857" }}>{message}</p> : null}
        <table className="admin-table" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>File</th>
              <th>Path</th>
              <th>Alt</th>
            </tr>
          </thead>
          <tbody>
            {media.map((asset) => (
              <tr key={asset.id}>
                <td>{asset.filename}</td>
                <td>{asset.publicPath}</td>
                <td>{asset.alt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
