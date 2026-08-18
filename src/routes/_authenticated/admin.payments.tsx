import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fetchPaymentMethods, type PaymentMethod } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsAdmin,
});

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["bank", "mobile", "cash"]),
  account_name: z.string().trim().max(120).default(""),
  account_number: z.string().trim().max(120).default(""),
  icon: z.string().max(4).default("🏦"),
  enabled: z.boolean(),
  sort_order: z.coerce.number().int().min(0),
});
type FormValues = z.infer<typeof schema>;

function PaymentsAdmin() {
  const qc = useQueryClient();
  const pays = useQuery({ queryKey: ["payments"], queryFn: fetchPaymentMethods });
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [show, setShow] = useState(false);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });
  const toggle = useMutation({
    mutationFn: async (m: PaymentMethod) => {
      const { error } = await supabase.from("payment_methods").update({ enabled: !m.enabled }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });

  return (
    <div>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[#2d2029]">Payment methods</h1>
          <p className="mt-1 text-sm text-[#8b6b73]">Bank accounts, mobile money and cash options shown on the site.</p>
        </div>
        <button onClick={() => { setEditing(null); setShow(true); }} className="btn-primary text-sm shrink-0">+ New method</button>
      </header>

      <div className="grid gap-3">
        {(pays.data ?? []).map((m) => (
          <div key={m.id} className="bg-white rounded-3xl p-4 border border-[#f0d5dc] flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#fef5f7] flex items-center justify-center shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#8b6b73]">{m.type}</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[#2d2029] truncate">{m.name}</div>
              <div className="text-xs text-[#8b6b73] truncate">{m.type} · {m.account_name} {m.account_number && `— ${m.account_number}`}</div>
            </div>
            <button onClick={() => toggle.mutate(m)} className={`hidden sm:inline text-xs px-3 py-1.5 rounded-full font-semibold ${m.enabled ? "bg-[#ddf8f8] text-[#2a6b6b]" : "bg-[#faf0f2] text-[#8b6b73]"}`}>
              {m.enabled ? "Active" : "Off"}
            </button>
            <button onClick={() => { setEditing(m); setShow(true); }} className="rounded-full px-3 py-1.5 text-xs font-semibold bg-[#fadadd]/40 hover:bg-[#fadadd]">Edit</button>
            <button onClick={() => confirm(`Delete "${m.name}"?`) && del.mutate(m.id)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100">Delete</button>
          </div>
        ))}
      </div>

      {show && (
        <PaymentForm method={editing} onClose={() => setShow(false)}
          onSaved={() => { setShow(false); qc.invalidateQueries({ queryKey: ["payments"] }); }} />
      )}
    </div>
  );
}

function PaymentForm({ method, onClose, onSaved }: { method: PaymentMethod | null; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<FormValues>({
    name: method?.name ?? "",
    type: method?.type ?? "bank",
    account_name: method?.account_name ?? "",
    account_number: method?.account_number ?? "",
    icon: method?.icon ?? "🏦",
    enabled: method?.enabled ?? true,
    sort_order: method?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSaving(true); setError(null);
    try {
      if (method) {
        const { error } = await supabase.from("payment_methods").update(parsed.data).eq("id", method.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_methods").insert(parsed.data);
        if (error) throw error;
      }
      onSaved();
    } catch (err: any) { setError(err?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-[#f0d5dc] shadow-[var(--shadow-elegant)] my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold">{method ? "Edit" : "New"} payment</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-[#faf0f2]">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Name</label>
            <input required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })}
              className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Type</label>
            <select value={values.type} onChange={(e) => setValues({ ...values, type: e.target.value as any })}
              className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad] bg-white">
              <option value="bank">Bank</option>
              <option value="mobile">Mobile Payment</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Account name</label>
              <input value={values.account_name} onChange={(e) => setValues({ ...values, account_name: e.target.value })}
                className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Account number</label>
              <input value={values.account_number} onChange={(e) => setValues({ ...values, account_number: e.target.value })}
                className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Order</label>
              <input type="number" value={values.sort_order} onChange={(e) => setValues({ ...values, sort_order: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad]" />
            </div>
            <label className="flex items-end gap-2 text-sm pb-3">
              <input type="checkbox" checked={values.enabled} onChange={(e) => setValues({ ...values, enabled: e.target.checked })} className="w-4 h-4 accent-[#f5a1ad]" />
              Enabled
            </label>
          </div>
          {error && <div className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-2 border border-red-200">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm flex-1 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
