import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, type Category } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: CategoriesAdmin,
});

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, hyphens").min(1).max(60),
  icon: z.string().trim().max(4).default("🍰"),
  visible: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(1000),
});
type FormValues = z.infer<typeof schema>;

function CategoriesAdmin() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const toggleVis = useMutation({
    mutationFn: async (c: Category) => {
      const { error } = await supabase.from("categories").update({ visible: !c.visible }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  return (
    <div>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[#2d2029]">Categories</h1>
          <p className="mt-1 text-sm text-[#8b6b73]">Organize your cakes into browsable sections.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary text-sm shrink-0">+ New category</button>
      </header>

      <div className="bg-white rounded-3xl border border-[#f0d5dc] overflow-hidden">
        {(cats.data ?? []).map((c, idx) => (
          <div key={c.id} className={`flex items-center gap-4 p-4 ${idx > 0 ? "border-t border-[#faf0f2]" : ""}`}>
            <div className="w-10 h-10 rounded-2xl bg-[#fef5f7] flex items-center justify-center text-sm font-bold text-[#e88aab] shrink-0">{c.name.charAt(0).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[#2d2029] truncate">{c.name}</div>
              <div className="text-xs text-[#8b6b73] truncate">/{c.slug} · order {c.sort_order}</div>
            </div>
            <button onClick={() => toggleVis.mutate(c)} className={`hidden sm:inline text-xs px-3 py-1.5 rounded-full font-semibold ${c.visible ? "bg-[#ddf8f8] text-[#2a6b6b]" : "bg-[#faf0f2] text-[#8b6b73]"}`}>
              {c.visible ? "Visible" : "Hidden"}
            </button>
            <button onClick={() => { setEditing(c); setShowForm(true); }} className="rounded-full px-3 py-1.5 text-xs font-semibold bg-[#fadadd]/40 hover:bg-[#fadadd]">Edit</button>
            <button onClick={() => confirm(`Delete "${c.name}"?`) && del.mutate(c.id)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100">Delete</button>
          </div>
        ))}
        {cats.data?.length === 0 && <div className="p-8 text-center text-[#8b6b73]">No categories yet.</div>}
      </div>

      {showForm && (
        <CategoryForm
          category={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["categories"] }); }}
        />
      )}
    </div>
  );
}

function CategoryForm({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<FormValues>({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    icon: category?.icon ?? "🍰",
    visible: category?.visible ?? true,
    sort_order: category?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSaving(true); setError(null);
    try {
      if (category) {
        const { error } = await supabase.from("categories").update(parsed.data).eq("id", category.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(parsed.data);
        if (error) throw error;
      }
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Save failed");
    } finally { setSaving(false); }
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-[#f0d5dc] shadow-[var(--shadow-elegant)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold">{category ? "Edit" : "New"} category</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-[#faf0f2]">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Name</label>
            <input required value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value, slug: values.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })}
              className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Slug</label>
            <input required value={values.slug} onChange={(e) => setValues({ ...values, slug: e.target.value })}
              className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Sort order</label>
              <input type="number" min={0} value={values.sort_order}
                onChange={(e) => setValues({ ...values, sort_order: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad]" />
            </div>
            <label className="flex items-end gap-2 text-sm pb-3">
              <input type="checkbox" checked={values.visible} onChange={(e) => setValues({ ...values, visible: e.target.checked })} className="w-4 h-4 accent-[#f5a1ad]" />
              Visible on site
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
