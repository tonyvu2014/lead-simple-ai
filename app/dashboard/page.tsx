"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Product, Contact, Lead, ContactType, LeadStatus, EmailConfig } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { fetchWithAuth } from "@/lib/auth-client";
import { textToHtml } from "@/lib/text-to-html";

type ProductForm = { name: string; description: string; url: string };
type ContactForm = { type: ContactType; subject: string; content: string };
type EmailConfigForm = { host: string; port: string; username: string; password: string; email_from: string };
type PanelMode = "contacts" | "leads" | "email-config";

const EMPTY_PRODUCT: ProductForm = { name: "", description: "", url: "" };
const EMPTY_CONTACT: ContactForm = { type: "COLD", subject: "", content: "" };
const EMPTY_EMAIL_CONFIG: EmailConfigForm = { host: "", port: "587", username: "", password: "", email_from: "" };

const STATUS_LABELS: Record<LeadStatus, string> = {
  COLD: "Cold",
  WARM: "Warm",
  FOLLOWED: "Followed",
};

const CONTACT_TYPE_NOTES: Record<ContactType, string> = {
  COLD: "Sent to a lead for the very first time",
  "FOLLOW-UP": "Sent to leads 5 days after the first-touch email to remind, re-engage or move the conversation forward",
};

function ActionIcon({ kind }: { kind: "contacts" | "leads" | "find" | "edit" | "delete" | "send" | "email-config" }) {
  switch (kind) {
    case "contacts":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="btn-action__icon">
          <path
            d="M3.75 5.75A1.75 1.75 0 0 1 5.5 4h9a1.75 1.75 0 0 1 1.75 1.75v8.5A1.75 1.75 0 0 1 14.5 16h-9a1.75 1.75 0 0 1-1.75-1.75v-8.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="m4.5 6 4.72 3.54a1.33 1.33 0 0 0 1.56 0L15.5 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "leads":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="btn-action__icon">
          <path
            d="M10 10.25a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M5.25 15.25a4.75 4.75 0 0 1 9.5 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M4 8.25a2 2 0 1 0 0-4M16 8.25a2 2 0 1 1 0-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "find":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="btn-action__icon">
          <circle cx="9" cy="9" r="4.25" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="m12 12 3.25 3.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "edit":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="btn-action__icon">
          <path
            d="M4.75 13.75 4 16l2.25-.75L14.5 7a1.59 1.59 0 0 0-2.25-2.25l-7.5 7.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="m11.5 5.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "delete":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="btn-action__icon">
          <path
            d="M5.75 6.5h8.5M8 6.5V5.25c0-.69.56-1.25 1.25-1.25h1.5C11.44 4 12 4.56 12 5.25V6.5m1.5 0-.55 8.05A1.5 1.5 0 0 1 11.45 16H8.55a1.5 1.5 0 0 1-1.5-1.45L6.5 6.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M8.75 9v4.25M11.25 9v4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "send":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="btn-action__icon">
          <path
            d="M3.75 9.25 15.5 4.5a.5.5 0 0 1 .66.63l-3.9 10.72a.5.5 0 0 1-.92.05l-1.9-4.13-4.14-1.9a.5.5 0 0 1 .05-.92Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="m9.25 11 6.5-6.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "email-config":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="btn-action__icon">
          <circle cx="10" cy="10" r="2.75" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 3.5v1.25M10 15.25V16.5M16.5 10h-1.25M4.75 10H3.5M14.95 5.05l-.88.88M5.93 14.07l-.88.88M14.95 14.95l-.88-.88M5.93 5.93l-.88-.88"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── User ─────────────────────────────────────────────────────
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  // ── Email Config ──────────────────────────────────────────────
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [emailConfigLoading, setEmailConfigLoading] = useState(false);
  const [showEmailConfigForm, setShowEmailConfigForm] = useState(false);
  const [emailConfigForm, setEmailConfigForm] = useState<EmailConfigForm>(EMPTY_EMAIL_CONFIG);
  const [emailConfigSaving, setEmailConfigSaving] = useState(false);
  const [testDestinationEmail, setTestDestinationEmail] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // ── Leads ─────────────────────────────────────────────────────
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "product"; product: Product }
    | { type: "contact"; contact: Contact }
    | { type: "email-config"; product: Product }
    | null
  >(null);
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatus | "ALL">("ALL");
  const [leadPage, setLeadPage] = useState(1);
  const [dailyScheduleSaving, setDailyScheduleSaving] = useState(false);
  const LEADS_PER_PAGE = 25;

  // ── Errors ────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);

  // Require authenticated session
  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        router.replace("/login?next=/dashboard");
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      setAuthLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // ── Fetch products ───────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    if (!userId) return;
    setProductsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/products");
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
      const res = await fetchWithAuth(`/api/contacts?product_id=${encodeURIComponent(selectedProduct.id)}`);
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
      const res = await fetchWithAuth(`/api/leads?product_id=${encodeURIComponent(selectedProduct.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch leads.");
      setLeads(data.leads ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLeadsLoading(false);
    }
  }, [selectedProduct]);

  // ── Fetch email config ───────────────────────────────────────
  const fetchEmailConfig = useCallback(async () => {
    if (!selectedProduct) return;
    setEmailConfigLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/email-config?product_id=${encodeURIComponent(selectedProduct.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch email config.");
      setEmailConfig(data.email_config ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEmailConfigLoading(false);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (selectedProduct) {
      if (panelMode === "contacts") fetchContacts();
      else if (panelMode === "leads") fetchLeads();
      else if (panelMode === "email-config") fetchEmailConfig();
    } else {
      setContacts([]);
      setLeads([]);
      setEmailConfig(null);
      setLeadPage(1);
    }
  }, [selectedProduct, panelMode, fetchContacts, fetchLeads, fetchEmailConfig]);

  useEffect(() => {
    const requestedProductId = searchParams.get("product_id");
    if (!requestedProductId || !products.length || selectedProduct) return;
    const matched = products.find((product) => product.id === requestedProductId);
    if (matched) {
      setSelectedProduct(matched);
      setPanelMode("contacts");
    }
  }, [products, searchParams, selectedProduct]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // ── Open panel ───────────────────────────────────────────────
  function openPanel(product: Product, mode: PanelMode) {
    setSelectedProduct(product);
    setPanelMode(mode);
    setShowContactForm(false);
    setShowEmailConfigForm(false);
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
        ? await fetchWithAuth(`/api/products/${editingProduct.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(productForm),
          })
        : await fetchWithAuth("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...productForm }),
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
    setDeleteTarget({ type: "product", product });
  }

  async function confirmDeleteTarget() {
    if (!deleteTarget) return;

    setError(null);
    try {
      if (deleteTarget.type === "product") {
        const { product } = deleteTarget;
        const res = await fetchWithAuth(`/api/products/${product.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete product.");
        if (selectedProduct?.id === product.id) setSelectedProduct(null);
        await fetchProducts();
      } else if (deleteTarget.type === "contact") {
        const { contact } = deleteTarget;
        const res = await fetchWithAuth(`/api/contacts/${contact.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete contact.");
        await fetchContacts();
      } else if (deleteTarget.type === "email-config") {
        const { product } = deleteTarget;
        const res = await fetchWithAuth(`/api/email-config/${encodeURIComponent(product.id)}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete email config.");
        setEmailConfig(null);
        setShowEmailConfigForm(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeleteTarget(null);
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
        ? await fetchWithAuth(`/api/contacts/${editingContact.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(contactForm),
          })
        : await fetchWithAuth("/api/contacts", {
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
    setDeleteTarget({ type: "contact", contact });
  }

  // ── Email Config CRUD ─────────────────────────────────────────
  function openEmailConfigForm() {
    setEmailConfigForm(
      emailConfig
        ? { host: emailConfig.host, port: String(emailConfig.port), username: emailConfig.username, password: emailConfig.password, email_from: emailConfig.email_from }
        : EMPTY_EMAIL_CONFIG
    );
    setShowEmailConfigForm(true);
  }

  function cancelEmailConfigForm() {
    setShowEmailConfigForm(false);
    setEmailConfigForm(EMPTY_EMAIL_CONFIG);
  }

  async function handleSaveEmailConfig(e: FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setEmailConfigSaving(true);
    setError(null);
    try {
      const payload = {
        host: emailConfigForm.host.trim(),
        port: Number(emailConfigForm.port) || 587,
        username: emailConfigForm.username.trim(),
        password: emailConfigForm.password,
        email_from: emailConfigForm.email_from.trim(),
      };
      const res = emailConfig
        ? await fetchWithAuth(`/api/email-config/${encodeURIComponent(selectedProduct.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetchWithAuth("/api/email-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: selectedProduct.id, ...payload }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save email config.");
      setEmailConfig(data.email_config);
      setShowEmailConfigForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEmailConfigSaving(false);
    }
  }

  function handleDeleteEmailConfig() {
    if (!selectedProduct) return;
    setDeleteTarget({ type: "email-config", product: selectedProduct });
  }

  async function handleSendTestEmail(e: FormEvent) {
    e.preventDefault();
    if (!selectedProduct || !testDestinationEmail.trim()) return;

    setSendingTestEmail(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          to: testDestinationEmail.trim(),
          product_name: selectedProduct.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send test email.");
      setModalMessage(`Test email sent to ${testDestinationEmail.trim()}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSendingTestEmail(false);
    }
  }

  // ── Send cold email ─────────────────────────────────────────
  async function handleSendColdEmail(lead: Lead) {
    if (!selectedProduct) return;
    setSendingLeadId(lead.id);
    try {
      // Fetch contacts to get COLD template
      const contactsRes = await fetchWithAuth(`/api/contacts?product_id=${encodeURIComponent(selectedProduct.id)}`);
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
      const sendRes = await fetchWithAuth("/api/send-emails", {
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
      const res = await fetchWithAuth(`/api/products/${selectedProduct.id}`, {
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
  if (authLoading) {
    return (
      <div className="container">
        <p className="loading-text">Loading session…</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="page-title">
        <Image
          src="/logo.svg"
          alt="LeadDaily logo"
          width={44}
          height={44}
          className="page-title__logo"
          priority
        />
        <span>Dashboard</span>
      </h1>

      {/* User bar */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div style={{ fontSize: "0.92rem", color: "#666" }}>
            Logged in as <strong>{userEmail ?? userId}</strong>
          </div>
          <button type="button" className="btn-cancel" onClick={handleLogout}>
            Logout
          </button>
        </div>
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
                          type="button"
                          className={`btn-action btn-action--email-config${isSelected && panelMode === "email-config" ? " btn-action--active" : ""}`}
                          onClick={() => openPanel(p, "email-config")}
                        >
                          <ActionIcon kind="email-config" />
                          Configure Email Server
                        </button>
                        <button
                          type="button"
                          className={`btn-action btn-action--contacts${isSelected && panelMode === "contacts" ? " btn-action--active" : ""}`}
                          onClick={() => openPanel(p, "contacts")}
                        >
                          <ActionIcon kind="contacts" />
                          Manage Emails
                        </button>
                        <button
                          type="button"
                          className={`btn-action btn-action--leads${isSelected && panelMode === "leads" ? " btn-action--active" : ""}`}
                          onClick={() => openPanel(p, "leads")}
                        >
                          <ActionIcon kind="leads" />
                          Manage Leads
                        </button>
                        <a
                          href={`/leads/${encodeURIComponent(p.id)}`}
                          className="btn-action btn-action--find-leads"
                        >
                          <ActionIcon kind="find" />
                          Find Leads
                        </a>
                      </div>
                      {/* Edit / Delete column */}
                      <div className="item-card__actions">
                        <button type="button" className="btn-action btn-action--edit" onClick={() => openEditProduct(p)}>
                          <ActionIcon kind="edit" />
                          Edit
                        </button>
                        <button type="button" className="btn-action btn-action--delete" onClick={() => handleDeleteProduct(p)}>
                          <ActionIcon kind="delete" />
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
                    <p style={{ margin: "0 0 1rem 0", fontSize: "0.92rem", color: "#555", lineHeight: 1.5 }}>
                      You can use {"{{name}}"} as a placeholder in the subject or body — it will be replaced with the business or contact name when the email is sent.
                    </p>
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
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: contact ? "0.35rem" : 0, flexWrap: "wrap" }}>
                              <span className={`badge badge--${slotType === "COLD" ? "cold" : "followup"}`}>
                                {slotType}
                              </span>
                              <span style={{ color: "#888", fontSize: "0.8rem", lineHeight: 1.4 }}>
                                {CONTACT_TYPE_NOTES[slotType]}
                              </span>
                            </div>
                            <div className="item-card__title" style={{ marginBottom: contact ? "0.35rem" : 0 }}>
                              {contact
                                ? contact.subject
                                : <em style={{ color: "#aaa", fontWeight: 400 }}>Not set</em>}
                            </div>
                            {contact && (
                              <div>
                                <div
                                  className={`item-card__sub item-card__content${isExpanded ? " item-card__content--expanded" : ""}`}
                                  dangerouslySetInnerHTML={{ __html: textToHtml(contact.content) }}
                                />
                                <button className="btn-view-more" type="button" onClick={() => toggleExpanded(slotType)}>
                                  {isExpanded ? "View less" : "View more"}
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="item-card__actions">
                            <button type="button" className="btn-action btn-action--edit" onClick={() => openContactSlot(slotType)}>
                              <ActionIcon kind="edit" />
                              {contact ? "Edit" : "Set Email"}
                            </button>
                            <button
                              type="button"
                              className="btn-action btn-action--generate"
                              onClick={() => openContactSlotAndGenerate(slotType)}
                            >
                              ✦ Generate with AI
                            </button>
                            {contact && (
                              <button type="button" className="btn-action btn-action--delete" onClick={() => handleDeleteContact(contact)}>
                                <ActionIcon kind="delete" />
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
            ) : panelMode === "email-config" ? (
              <>
                <div className="panel-header">
                  <div>
                    <h2>Email Server Config</h2>
                    <p className="panel-subheader">for <strong>{selectedProduct.name}</strong></p>
                  </div>
                </div>

                {showEmailConfigForm ? (
                  <form className="inline-form" onSubmit={handleSaveEmailConfig}>
                    <h3 style={{ marginBottom: "0.75rem" }}>{emailConfig ? "Edit Email Server" : "Add Email Server"}</h3>
                    <label>SMTP Host *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. smtp.gmail.com"
                      value={emailConfigForm.host}
                      onChange={(e) => setEmailConfigForm({ ...emailConfigForm, host: e.target.value })}
                    />
                    <label>SMTP Port</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="587"
                      value={emailConfigForm.port}
                      onChange={(e) => setEmailConfigForm({ ...emailConfigForm, port: e.target.value })}
                    />
                    <label>Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="your@email.com"
                      value={emailConfigForm.username}
                      onChange={(e) => setEmailConfigForm({ ...emailConfigForm, username: e.target.value })}
                    />
                    <label>Password *</label>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={emailConfigForm.password}
                      onChange={(e) => setEmailConfigForm({ ...emailConfigForm, password: e.target.value })}
                    />
                    <label>From *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LeadDaily Sales"
                      value={emailConfigForm.email_from}
                      onChange={(e) => setEmailConfigForm({ ...emailConfigForm, email_from: e.target.value })}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn-search" type="submit" disabled={emailConfigSaving}>
                        {emailConfigSaving ? "Saving..." : "Save"}
                      </button>
                      <button type="button" className="btn-cancel" onClick={cancelEmailConfigForm}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : emailConfigLoading ? (
                  <p className="loading-text">Loading…</p>
                ) : emailConfig ? (
                  <div className="item-card" style={{ marginTop: "0.75rem" }}>
                    <div className="item-card__body">
                      <div className="item-card__title" style={{ marginBottom: "0.5rem" }}>SMTP Configuration</div>
                      <div className="item-card__sub">Host: <strong>{emailConfig.host}</strong></div>
                      <div className="item-card__sub">Port: <strong>{emailConfig.port}</strong></div>
                      <div className="item-card__sub">Username: <strong>{emailConfig.username}</strong></div>
                      <div className="item-card__sub">Password: <strong>{'•'.repeat(8)}</strong></div>
                      <div className="item-card__sub">From: <strong>{emailConfig.email_from}</strong></div>
                    </div>
                    <div className="item-card__actions">
                      <button
                        type="button"
                        className="btn-action btn-action--edit"
                        onClick={openEmailConfigForm}
                        style={{ alignSelf: "flex-end", width: "9.5rem" }}
                      >
                        <ActionIcon kind="edit" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-action btn-action--delete"
                        onClick={handleDeleteEmailConfig}
                        style={{ alignSelf: "flex-end", width: "9.5rem" }}
                      >
                        <ActionIcon kind="delete" />
                        Delete
                      </button>
                      <form
                        onSubmit={handleSendTestEmail}
                        style={{ marginTop: "0.5rem", width: "100%", display: "flex", alignItems: "stretch", gap: "0.5rem" }}
                      >
                        <input
                          type="email"
                          required
                          placeholder="Test destination email"
                          value={testDestinationEmail}
                          onChange={(e) => setTestDestinationEmail(e.target.value)}
                          style={{ marginBottom: 0, flex: 1 }}
                        />
                        <button
                          type="submit"
                          className="btn-action btn-action--send-email"
                          disabled={sendingTestEmail}
                          style={{ width: "9.5rem" }}
                        >
                          {sendingTestEmail ? "Sending..." : "Send Test Email"}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: "0.75rem" }}>
                    <p className="empty-text" style={{ marginBottom: "1rem" }}>No email server configured. Emails will use LeadDaily&apos;s default server.</p>
                    <button type="button" className="btn-generate" onClick={openEmailConfigForm}>
                      + Add Email Server
                    </button>
                  </div>
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
                    <span className="leads-legend__count leads-legend__count--cold">{leads.filter(l => l.status === "COLD").length}</span>
                    <span className="badge badge--cold">COLD</span>
                    <span>Not yet initiated the conversation</span>
                  </div>
                  <div className="leads-legend__item">
                    <span className="leads-legend__count leads-legend__count--warm">{leads.filter(l => l.status === "WARM").length}</span>
                    <span className="badge badge--warm">WARM</span>
                    <span>First email is sent</span>
                  </div>
                  <div className="leads-legend__item">
                    <span className="leads-legend__count leads-legend__count--followed">{leads.filter(l => l.status === "FOLLOWED").length}</span>
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
                                    type="button"
                                    className="btn-action btn-action--send-email"
                                    disabled={sendingLeadId === lead.id}
                                    onClick={() => handleSendColdEmail(lead)}
                                  >
                                    <ActionIcon kind="send" />
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

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <p className="modal-box__message">
              {deleteTarget.type === "product"
                ? `Delete "${deleteTarget.product.name}"? All its leads and contacts will also be deleted.`
                : deleteTarget.type === "email-config"
                ? `Remove email server config for "${deleteTarget.product.name}"? LeadDaily's default server will be used instead.`
                : `Delete contact email "${deleteTarget.contact.subject}"?`}
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                className="btn-action btn-action--delete"
                onClick={confirmDeleteTarget}
                style={{ padding: "0.5rem 1rem" }}
              >
                Delete
              </button>
              <button className="btn-search" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
