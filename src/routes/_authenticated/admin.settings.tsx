import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fetchSiteSettings, signImagePath, uploadProductImage, type SiteSettings } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsAdmin,
});

const schema = z.object({
  shop_name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(200),
  about_text: z.string().trim().max(2000),
  hero_title: z.string().trim().max(120),
  hero_subtitle: z.string().trim().max(200),
  hero_image_url: z.string().max(500).nullable(),
  address: z.string().trim().max(200),
  phone: z.string().trim().max(40),
  whatsapp: z.string().trim().max(40).nullable(),
  email: z.string().trim().email().or(z.literal("")).nullable(),
  working_hours: z.string().trim().max(120).nullable(),
  maps_url: z.string().trim().max(500).nullable(),
  facebook_url: z.string().trim().max(200).nullable(),
  instagram_url: z.string().trim().max(200).nullable(),
  tiktok_url: z.string().trim().max(200).nullable(),
  telegram_url: z.string().trim().max(200).nullable(),
  primary_color: z.string().trim().max(20).nullable(),
  accent_color: z.string().trim().max(20).nullable(),
});
type FormValues = z.infer<typeof schema>;

function SettingsAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["site-settings"], queryFn: fetchSiteSettings });
  const [values, setValues] = useState<FormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState<"brand" | "hero" | "contact" | "social" | "password">("brand");
  const [heroPreview, setHeroPreview] = useState<string | null>(null);


  useEffect(() => {
    if (data) {
      setValues({
        shop_name: data.shop_name,
        tagline: data.tagline,
        about_text: data.about_text,
        hero_title: data.hero_title,
        hero_subtitle: data.hero_subtitle,
        hero_image_url: data.hero_image_url,
        address: data.address,
        phone: data.phone,
        whatsapp: data.whatsapp ?? "",
        email: data.email ?? "",
        working_hours: data.working_hours ?? "",
        maps_url: data.maps_url ?? "",
        facebook_url: data.facebook_url ?? "",
        instagram_url: data.instagram_url ?? "",
        tiktok_url: data.tiktok_url ?? "",
        telegram_url: data.telegram_url ?? "",
        primary_color: data.primary_color ?? "#f5a1ad",
        accent_color: data.accent_color ?? "#ddf8f8",
      });
    }
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await signImagePath(values?.hero_image_url ?? null);
      if (!cancelled) setHeroPreview(url);
    })();
    return () => { cancelled = true; };
  }, [values?.hero_image_url]);

  if (isLoading || !values || !data) return <div className="text-[#8b6b73]">Loading…</div>;



  const V = values;
  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => setValues({ ...V, [k]: v });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk(false);
    if (!V || !data) return;
    const parsed = schema.safeParse(V);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSaving(true); setError(null);
    try {
      const { error } = await supabase.from("site_settings").update(parsed.data).eq("id", data.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      setOk(true);
    } catch (err: any) { setError(err?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleHeroFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadProductImage(file);
    set("hero_image_url", path);
  }
  return (
    <div>

      <h1 className="font-display text-3xl md:text-4xl font-bold text-[#2d2029]">Site settings</h1>
      <p className="mt-1 text-sm text-[#8b6b73]">Every change here updates the public site instantly.</p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {[
          { k: "brand", label: "Brand & About" },
          { k: "hero", label: "Hero" },
          { k: "contact", label: "Contact" },
          { k: "social", label: "Social" },
          { k: "password", label: "Password" },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${tab === t.k ? "bg-gradient-to-r from-[#fadadd] to-[#ddf8f8] text-[#2d2029]" : "bg-white border border-[#f0d5dc] text-[#8b6b73]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "password" ? <PasswordChange /> : (
        <form onSubmit={submit} className="mt-6 bg-white rounded-3xl p-6 sm:p-8 border border-[#f0d5dc] space-y-5">
          {tab === "brand" && (
            <>
              <Field label="Shop name"><input value={V.shop_name} onChange={(e) => set("shop_name", e.target.value)} className={inputCls} /></Field>
              <Field label="Tagline"><input value={V.tagline} onChange={(e) => set("tagline", e.target.value)} className={inputCls} /></Field>
              <Field label="About text"><textarea rows={5} value={V.about_text} onChange={(e) => set("about_text", e.target.value)} className={inputCls + " resize-none"} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primary color"><input type="color" value={V.primary_color ?? "#f5a1ad"} onChange={(e) => set("primary_color", e.target.value)} className="w-full h-12 rounded-2xl border border-[#f0d5dc]" /></Field>
                <Field label="Accent color"><input type="color" value={V.accent_color ?? "#ddf8f8"} onChange={(e) => set("accent_color", e.target.value)} className="w-full h-12 rounded-2xl border border-[#f0d5dc]" /></Field>
              </div>
            </>
          )}
          {tab === "hero" && (
            <>
              <Field label="Hero title"><input value={V.hero_title} onChange={(e) => set("hero_title", e.target.value)} className={inputCls} /></Field>
              <Field label="Hero subtitle"><input value={V.hero_subtitle} onChange={(e) => set("hero_subtitle", e.target.value)} className={inputCls} /></Field>
              <Field label="Hero image">
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 rounded-2xl overflow-hidden bg-[#fef5f7] border border-[#f0d5dc] shrink-0">
                    {heroPreview ? <img src={heroPreview} alt="hero" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-wider text-[#b39aa1]">No image</div>}
                  </div>
                  <label className="flex-1 rounded-2xl border-2 border-dashed border-[#f0d5dc] p-4 text-center cursor-pointer hover:border-[#f5a1ad] text-sm text-[#8b6b73]">
                    <input type="file" accept="image/*" onChange={handleHeroFile} className="hidden" />
                    Click to upload · JPG, PNG, WebP
                  </label>
                </div>
              </Field>
            </>
          )}
          {tab === "contact" && (
            <>
              <Field label="Address"><input value={V.address} onChange={(e) => set("address", e.target.value)} className={inputCls} /></Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Phone"><input value={V.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} /></Field>
                <Field label="WhatsApp"><input value={V.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} className={inputCls} /></Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Email"><input type="email" value={V.email ?? ""} onChange={(e) => set("email", e.target.value)} className={inputCls} /></Field>
                <Field label="Working hours"><input value={V.working_hours ?? ""} onChange={(e) => set("working_hours", e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Google Maps embed URL"><input value={V.maps_url ?? ""} onChange={(e) => set("maps_url", e.target.value)} className={inputCls} /></Field>
            </>
          )}
          {tab === "social" && (
            <>
              <Field label="Facebook URL"><input value={V.facebook_url ?? ""} onChange={(e) => set("facebook_url", e.target.value)} className={inputCls} /></Field>
              <Field label="Instagram URL"><input value={V.instagram_url ?? ""} onChange={(e) => set("instagram_url", e.target.value)} className={inputCls} /></Field>
              <Field label="TikTok URL"><input value={V.tiktok_url ?? ""} onChange={(e) => set("tiktok_url", e.target.value)} className={inputCls} /></Field>
              <Field label="Telegram URL"><input value={V.telegram_url ?? ""} onChange={(e) => set("telegram_url", e.target.value)} className={inputCls} /></Field>
            </>
          )}

          {error && <div className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-2 border border-red-200">{error}</div>}
          {ok && <div className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-2 border border-green-200">Saved</div>}

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad] text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function PasswordChange() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) return setMsg({ ok: false, text: "New password must be at least 8 characters" });
    if (next !== confirm) return setMsg({ ok: false, text: "Passwords do not match" });
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user?.email) throw new Error("No email on this account");
      // Re-authenticate with current password to prove ownership
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userRes.user.email,
        password: current,
      });
      if (signInErr) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setMsg({ ok: true, text: "Password updated" });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message ?? "Update failed" });
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mt-6 bg-white rounded-3xl p-6 sm:p-8 border border-[#f0d5dc] space-y-4 max-w-md">
      <h3 className="font-display text-xl font-bold">Change password</h3>
      <Field label="Current password"><input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} /></Field>
      <Field label="New password"><input type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} /></Field>
      <Field label="Confirm new password"><input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} /></Field>
      {msg && <div className={`text-sm rounded-xl px-4 py-2 border ${msg.ok ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>{msg.text}</div>}
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-60">{busy ? "Updating…" : "Update password"}</button>
      </div>
    </form>
  );
}
