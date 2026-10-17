"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, MapPinned, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  type CustomerAddress,
  useCustomerAuth,
} from "@/lib/customer-auth";
import { lookupPincode, toTitleCase } from "@/lib/pincode";
import { useHydrated } from "@/lib/useHydrated";
import { ConfirmModal } from "@/components/ConfirmModal";

type FormState = {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  label: "Home" | "Work";
  isDefault: boolean;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const emptyForm = (phone = "", name = "", email = ""): FormState => ({
  name: name || "",
  email: email || "",
  phone: phone || "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  label: "Home",
  isDefault: false,
});

export default function AccountAddressesPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { token, user, refreshMe } = useCustomerAuth();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [pinLoading, setPinLoading] = useState(false);
  const [pinLookupFor, setPinLookupFor] = useState("");
  const [pinError, setPinError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const rows = await api<CustomerAddress[]>("/addresses", { token });
      setAddresses(rows);
    } catch (e: any) {
      setError(e.message || "Failed to load addresses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/account/login?next=/account/addresses");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, token, router]);

  function openCreate() {
    setEditingId(null);
    setForm(
      emptyForm(
        user?.phone || "",
        user?.name || "",
        user?.email || "",
      ),
    );
    setShowForm(true);
    setError("");
    setMsg("");
    setPinError("");
    setPinLookupFor("");
  }

  function openEdit(a: CustomerAddress) {
    setEditingId(a.id);
    setForm({
      name: a.name,
      email: a.email || user?.email || "",
      phone: a.phone,
      line1: a.line1,
      line2: a.line2 || "",
      city: toTitleCase(a.city),
      state: toTitleCase(a.state),
      pincode: a.pincode,
      label:
        a.label === "Work" || a.label === "Home" ? a.label : "Home",
      isDefault: a.isDefault,
    });
    setShowForm(true);
    setError("");
    setMsg("");
    setPinError("");
    setPinLookupFor(
      /^\d{6}$/.test(a.pincode || "") && a.city && a.state ? a.pincode : "",
    );
  }

  async function lookupFormPincode(pin: string) {
    if (!/^\d{6}$/.test(pin)) return;
    setPinLoading(true);
    setPinLookupFor("");
    setPinError("");
    try {
      const loc = await lookupPincode(pin);
      setForm((f) =>
        f.pincode === pin ? { ...f, city: loc.city, state: loc.state } : f,
      );
      setPinLookupFor(pin);
      setPinError("");
    } catch (e: unknown) {
      setForm((f) =>
        f.pincode === pin ? { ...f, city: "", state: "" } : f,
      );
      setPinLookupFor("");
      setPinError(
        e instanceof Error
          ? e.message
          : "Invalid or unsupported pincode. Please check and try again.",
      );
    } finally {
      setPinLoading(false);
    }
  }

  const formValid =
    form.name.trim().length >= 2 &&
    isValidEmail(form.email) &&
    /^\d{10}$/.test(form.phone.replace(/\D/g, "")) &&
    form.line1.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    /^\d{6}$/.test(form.pincode) &&
    pinLookupFor === form.pincode &&
    !pinError &&
    !pinLoading;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token || !formValid) return;
    setSaving(true);
    setError("");
    setMsg("");
    const body = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.replace(/\D/g, "").slice(-10),
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      city: toTitleCase(form.city),
      state: toTitleCase(form.state),
      pincode: form.pincode.trim(),
      label: form.label,
      isDefault: form.isDefault,
    };
    try {
      if (editingId) {
        await api(`/addresses/${editingId}`, {
          method: "PATCH",
          token,
          body,
        });
        setMsg("Address updated");
      } else {
        await api("/addresses", { method: "POST", token, body });
        setMsg("Address added");
      }
      setShowForm(false);
      await load();
      await refreshMe();
    } catch (err: any) {
      setError(err.message || "Could not save address");
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: string) {
    if (!token) return;
    try {
      await api(`/addresses/${id}/default`, { method: "POST", token });
      await load();
      await refreshMe();
      setMsg("Default address updated");
    } catch (err: any) {
      setError(err.message || "Failed to set default");
    }
  }

  async function confirmDelete() {
    if (!token || !deleteId) return;
    setDeleting(true);
    setError("");
    try {
      await api(`/addresses/${deleteId}`, { method: "DELETE", token });
      setDeleteId(null);
      await load();
      await refreshMe();
      setMsg("Address deleted");
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  if (!hydrated || !token) {
    return <p className="text-sm text-[#7A6E62]">Loading…</p>;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-5 sm:mb-6">
        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
          <span className="mt-0.5 h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#E8F5EE] text-[#1F6B45] grid place-items-center shrink-0">
            <MapPinned size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-[#1C1410]">
              Saved addresses
            </h2>
            <p className="text-xs sm:text-sm text-[#7A6E62] mt-0.5">
              Add, edit and choose a default
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 sm:gap-1.5 bg-[#1C1410] text-white rounded-xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-sm font-bold shrink-0"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add</span>
          </button>
        )}
      </div>

      {msg && (
        <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          {msg}
        </p>
      )}
      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={onSave}
          className="mb-6 rounded-2xl border border-[#eee] bg-white p-4 sm:p-5 space-y-3"
        >
          <h2 className="font-bold text-base">
            {editingId ? "Edit address" : "New address"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-semibold text-[#666]">Full name *</span>
              <input
                className="mt-1 w-full border border-[#ddd] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-black"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-semibold text-[#666]">Email *</span>
              <input
                type="email"
                className="mt-1 w-full border border-[#ddd] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-black"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold text-[#666]">Phone *</span>
              <input
                className="mt-1 w-full border border-[#ddd] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-black"
                value={form.phone}
                inputMode="numeric"
                maxLength={10}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  }))
                }
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold text-[#666]">Pincode *</span>
              <input
                className="mt-1 w-full border border-[#ddd] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-black"
                value={form.pincode}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => {
                  const nextPin = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setForm((f) => ({
                    ...f,
                    pincode: nextPin,
                    ...(nextPin.length === 6 ? {} : { city: "", state: "" }),
                  }));
                  setPinError("");
                  if (nextPin.length === 6) {
                    void lookupFormPincode(nextPin);
                  } else {
                    setPinLookupFor("");
                  }
                }}
                required
              />
              {pinLoading && (
                <span className="block text-[11px] text-[#888] mt-1">
                  Looking up city &amp; state…
                </span>
              )}
              {pinError && !pinLoading && (
                <span className="block text-[12px] text-red-600 mt-1">
                  {pinError}
                </span>
              )}
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold text-[#666]">City *</span>
              <input
                className="mt-1 w-full border border-[#ddd] rounded-xl px-3 py-2.5 text-sm outline-none bg-[#f5f5f5] text-[#555] cursor-default"
                value={form.city}
                readOnly
                tabIndex={-1}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold text-[#666]">State *</span>
              <input
                className="mt-1 w-full border border-[#ddd] rounded-xl px-3 py-2.5 text-sm outline-none bg-[#f5f5f5] text-[#555] cursor-default"
                value={form.state}
                readOnly
                tabIndex={-1}
                required
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-semibold text-[#666]">
                Flat / House no. *
              </span>
              <input
                className="mt-1 w-full border border-[#ddd] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-black"
                value={form.line1}
                onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-semibold text-[#666]">
                Area / Landmark
              </span>
              <input
                className="mt-1 w-full border border-[#ddd] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-black"
                value={form.line2}
                onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
              />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#666] mb-2">Save as</p>
            <div className="flex flex-wrap gap-2">
              {(["Home", "Work"] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, label }))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    form.label === label ? "border-black bg-[#f7f7f7]" : "border-[#ddd]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) =>
                setForm((f) => ({ ...f, isDefault: e.target.checked }))
              }
            />
            Set as default delivery address
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!formValid || saving}
              className="bg-black text-white rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Update address" : "Save address"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border border-[#ddd] rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[#666]">Loading addresses…</p>
      ) : addresses.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-[#ddd] bg-[#F9F8F6] p-10 text-center">
          <MapPin className="mx-auto text-[#ccc] mb-3" size={36} />
          <p className="text-[#666] mb-4">No saved addresses yet.</p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 bg-black text-white rounded-xl px-5 py-2.5 text-sm font-bold"
          >
            <Plus size={16} /> Add address
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-[#eee] bg-white p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-[#f3f3f3]">
                      <Home size={12} /> {a.label || "Address"}
                    </span>
                    {a.isDefault && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        <Star size={12} /> Default
                      </span>
                    )}
                  </div>
                  <p className="font-bold mt-2">{a.name}</p>
                  {a.email && (
                    <p className="text-sm text-[#666] mt-0.5">{a.email}</p>
                  )}
                  <p className="text-sm text-[#555] mt-0.5 leading-relaxed">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                  </p>
                  <p className="text-sm text-[#555]">
                    {toTitleCase(a.city)}, {toTitleCase(a.state)} {a.pincode}
                  </p>
                  <p className="text-sm text-[#666] mt-1">+91 {a.phone}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="inline-flex items-center gap-1 text-xs font-semibold border border-[#ddd] rounded-lg px-2.5 py-1.5 hover:bg-[#f7f7f7]"
                >
                  <Pencil size={13} /> Edit
                </button>
                {!a.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefault(a.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold border border-[#ddd] rounded-lg px-2.5 py-1.5 hover:bg-[#f7f7f7]"
                  >
                    <Star size={13} /> Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDeleteId(a.id);
                    setError("");
                    setMsg("");
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold border border-red-200 text-red-700 rounded-lg px-2.5 py-1.5 hover:bg-red-50"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={Boolean(deleteId)}
        title="Delete this address?"
        message="This address will be removed from your account. You can add it again anytime."
        confirmLabel="Delete address"
        cancelLabel="Keep address"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!deleting) setDeleteId(null);
        }}
      />
    </div>
  );
}
