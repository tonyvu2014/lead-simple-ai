"use client";

import { useState, FormEvent } from "react";

interface Business {
  name: string;
  email: string;
}

export default function Home() {
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

  return (
    <div className="container">
      <h1>Find Leads and Send Cold Outreach Emails</h1>

      <form className="card" onSubmit={handleSearch}>
        <label htmlFor="searchPrompt">
          Business Search Prompt <span style={{ color: "red" }}>*</span>
        </label>
        <input
          type="text"
          id="searchPrompt"
          placeholder="e.g. Small and Medium Business Plumbing Services in St Marys, NSW"
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

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

      {showResults && (
        <div className="card">
          <h2 style={{ marginBottom: "0.5rem" }}>Search Results</h2>
          <p style={{ color: "#666", marginBottom: "0.5rem" }}>
            {businesses.length === 0
              ? "No businesses found."
              : `Found ${businesses.length} business(es)`}
          </p>

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

              <button
                className="btn-send"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <>
                    <span className="spinner" />
                    Sending...
                  </>
                ) : (
                  "Send Emails"
                )}
              </button>
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
