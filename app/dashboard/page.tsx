"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { Product, Contact, Lead, ContactType, LeadStatus } from "@/lib/supabase";

type ProductForm = { name: string; description: string; url: string };
type ContactForm = { type: ContactType; subject: string; content: string };
type PanelMode = "contacts" | "leads";

const EMPTY_PRODUCT: ProductForm = { name: "", description: "", url: "" };
const EMPTY_CONTACT: ContactForm = { type: "COLD", subject: "", content: "" };

const STATUS_LABELS: Record<LeadStatus, string> = {
  COLD: "Cold",
  WARM: "Warm",
  FOLLOWED: "Followed",
};

export default function Dashboard() {
  // ── User ─────────────────────────────────────────────────────
  const [userId, setUserId] = useState("");
  const [userIdInput, setUserIdInput] = useState("");

  // ── Products ─────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("contacts");

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT);
  const [productSaving, setProductSaving] = useState(false);

  // ── Contacts ─────────────────────────────────────────────────
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>(EMPTY_CONTACT);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactGenerating, setContactGenerating] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState<Set<ContactType>>(new Set());
  const [activeSlot, setActiveSlot] = useState<ContactType | null>(null);

  // ── Leads ─────────────────────────────────────────────────────
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatus | "ALL">("ALL");
  const [leadPage, setLeadPage] = useState(1);
  const [dailyScheduleSaving, setDailyScheduleSaving] = useState(false);
  const LEADS_PER_PAGE = 25;

  // ── Errors ────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);

  // Load userId from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("dashboard_user_id");
    if (stored) {
      setUserId(stored);
      setUserIdInput(stored);
    }
  }, []);

  // ── Fetch products ───────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    if (!userId) return;
    setProductsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/products?user_id=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch products.");
      setProducts(data.products ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProductsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ── Fetch contacts ───────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    if (!selectedProduct) return;
    setContactsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts?product_id=${encodeURIComponent(selectedProduct.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch contacts.");
      setContacts(data.contacts ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setContactsLoading(false);
    }
  }, [selectedProduct]);

  // ── Fetch leads ──────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    if (!selectedProduct) return;
    setLeadsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads?product_id=${encodeURIComponent(selectedProduct.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch leads.");
      setLeads(data.leads ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLeadsLoading(false);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (selectedProduct) {
      if (panelMode === "contacts") fetchContacts();
      else fetchLeads();
    } else {
      setContacts([]);
      setLeads([]);
      setLeadPage(1);
    }
  }, [selectedProduct, panelMode, fetchContacts, fetchLeads]);

  // ── User ID form ─────────────────────────────────────────────
  function handleSetUserId(e: FormEvent) {
    e.preventDefault();
    const trimmed = userIdInput.trim();
    if (!trimmed) return;
    setUserId(trimmed);
    localStorage.setItem("dashboard_user_id", trimmed);
    setSelectedProduct(null);
    setContacts([]);
    setLeads([]);
    setLeadPage(1);
    setShowProductForm(false);
    setShowContactForm(false);
  }

  // ── Open panel ───────────────────────────────────────────────
  function openPanel(product: Product, mode: PanelMode) {
    setSelectedProduct(product);
    setPanelMode(mode);
    setShowContactForm(false);
  }

  // ── Product CRUD ─────────────────────────────────────────────
  function openAddProduct() {
    setEditingProduct(null);
    setProductForm(EMPTY_PRODUCT);
    setShowProductForm(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description ?? "",
      url: product.url ?? "",
    });
    setShowProductForm(true);
  }

  function cancelProductForm() {
    setShowProductForm(false);
    setEditingProduct(null);
    setProductForm(EMPTY_PRODUCT);
  }

  function getDescriptionWordCount(text: string) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  async function handleSaveProduct(e: FormEvent) {
    e.preventDefault();
    if (!productForm.name.trim()) return;
    const descWordCount = getDescriptionWordCount(productForm.description);
    if (descWordCount < 10 || descWordCount > 300) {
      setError(`Product description must be between 10 and 300 words. Current: ${descWordCount} word${descWordCount === 1 ? "" : "s"}.`);
      return;
    }
    setProductSaving(true);
    setError(null);
    try {
      const res = editingProduct
        ? await fetch(`/api/products/${editingProduct.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(productForm),
          })
        : await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, ...productForm }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save product.");
      if (editingProduct && selectedProduct?.id === editingProduct.id) {
        setSelectedProduct(data.product);
      }
      cancelProductForm();
      await fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProductSaving(false);
    }
  }

  async function handleDeleteProduct(product: Product) {
    if (!confirm(`Delete "${product.name}"? All its leads and contacts will also be deleted.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete product.");
      if (selectedProduct?.id === product.id) setSelectedProduct(null);
      await fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  // ── Contact CRUD ─────────────────────────────────────────────
  function toggleExpanded(type: ContactType) {
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  function openContactSlot(type: ContactType) {
    const existing = contacts.find((c) => c.type === type) ?? null;
    setEditingContact(existing);
    setContactForm(
      existing
        ? { type: existing.type, subject: existing.subject, content: existing.content }
        : { type, subject: "", content: "" }
    );
    setActiveSlot(type);
    setShowContactForm(true);
  }

  async function openContactSlotAndGenerate(type: ContactType) {
    const existing = contacts.find((c) => c.type === type) ?? null;
    setEditingContact(existing);
    setContactForm(
      existing
        ? { type: existing.type, subject: existing.subject, content: existing.content }
        : { type, subject: "", content: "" }
    );
    setActiveSlot(type);
    setShowContactForm(true);
    if (!selectedProduct) return;
    setContactGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: selectedProduct.name,
          productDescription: selectedProduct.description ?? "",
          productLink: selectedProduct.url ?? "",
          type,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setContactForm((prev) => ({
        ...prev,
        subject: data.emailSubject || "",
        content: data.emailBody || "",
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setContactGenerating(false);
    }
  }

  function cancelContactForm() {
    setShowContactForm(false);
    setEditingContact(null);
    setActiveSlot(null);
    setContactForm(EMPTY_CONTACT);
  }

  async function handleGenerateContactTemplate() {
    if (!selectedProduct || !activeSlot) return;
    setContactGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: selectedProduct.name,
          productDescription: selectedProduct.description ?? "",
          productLink: selectedProduct.url ?? "",
          type: activeSlot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setContactForm((prev) => ({
        ...prev,
        subject: data.emailSubject || "",
        content: data.emailBody || "",
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setContactGenerating(false);
    }
  }

  async function handleSaveContact(e: FormEvent) {
    e.preventDefault();
    if (!contactForm.subject.trim() || !contactForm.content.trim()) return;
    setContactSaving(true);
    setError(null);
    try {
      const res = editingContact
        ? await fetch(`/api/contacts/${editingContact.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(contactForm),
          })
        : await fetch("/api/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: selectedProduct!.id, ...contactForm }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save contact.");
      cancelContactForm();
      await fetchContacts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setContactSaving(false);
    }
  }

  async function handleDeleteContact(contact: Contact) {
    if (!confirm(`Delete contact email "${contact.subject}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete contact.");
      await fetchContacts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  // ── Send cold email ─────────────────────────────────────────
  async function handleSendColdEmail(lead: Lead) {
    if (!selectedProduct) return;
    setSendingLeadId(lead.id);
    try {
      // Fetch contacts to get COLD template
      const contactsRes = await fetch(`/api/contacts?product_id=${encodeURIComponent(selectedProduct.id)}`);
      const contactsData = await contactsRes.json();
      if (!contactsRes.ok) throw new Error(contactsData.error || "Failed to fetch email templates.");
      const coldTemplate = (contactsData.contacts ?? []).find(
        (c: { type: string }) => c.type === "COLD"
      ) as { subject: string; content: string } | undefined;
      if (!coldTemplate) {
        setModalMessage("No COLD email template found for this product. Please set one in Email Templates first.");
        return;
      }
      const emailBody = coldTemplate.content.replace(/\{\{name\}\}/g, lead.name);
      const sendRes = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businesses: [{ name: lead.name, email: lead.email }],
          emailBody,
          subject: coldTemplate.subject,
          product_id: selectedProduct.id,
        }),
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error || "Failed to send email.");
      const result = sendData.results?.[0];
      if (result?.status === "failed") {
        throw new Error(`Failed to deliver email to ${lead.email}.`);
      }
      // Update lead status locally to WARM
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: "WARM" as const } : l))
      );
    } catch (err: unknown) {
      setModalMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSendingLeadId(null);
    }
  }

  async function handleToggleDailySchedule(enabled: boolean) {
    if (!selectedProduct) return;
    setDailyScheduleSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedProduct.name,
          description: selectedProduct.description ?? "",
          url: selectedProduct.url ?? "",
          daily_schedule_enabled: enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update daily schedule.");
      setSelectedProduct(data.product);
      setProducts((prev) => prev.map((p) => (p.id === data.product.id ? data.product : p)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDailyScheduleSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="container">
      <h1>Dashboard</h1>

      {/* User ID bar */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <form onSubmit={handleSetUserId} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="userId">User ID</label>
            <input
              type="text"
              id="userId"
              placeholder="Paste your Supabase user UUID"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>
          <button type="submit" className="btn-generate" style={{ whiteSpace: "nowrap" }}>
            Load
          </button>
        </form>
        {userId && (
          <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#888" }}>
            Viewing as:{" "}
            <code style={{ background: "#f5f5f5", padding: "0 4px", borderRadius: 4 }}>
              {userId}
            </code>
          </p>
        )}
      </div>

      {error && (
        <div className="status-msg error" style={{ marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {userId && (
        <div className="dashboard-grid">

          {/* ── Products Panel ──────────────────────────── */}
          <div className="panel">
            <div className="panel-header">
              <h2>Products</h2>
              <button className="btn-generate" onClick={openAddProduct} type="button">
                + Add Product
              </button>
            </div>

            {showProductForm && (
              <form className="inline-form" onSubmit={handleSaveProduct}>
                <h3>{editingProduct ? "Edit Product" : "New Product"}</h3>
                <label>Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LeadDaily App"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
                <label>
                  Description *{" "}
                  <span style={{ fontWeight: 400, color: getDescriptionWordCount(productForm.description) < 10 || getDescriptionWordCount(productForm.description) > 300 ? "#dc2626" : "#888", fontSize: "0.85rem" }}>
                    ({getDescriptionWordCount(productForm.description)}/300 words, min 10)
                  </span>
                </label>
                <textarea
                  required
                  placeholder="Describe your product in 10 to 300 words..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  style={{ minHeight: 80 }}
                />
                <label>URL</label>
                <input
                  type="url"
                  placeholder="https://yourproduct.com"
                  value={productForm.url}
                  onChange={(e) => setProductForm({ ...productForm, url: e.target.value })}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn-search" type="submit" disabled={productSaving}>
                    {productSaving ? "Saving..." : "Save"}
                  </button>
                  <button type="button" className="btn-cancel" onClick={cancelProductForm}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {productsLoading ? (
              <p className="loading-text">Loading products…</p>
            ) : products.length === 0 ? (
              <p className="empty-text">No products yet. Click &ldquo;+ Add Product&rdquo; to get started.</p>
            ) : (
              <ul className="item-list">
                {products.map((p) => {
                  const isSelected = selectedProduct?.id === p.id;
                  return (
                    <li key={p.id} className={`item-card ${isSelected ? "item-card--selected" : ""}`}>
                      <div className="item-card__body">
                        <div className="item-card__title">{p.name}</div>
                        {p.description && <div className="item-card__sub">{p.description}</div>}
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="item-card__link">
                            {p.url}
                          </a>
                        )}
                      </div>
                      {/* Panel-open buttons column */}
                      <div className="item-card__panel-btns">
                        <button
                          className={`btn-action btn-action--contacts${isSelected && panelMode === "contacts" ? " btn-action--active" : ""}`}
                          onClick={() => openPanel(p, "contacts")}
                        >
                          Email Templates
                        </button>
                        <button
                          className={`btn-action btn-action--leads${isSelected && panelMode === "leads" ? " btn-action--active" : ""}`}
                          onClick={() => openPanel(p, "leads")}
                        >
                          Lead Management
                        </button>
                        <a
                          href={`/leads/${encodeURIComponent(p.id)}`}
                          className="btn-action btn-action--find-leads"
                        >
                          Find Leads
                        </a>
                      </div>
                      {/* Edit / Delete column */}
                      <div className="item-card__actions">
                        <button className="btn-action btn-action--edit" onClick={() => openEditProduct(p)}>
                          Edit
                        </button>
                        <button className="btn-action btn-action--delete" onClick={() => handleDeleteProduct(p)}>
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Detail Panel (Contacts or Leads) ────────── */}
          <div className="panel">
            {!selectedProduct ? (
              <div className="empty-panel">
                <p>↑ Select a product to view its details.</p>
              </div>
            ) : panelMode === "contacts" ? (
              <>
                <div className="panel-header">
                  <div>
                    <h2>Contact Emails</h2>
                    <p className="panel-subheader">for <strong>{selectedProduct.name}</strong></p>
                  </div>
                </div>

                {showContactForm && activeSlot && (
                  <form className="inline-form" onSubmit={handleSaveContact}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                      <h3 style={{ margin: 0 }}>{editingContact ? `Edit ${activeSlot} Email` : `Set ${activeSlot} Email`}</h3>
                      <button
                        type="button"
                        onClick={handleGenerateContactTemplate}
                        disabled={contactGenerating || contactSaving}
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem", cursor: "pointer", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "0.3rem", whiteSpace: "nowrap" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
                          <path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75z" />
                          <path d="M5 5l.5 1.5L7 7l-1.5.5L5 9l-.5-1.5L3 7l1.5-.5z" />
                        </svg>
                        {contactGenerating ? "Generating..." : "Generate with AI"}
                      </button>
                    </div>
                    <label>Subject *</label>
                    <input
                      type="text"
                      required
                      placeholder={contactGenerating ? "Generating…" : "Email subject line"}
                      value={contactForm.subject}
                      disabled={contactGenerating}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    />
                    <label>Content *</label>
                    <textarea
                      required
                      placeholder={contactGenerating ? "Generating with AI, please wait…" : "Email body…"}
                      value={contactForm.content}
                      disabled={contactGenerating}
                      onChange={(e) => setContactForm({ ...contactForm, content: e.target.value })}
                      style={{ minHeight: 120 }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn-search" type="submit" disabled={contactSaving || contactGenerating}>
                        {contactSaving ? "Saving..." : "Save"}
                      </button>
                      <button type="button" className="btn-cancel" onClick={cancelContactForm} disabled={contactGenerating}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {contactsLoading ? (
                  <p className="loading-text">Loading contacts…</p>
                ) : (
                  <ul className="item-list">
                    {(["COLD", "FOLLOW-UP"] as ContactType[]).map((slotType) => {
                      const contact = contacts.find((c) => c.type === slotType);
                      const isExpanded = expandedSlots.has(slotType);
                      return (
                        <li key={slotType} className="item-card">
                          <div className="item-card__body">
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                              <span className={`badge badge--${slotType === "COLD" ? "cold" : "followup"}`}>
                                {slotType}
                              </span>
                              <span className="item-card__title">
                                {contact
                                  ? contact.subject
                                  : <em style={{ color: "#aaa", fontWeight: 400 }}>Not set</em>}
                              </span>
                            </div>
                            {contact && (
                              <div>
                                <div className={`item-card__sub item-card__content${isExpanded ? " item-card__content--expanded" : ""}`}>
                                  {contact.content}
                                </div>
                                <button className="btn-view-more" type="button" onClick={() => toggleExpanded(slotType)}>
                                  {isExpanded ? "View less" : "View more"}
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="item-card__actions">
                            <button className="btn-action btn-action--edit" onClick={() => openContactSlot(slotType)}>
                              {contact ? "Edit" : "Set Email"}
                            </button>
                            <button
                              className="btn-action btn-action--generate"
                              onClick={() => openContactSlotAndGenerate(slotType)}
                            >
                              ✦ Generate with AI
                            </button>
                            {contact && (
                              <button className="btn-action btn-action--delete" onClick={() => handleDeleteContact(contact)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <>
                <div className="panel-header">
                  <div>
                    <h2>Leads</h2>
                    <p className="panel-subheader">for <strong>{selectedProduct.name}</strong></p>
                  </div>
                  <div className="leads-filter">
                    <label htmlFor="leadStatusFilter" className="leads-filter__label">Filter by status</label>
                    <select
                      id="leadStatusFilter"
                      className="leads-filter__select"
                      value={leadStatusFilter}
                      onChange={(e) => { setLeadStatusFilter(e.target.value as LeadStatus | "ALL"); setLeadPage(1); }}
                    >
                      <option value="ALL">All</option>
                      <option value="COLD">Cold</option>
                      <option value="WARM">Warm</option>
                      <option value="FOLLOWED">Followed</option>
                    </select>
                  </div>
                </div>

                <div className="leads-legend">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.75rem",
                      border: "1px solid #e5e7eb",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      marginBottom: "0.85rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Daily Schedule</div>
                      <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                        Auto-send the cold + follow-up flow to up to 50 cold leads daily.
                      </div>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(selectedProduct.daily_schedule_enabled)}
                        aria-label="Toggle daily schedule"
                        disabled={dailyScheduleSaving}
                        onClick={() => handleToggleDailySchedule(!Boolean(selectedProduct.daily_schedule_enabled))}
                        style={{
                          position: "relative",
                          width: "44px",
                          height: "24px",
                          borderRadius: "999px",
                          border: "none",
                          background: selectedProduct.daily_schedule_enabled ? "#16a34a" : "#94a3b8",
                          cursor: dailyScheduleSaving ? "not-allowed" : "pointer",
                          transition: "background 150ms ease",
                          padding: 0,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            left: selectedProduct.daily_schedule_enabled ? "23px" : "3px",
                            width: "18px",
                            height: "18px",
                            borderRadius: "999px",
                            background: "#ffffff",
                            transition: "left 150ms ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          }}
                        />
                      </button>
                      {dailyScheduleSaving
                        ? "Saving..."
                        : selectedProduct.daily_schedule_enabled
                          ? "On"
                          : "Off"}
                    </div>
                  </div>
                  <div className="leads-legend__item">
                    <span className="badge badge--cold">COLD</span>
                    <span>Not yet initiated the conversation</span>
                  </div>
                  <div className="leads-legend__item">
                    <span className="badge badge--warm">WARM</span>
                    <span>First email is sent</span>
                  </div>
                  <div className="leads-legend__item">
                    <span className="badge badge--followed">FOLLOWED</span>
                    <span>First and follow-up emails are sent</span>
                  </div>
                </div>

                {leadsLoading ? (
                  <p className="loading-text">Loading leads…</p>
                ) : leads.length === 0 ? (
                  <p className="empty-text">No leads yet for this product.</p>
                ) : (() => {
                  const filtered = leadStatusFilter === "ALL"
                    ? leads
                    : leads.filter((l) => l.status === leadStatusFilter);
                  if (filtered.length === 0) {
                    return <p className="empty-text">No {STATUS_LABELS[leadStatusFilter as LeadStatus]} leads.</p>;
                  }
                  const totalPages = Math.ceil(filtered.length / LEADS_PER_PAGE);
                  const pageStart = (leadPage - 1) * LEADS_PER_PAGE;
                  const paginated = filtered.slice(pageStart, pageStart + LEADS_PER_PAGE);
                  return (
                    <>
                      <table className="leads-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.map((lead, i) => (
                            <tr key={lead.id}>
                              <td>{pageStart + i + 1}</td>
                              <td>{lead.name}</td>
                              <td>{lead.email}</td>
                              <td>
                                <span className={`badge badge--${lead.status.toLowerCase()}`}>
                                  {STATUS_LABELS[lead.status]}
                                </span>
                              </td>
                              <td>
                                {lead.status === "COLD" && (
                                  <button
                                    className="btn-action btn-action--send-email"
                                    disabled={sendingLeadId === lead.id}
                                    onClick={() => handleSendColdEmail(lead)}
                                  >
                                    {sendingLeadId === lead.id ? "Sending…" : "Send Email"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {totalPages > 1 && (
                        <div className="leads-pagination">
                          <button
                            className="leads-pagination__btn"
                            disabled={leadPage === 1}
                            onClick={() => setLeadPage((p) => p - 1)}
                          >
                            ← Prev
                          </button>
                          <span className="leads-pagination__info">
                            Page {leadPage} of {totalPages} &nbsp;·&nbsp; {filtered.length} leads
                          </span>
                          <button
                            className="leads-pagination__btn"
                            disabled={leadPage === totalPages}
                            onClick={() => setLeadPage((p) => p + 1)}
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>

        </div>
      )}
      {/* ── Error Modal ─────────────────────────────────────── */}
      {modalMessage && (
        <div className="modal-overlay" onClick={() => setModalMessage(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <p className="modal-box__message">{modalMessage}</p>
            <button className="btn-search" onClick={() => setModalMessage(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
