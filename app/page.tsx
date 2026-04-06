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

  // Handler for Skip button
  function handleSkip() {
    setPrompt("");
    setSubject("");
    setEmailBody("");
    setGenerated(true);
    setShowResults(false);
    setBusinesses([]);
    setSendStatus(null);
    setManualEmails("");
  }

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
  const [manualEmails, setManualEmails] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualEmailsError, setManualEmailsError] = useState("");

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

    // If prompt (target audience) is empty, switch to manual mode
    if (!prompt.trim()) {
      setManualMode(true);
      setBusinesses([]);
      setShowResults(true);
      setSearching(false);
      return;
    } else {
      setManualMode(false);
    }

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


  function isValidEmail(email: string) {
    // Basic email regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSend() {
    if (!emailBody.trim()) {
      alert("Please enter email body content.");
      return;
    }
    let emailsToSend: Business[] = businesses;
    if (manualMode) {
      // Parse manualEmails (comma separated)
      const emails = manualEmails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
      if (emails.length === 0) {
        setManualEmailsError("Please enter at least one email address.");
        return;
      }
      // Validate all emails
      const invalidEmails = emails.filter((email) => !isValidEmail(email));
      if (invalidEmails.length > 0) {
        setManualEmailsError(
          `Invalid email address${invalidEmails.length > 1 ? 'es' : ''}: ` +
          invalidEmails.join(", ")
        );
        return;
      }
      setManualEmailsError("");
      emailsToSend = emails.map((email) => ({ name: "", email }));
    } else {
      if (businesses.length === 0) {
        alert("No businesses to send emails to.");
        return;
      }
    }

    setSending(true);
    setSendStatus({ type: "info", message: "Sending emails, please wait..." });

    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businesses: emailsToSend, emailBody, subject }),
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
      <h1>Find and Email Relevant Leads For Your Product</h1>
      <div style={{ margin: "0 0 2rem 0", fontSize: "0.95rem", color: "#555", textAlign: "center" }}>
        This is just a quick demo of leaddaily.app. The full version will include smarter, more powerful features to help you grow leads with ease—like sending or scheduling cold and follow‑up emails, managing multiple products, and using your own email. Register your interest at{' '}
          <a href="https://www.leaddaily.app" target="_blank" rel="noopener noreferrer">https://www.leaddaily.app</a>{' '}to get early access to the product when it is launched.
      </div>

      <form className="card" onSubmit={handleGenerate}>
        <label htmlFor="productName">
          Product Name <span style={{ color: "red" }}>*</span>
        </label>
        <input
          type="text"
          id="productName"
          placeholder="e.g. LeadDaily App"
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

        <div style={{ display: "flex", gap: "0.5rem" }}>
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
          <button
            type="button"
            className="btn-skip"
            style={{ background: "#eee", color: "#333", border: "1px solid #ccc" }}
            onClick={handleSkip}
            disabled={generating}
          >
            Skip
          </button>
        </div>
      </form>

      {generated && (
        <form className="card" onSubmit={handleSearch}>
          <label htmlFor="searchPrompt">
            Target Audience
          </label>
          <input
            type="text"
            id="searchPrompt"
            placeholder="e.g. Small and Medium Business Plumbing Services in St Marys, NSW"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <p style={{ color: "#888", fontSize: "0.85rem", marginTop: "-0.75rem", marginBottom: "1rem" }}>
            The more specific the target audience, the better the leads. Leave blank to enter emails manually.
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
                Continue
              </>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      )}

      {showResults && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 style={{ marginBottom: "0.5rem" }}>Results</h2>
              <p style={{ color: "#666" }}>
                {manualMode
                  ? (manualEmails.trim().length === 0
                      ? "No emails entered."
                      : `Found ${manualEmails.split(",").filter(e => e.trim()).length} email(s)`)
                  : (businesses.length === 0
                      ? "No businesses found."
                      : `Found ${businesses.length} potential lead${businesses.length > 1 ? 's' : ''} based on the target audience.`)}
              </p>
            </div>
            {!manualMode && businesses.length > 0 && (
              <button
                className="btn-export"
                onClick={handleExportCSV}
                type="button"
              >
                Export CSV
              </button>
            )}
          </div>

          {!manualMode && businesses.length > 0 && (
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
                To send or schedule emails to thousands more leads, register for early access to LeadDaily.App at{" "}
                  <a href="https://www.leaddaily.app" target="_blank" rel="noopener noreferrer">
                    https://www.leaddaily.app
                </a>
              </p>
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem" }}>
                <button
                  className="btn-send"
                  onClick={handleSend}
                  type="button"
                  disabled
                >
                  {sending ? "Sending..." : "Send Emails"}
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

          {manualMode && (
            <div style={{ marginTop: "1rem" }}>
              <label htmlFor="manualEmails">
                Enter Emails (comma separated) <span style={{ color: "red" }}>*</span>
              </label>
              <textarea
                id="manualEmails"
                placeholder="e.g. user1@email.com, user2@email.com"
                required
                value={manualEmails}
                onChange={(e) => {
                  setManualEmails(e.target.value);
                  setManualEmailsError("");
                }}
                style={{ minHeight: 60, width: "100%", marginBottom: manualEmailsError ? 0 : "1rem" }}
              />
              {manualEmailsError && (
                <div style={{ color: "red", fontSize: "0.95rem", margin: "0.5rem 0 1rem 0" }}>
                  {manualEmailsError}
                </div>
              )}
              <button
                className="btn-send"
                onClick={handleSend}
                type="button"
                disabled={sending}
              >
                {sending ? "Sending..." : "Send Emails"}
              </button>
            </div>
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
