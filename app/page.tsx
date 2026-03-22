"use client";

import { useState, FormEvent } from "react";

interface Business {
  name: string;
  email: string;
}

export default function Home() {
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productLink, setProductLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [showResults, setShowResults] = useState(false);

  function getWordCount(text: string) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    const wordCount = getWordCount(productDescription);
    if (wordCount < 20 || wordCount > 300) {
      alert(`Product description must be between 20 and 300 words. Current: ${wordCount} words.`);
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, productDescription, productLink }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Generation failed.");
      }

      setPrompt(data.targetAudience || "");
      setSubject(data.emailSubject || "");
      setEmailBody(data.emailBody || "");
      setGenerated(true);
      setShowResults(false);
      setBusinesses([]);
      setSendStatus(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setShowResults(false);
    setSendStatus(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Search failed.");
      }

      setBusinesses(data.businesses || []);
      setShowResults(true);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSearching(false);
    }
  }

  function handleExportCSV() {
    const header = "#,Business Name,Email";
    const rows = businesses.map((b, i) =>
      `${i + 1},"${b.name.replace(/"/g, '""')}","${b.email.replace(/"/g, '""')}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leads.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleSend() {
    if (!emailBody.trim()) {
      alert("Please enter email body content.");
      return;
    }
    if (businesses.length === 0) {
      alert("No businesses to send emails to.");
      return;
    }

    setSending(true);
    setSendStatus({ type: "info", message: "Sending emails, please wait..." });

    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businesses, emailBody, subject }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send emails.");
      }

      setSendStatus({ type: "success", message: data.message });
    } catch (err: any) {
      setSendStatus({ type: "error", message: "Error: " + err.message });
    } finally {
      setSending(false);
    }
  }

  const wordCount = getWordCount(productDescription);

  return (
    <div className="container">
      <h1>Find and Contact Relevant Leads For Your Product</h1>
      <div style={{ margin: "0 0 2rem 0", fontSize: "0.95rem", color: "#555", textAlign: "center" }}>
        This is just a quick demo of SimpleLead.AI features. The complete product will have more features, including sending or scheduling cold and follow-up emails to leads, product management and using your own email. Register your interest at{' '}
        <a href="https://www.leadsimple.ai" target="_blank" rel="noopener noreferrer">https://www.leadsimple.ai</a>{' '}to get early access to the product when it is launched.
      </div>

      <form className="card" onSubmit={handleGenerate}>
        <label htmlFor="productName">
          Product Name <span style={{ color: "red" }}>*</span>
        </label>
        <input
          type="text"
          id="productName"
          placeholder="e.g. LeadSimple AI"
          required
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />

        <label htmlFor="productDescription">
          Product Description <span style={{ color: "red" }}>*</span>
          <span style={{ fontWeight: 400, color: "#888", marginLeft: "0.5rem" }}>
            ({wordCount}/300 words, min 20)
          </span>
        </label>
        <textarea
          id="productDescription"
          placeholder="Describe your product in 20 to 300 words..."
          required
          value={productDescription}
          onChange={(e) => setProductDescription(e.target.value)}
        />

        <label htmlFor="productLink">Product Link</label>
        <input
          type="url"
          id="productLink"
          placeholder="e.g. https://yourproduct.com"
          value={productLink}
          onChange={(e) => setProductLink(e.target.value)}
        />

        <button className="btn-generate" type="submit" disabled={generating}>
          {generating ? (
            <>
              <span className="spinner" />
              Generating...
            </>
          ) : (
            "Generate"
          )}
        </button>
      </form>

      {generated && (
        <form className="card" onSubmit={handleSearch}>
          <label htmlFor="searchPrompt">
            Target Audience <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            id="searchPrompt"
            placeholder="e.g. Small and Medium Business Plumbing Services in St Marys, NSW"
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <p style={{ color: "#888", fontSize: "0.85rem", marginTop: "-0.75rem", marginBottom: "1rem" }}>
            The more specific the target audience, the better the leads.
          </p>

          <label htmlFor="emailSubject">
            Email Subject <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            id="emailSubject"
            placeholder="e.g. Partnership Opportunity"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <label htmlFor="emailBody">
            Email Body <span style={{ color: "red" }}>*</span>
          </label>
          <textarea
            id="emailBody"
            placeholder="Enter the email content you want to send to the businesses..."
            required
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
          />

          <button className="btn-search" type="submit" disabled={searching}>
            {searching ? (
              <>
                <span className="spinner" />
                Searching...
              </>
            ) : (
              "Search"
            )}
          </button>
        </form>
      )}

      {showResults && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 style={{ marginBottom: "0.5rem" }}>Search Results</h2>
              <p style={{ color: "#666" }}>
                {businesses.length === 0
                  ? "No businesses found."
                  : `Found ${businesses.length} business(es)`}
              </p>
            </div>
            {businesses.length > 0 && (
              <button
                className="btn-export"
                onClick={handleExportCSV}
                type="button"
              >
                Export CSV
              </button>
            )}
          </div>

          {businesses.length > 0 && (
            <>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Business Name</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{b.name}</td>
                      <td>{b.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#555" }}>
                To send or schedule emails to thousands more leads, register for early access to SimpleLead.AI at{" "}
                <a href="https://www.leadsimple.ai" target="_blank" rel="noopener noreferrer">
                  https://www.leadsimple.ai
                </a>
              </p>
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem" }}>
                <button
                  className="btn-send"
                  disabled
                >
                  Send Emails
                </button>
                <button
                  className="btn-schedule"
                  type="button"
                  disabled
                >
                  Schedule Emails
                </button>
              </div>
            </>
          )}

          {sendStatus && (
            <div className={`status-msg ${sendStatus.type}`}>
              {sendStatus.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
