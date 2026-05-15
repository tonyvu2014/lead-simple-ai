"use client";

import { useState, useEffect, FormEvent } from "react";
import { useParams } from "next/navigation";

interface Business {
  name: string;
  email: string;
}

interface Contact {
  id: string;
  type: "COLD" | "FOLLOW-UP";
  subject: string;
  content: string;
}

export default function Home() {
  const { product_id: productIdParam } = useParams<{ product_id: string }>();
  const isProductLocked = !!productIdParam;
  const EMPTY_CONTACTS: Contact[] = [
    { id: "__local_COLD", type: "COLD", subject: "", content: "" },
    { id: "__local_FOLLOW-UP", type: "FOLLOW-UP", subject: "", content: "" },
  ];
  const [contacts, setContacts] = useState<Contact[]>(EMPTY_CONTACTS);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ subject: string; content: string }>({ subject: "", content: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [generatingContactId, setGeneratingContactId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function showError(msg: string) {
    setErrorMessage(msg);
  }
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productLink, setProductLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    const productId = productIdParam;
    if (!productId) return;

    Promise.all([
      fetch(`/api/products/${encodeURIComponent(productId)}`).then((r) => r.json()),
      fetch(`/api/contacts?product_id=${encodeURIComponent(productId)}`).then((r) => r.json()),
    ])
      .then(([productData, contactsData]) => {
        if (productData.product) {
          setProductName(productData.product.name || "");
          setProductDescription(productData.product.description || "");
          setProductLink(productData.product.url || "");
        }
        if (contactsData.contacts) {
          setContacts((prev) =>
            prev.map((placeholder) => {
              const real = (contactsData.contacts as Contact[]).find((c) => c.type === placeholder.type);
              return real ?? placeholder;
            })
          );
        }
      })
      .catch(() => {});
  }, [productIdParam]);

  // Handler for Skip button
  function handleSkip() {
    setPrompt("");
    setGenerated(true);
    setShowResults(false);
    setBusinesses([]);
    setSendStatus(null);
    setManualEmails("");
  }

  const [prompt, setPrompt] = useState("");
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
  const [savingLeads, setSavingLeads] = useState(false);

  function getWordCount(text: string) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  async function handleGenerate(e?: React.MouseEvent | FormEvent) {
    e?.preventDefault();
    const wordCount = getWordCount(productDescription);
    if (wordCount < 10 || wordCount > 300) {
      showError(`Product description must be between 10 and 300 words. Current: ${wordCount} words.`);
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
      setGenerated(true);
      setShowResults(false);
      setBusinesses([]);
      setSendStatus(null);
    } catch (err: any) {
      showError("Error: " + err.message);
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
      showError("Error: " + err.message);
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

  function handleRemoveLead(index: number) {
    setBusinesses((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveLeads() {
    const productId = productIdParam;
    if (!productId) return;
    setSavingLeads(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, leads: businesses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save leads.");
      setSendStatus({ type: "success", message: data.message });
    } catch (err: any) {
      showError("Error: " + err.message);
    } finally {
      setSavingLeads(false);
    }
  }

  function isValidEmail(email: string) {
    // Basic email regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSend() {
    const coldContact = contacts.find((c) => c.type === "COLD");
    if (!coldContact?.subject || !coldContact?.content) {
      showError("Please add a First-touch Email subject and body in the Email Templates section before sending.");
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
        showError("No businesses to send emails to.");
        return;
      }
    }

    setSending(true);
    setSendStatus({ type: "info", message: "Sending emails, please wait..." });

    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businesses: emailsToSend, subject: coldContact.subject, emailBody: coldContact.content, product_id: productIdParam ?? undefined, product_name: productName || undefined }),
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

  async function handleGenerateTemplate(id: string, type: Contact["type"]) {
    setGeneratingContactId(id);
    setEditingContactId(id);
    // Start with current values while loading
    const current = contacts.find((c) => c.id === id);
    setEditDraft({ subject: current?.subject ?? "", content: current?.content ?? "" });
    try {
      const res = await fetch("/api/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, productDescription, productLink, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setEditDraft({ subject: data.emailSubject || "", content: data.emailBody || "" });
    } catch (err: any) {
      showError("Error: " + err.message);
      setEditingContactId(null);
    } finally {
      setGeneratingContactId(null);
    }
  }

  async function handleSaveContact(id: string, type: Contact["type"]) {
    // No DB backing for local placeholders — just update state
    if (id.startsWith("__local_")) {
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, subject: editDraft.subject, content: editDraft.content } : c))
      );
      setEditingContactId(null);
      return;
    }

    setSavingContact(true);
    try {
      const res = await fetch(`/api/contacts/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, subject: editDraft.subject, content: editDraft.content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setContacts((prev) => prev.map((c) => (c.id === id ? data.contact : c)));
      setEditingContactId(null);
    } catch (err: any) {
      showError("Error: " + err.message);
    } finally {
      setSavingContact(false);
    }
  }

  const wordCount = getWordCount(productDescription);

  return (
    <div className="container">
      <h1>Find and Email Relevant Leads For Your Product</h1>
      {!isProductLocked && (
        <div style={{ margin: "0 0 2rem 0", fontSize: "0.95rem", color: "#555", textAlign: "center" }}>
          This is just a quick demo of leaddaily.app. The full version will include smarter, more powerful features to help you grow leads with ease—like sending or scheduling cold and follow‑up emails, managing multiple products, and using your own email. Register your interest at{' '}
            <a href="https://www.leaddaily.app" target="_blank" rel="noopener noreferrer">https://www.leaddaily.app</a>{' '}to get 40% discount and early access to the product when it is launched.
        </div>
      )}

      <form className="card" onSubmit={handleGenerate}>
        <label htmlFor="productName">
          Product Name <span style={{ color: "red" }}>*</span>
        </label>
        <input
          type="text"
          id="productName"
          placeholder="e.g. LeadDaily App"
          required
          readOnly={isProductLocked}
          value={productName}
          onChange={(e) => !isProductLocked && setProductName(e.target.value)}
          style={isProductLocked ? { background: "#f5f5f5", cursor: "not-allowed" } : undefined}
        />

        <label htmlFor="productDescription">
          Product Description <span style={{ color: "red" }}>*</span>
          <span style={{ fontWeight: 400, color: "#888", marginLeft: "0.5rem" }}>
            ({wordCount}/300 words, min 10)
          </span>
        </label>
        <textarea
          id="productDescription"
          placeholder="Describe your product in 10 to 300 words..."
          required
          readOnly={isProductLocked}
          value={productDescription}
          onChange={(e) => !isProductLocked && setProductDescription(e.target.value)}
          style={isProductLocked ? { background: "#f5f5f5", cursor: "not-allowed" } : undefined}
        />

        <label htmlFor="productLink">Product Link</label>
        <input
          type="url"
          id="productLink"
          placeholder="e.g. https://yourproduct.com"
          readOnly={isProductLocked}
          value={productLink}
          onChange={(e) => !isProductLocked && setProductLink(e.target.value)}
          style={isProductLocked ? { background: "#f5f5f5", cursor: "not-allowed" } : undefined}
        />
      </form>

      {contacts.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.1rem" }}>Email Templates</h2>
          <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.85rem", color: "#666" }}>
            You can use <code style={{ background: "#f0f0f0", padding: "0.1rem 0.35rem", borderRadius: "3px" }}>{"{{name}}"}</code> as a placeholder in the subject or body — it will be replaced with the business or contact name when the email is sent.
          </p>
          {(["COLD", "FOLLOW-UP"] as const).map((type) => {
            const contact = contacts.find((c) => c.type === type);
            if (!contact) return null;

            const isEditing = editingContactId === contact.id;
            return (
              <div key={type} style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", color: "#444" }}>
                      {type === "COLD" ? "First-touch Email" : "Follow-Up Email"}
                    </h3>
                    <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "#888" }}>
                      {type === "COLD"
                        ? "Sent to a lead for the very first time"
                        : "Sent to leads 5 days after the first-touch email to remind, re-engage or move the conversation forward"}
                    </p>
                  </div>
                  {!isEditing && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingContactId(contact.id);
                          setEditDraft({ subject: contact.subject, content: contact.content });
                        }}
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateTemplate(contact.id, contact.type)}
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", cursor: "pointer", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
                          <path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75z" />
                          <path d="M5 5l.5 1.5L7 7l-1.5.5L5 9l-.5-1.5L3 7l1.5-.5z" />
                        </svg>
                        Generate with AI
                      </button>
                    </div>
                  )}
                  {isEditing && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => handleSaveContact(contact.id, contact.type)}
                        disabled={savingContact || !!generatingContactId}
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", cursor: "pointer", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {savingContact ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingContactId(null)}
                        disabled={savingContact || !!generatingContactId}
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <>
                    <label style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", color: "#555", marginBottom: "0.25rem" }}>
                      Subject
                    </label>
                    <input
                      type="text"
                      value={editDraft.subject}
                      onChange={(e) => setEditDraft((d) => ({ ...d, subject: e.target.value }))}
                      disabled={generatingContactId === contact.id}
                      placeholder={generatingContactId === contact.id ? "Generating..." : ""}
                      style={{ width: "100%", marginBottom: "0.75rem", boxSizing: "border-box" }}
                    />
                    <label style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", color: "#555", marginBottom: "0.25rem" }}>
                      Body
                    </label>
                    <textarea
                      value={editDraft.content}
                      onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                      rows={8}
                      disabled={generatingContactId === contact.id}
                      placeholder={generatingContactId === contact.id ? "Generating with AI, please wait..." : ""}
                      style={{ width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: "0.875rem" }}
                    />
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#555" }}>Subject: </span>
                      <span style={{ fontSize: "0.875rem" }}>{contact.subject}</span>
                    </div>
                    <div
                      style={{
                        background: "#f9f9f9",
                        border: "1px solid #e0e0e0",
                        borderRadius: "6px",
                        padding: "0.75rem",
                        fontSize: "0.875rem",
                        whiteSpace: "pre-wrap",
                        color: "#333",
                      }}
                    >
                      {contact.content}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", justifyContent: "center" }}>
        <button className="btn-generate" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <>
              <span className="spinner" />
              Generating...
            </>
          ) : (
            "Generate Target Audience with AI"
          )}
        </button>
        <button
          type="button"
          className="btn-skip"
          style={{ background: "#eee", color: "#333", border: "1px solid #ccc" }}
          onClick={handleSkip}
          disabled={generating}
        >
          Enter Target Audience Manually
        </button>
      </div>

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
            The more specific the target audience, the better the leads. Leave blank to enter lead's emails manually.
          </p>

          <button className="btn-search" type="submit" disabled={searching}>
            {searching ? (
              <>
                <span className="spinner" />
                Find Leads
              </>
            ) : (
              "Find Leads"
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
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {isProductLocked && (
                  <button
                    className="btn-save"
                    onClick={handleSaveLeads}
                    type="button"
                    disabled={savingLeads}
                    style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: "6px", padding: "0.4rem 1rem", cursor: "pointer", fontSize: "0.9rem" }}
                  >
                    {savingLeads ? "Saving..." : "Save Leads"}
                  </button>
                )}
                <button
                  className="btn-export"
                  onClick={handleExportCSV}
                  type="button"
                >
                  Export CSV
                </button>
              </div>
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
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{b.name}</td>
                      <td>{b.email}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveLead(i)}
                          style={{
                            background: "#ef4444",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            padding: "0.3rem 0.6rem",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!isProductLocked && (
                <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#555" }}>
                  To send or schedule emails to thousands more leads, register for early access to LeadDaily.App at{" "}
                    <a href="https://www.leaddaily.app" target="_blank" rel="noopener noreferrer">
                      https://www.leaddaily.app
                  </a>
                </p>
              )}
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem" }}>
                <button
                  className="btn-send"
                  onClick={handleSend}
                  type="button"
                  disabled={!isProductLocked || sending}
                >
                  {sending ? "Sending..." : "Send Emails"}
                </button>
                {isProductLocked && (
                  <button
                    className="btn-send"
                    onClick={handleSaveLeads}
                    type="button"
                    disabled={savingLeads}
                    style={{ background: "#16a34a", marginLeft: "auto" }}
                  >
                    {savingLeads ? "Saving..." : "Save Leads"}
                  </button>
                )}
                {!isProductLocked && (
                  <button
                    className="btn-schedule"
                    type="button"
                    disabled
                  >
                    Schedule Emails
                  </button>
                )}
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

      {errorMessage && (
        <div
          onClick={() => setErrorMessage(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "10px",
              padding: "2rem",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
            <p style={{ margin: "0 0 1.5rem 0", fontSize: "0.95rem", color: "#333", lineHeight: 1.5 }}>
              {errorMessage}
            </p>
            <button
              onClick={() => setErrorMessage(null)}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "0.5rem 1.5rem",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
