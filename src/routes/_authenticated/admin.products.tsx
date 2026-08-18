import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, fetchProducts, signImagePath, uploadProductImage, type Product } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsAdmin,
});

const productSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  description: z.string().trim().max(1000).default(""),
  price: z.coerce.number().min(0).max(999999),
  category_id: z.string().uuid().nullable(),
  emoji: z.string().max(4).default("🌸"),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
  image_path: z.string().max(500).nullable().optional(),
});

type FormValues = z.infer<typeof productSchema>;
type SortKey = "newest" | "oldest" | "price_asc" | "price_desc" | "name";

function ProductsAdmin() {
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const cats = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const { error } = await supabase.from("products").update({ available }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, available }) => {
      await qc.cancelQueries({ queryKey: ["products"] });
      const prev = qc.getQueryData<Product[]>(["products"]);
      qc.setQueryData<Product[]>(["products"], (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, available } : p))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["products"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const filtered = (products.data ?? [])
    .filter((p) => (filterCat === "all" ? true : p.category_id === filterCat))
    .filter((p) => (search ? p.name.toLowerCase().includes(search.toLowerCase()) : true))
    .sort((a, b) => {
      switch (sort) {
        case "price_asc": return a.price - b.price;
        case "price_desc": return b.price - a.price;
        case "name": return a.name.localeCompare(b.name);
        case "oldest": return a.sort_order - b.sort_order;
        default: return b.sort_order - a.sort_order;
      }
    });

  return (
    <div>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[#2d2029]">Products</h1>
          <p className="mt-1 text-sm text-[#8b6b73]">Manage cakes, cupcakes and pastries.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary text-sm shrink-0">
          + New product
        </button>
      </header>

      <div className="bg-white rounded-3xl p-4 border border-[#f0d5dc] mb-6 grid gap-3 sm:grid-cols-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…"
          className="rounded-2xl border border-[#f0d5dc] px-4 py-2.5 text-sm outline-none focus:border-[#f5a1ad]" />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-2xl border border-[#f0d5dc] px-4 py-2.5 text-sm outline-none focus:border-[#f5a1ad] bg-white">
          <option value="all">All categories</option>
          {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-2xl border border-[#f0d5dc] px-4 py-2.5 text-sm outline-none focus:border-[#f5a1ad] bg-white">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="price_asc">Price · Low to High</option>
          <option value="price_desc">Price · High to Low</option>
          <option value="name">Alphabetical</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((p) => {
          const cat = cats.data?.find((c) => c.id === p.category_id);
          const url = p.image_display_url ?? null;
          return (
            <article key={p.id} className={`bg-white rounded-3xl overflow-hidden border border-[#f0d5dc] shadow-[0_8px_24px_-16px_rgba(233,30,99,0.15)] ${!p.available ? "opacity-75" : ""}`}>
              <div className="aspect-video bg-[#fef5f7] relative">
                {url ? (
                  <img src={url} alt={p.name} loading="lazy" className={`w-full h-full object-cover ${!p.available ? "grayscale-[0.4]" : ""}`} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#8b6b73] text-xs font-semibold uppercase tracking-wider">No image</div>
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  {p.featured && <span className="px-2 py-0.5 rounded-full bg-white/90 text-[10px] font-bold">FEATURED</span>}
                  {!p.available && <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">SOLD OUT</span>}
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[#2d2029] truncate">{p.name}</h3>
                    <p className="text-xs text-[#8b6b73] truncate">{cat?.name ?? "Uncategorized"}</p>
                  </div>
                  <span className="font-bold text-[#e88aab] shrink-0">{p.price} Birr</span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-[#faf5f6] px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#8b6b73]">Availability</div>
                    <div className={`text-xs font-semibold ${p.available ? "text-emerald-700" : "text-red-600"}`}>
                      {p.available ? "Available" : "Sold Out"}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.available}
                    disabled={toggleAvailability.isPending}
                    onClick={() => toggleAvailability.mutate({ id: p.id, available: !p.available })}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${p.available ? "bg-emerald-500" : "bg-gray-300"}`}
                    aria-label={`Toggle availability for ${p.name}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${p.available ? "translate-x-[22px]" : "translate-x-0.5"} self-center`} />
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setEditing(p); setShowForm(true); }} className="flex-1 rounded-full py-2 text-xs font-semibold bg-[#ddf8f8]/60 hover:bg-[#ddf8f8] transition-colors">Edit</button>
                  <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) del.mutate(p.id); }} className="rounded-full py-2 px-3 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors">Delete</button>
                </div>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && !products.isLoading && (
          <div className="col-span-full text-center py-12 text-[#8b6b73]">No products match your filters.</div>
        )}
      </div>

      {showForm && (
        <ProductForm
          product={editing}
          categories={cats.data ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["products"] }); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }: {
  product: Product | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<FormValues>({
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product?.price ?? 0,
    category_id: product?.category_id ?? (categories[0]?.id ?? null),
    emoji: product?.emoji ?? "🌸",
    available: product?.available ?? true,
    featured: product?.featured ?? false,
    image_path: product?.image_url ?? null,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await signImagePath(values.image_path ?? null);
      if (!cancelled) setPreview(url);
    })();
    return () => { cancelled = true; };
  }, [values.image_path]);




  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPG, PNG or WebP images allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const path = await uploadProductImage(file);
      setValues((v) => ({ ...v, image_path: path }));
    } catch (err: any) {
      setError(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = productSchema.safeParse(values);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setSaving(true);
    try {
      const payload = {
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        category_id: parsed.data.category_id,
        emoji: parsed.data.emoji,
        available: parsed.data.available,
        featured: parsed.data.featured,
        image_url: parsed.data.image_path,
      };
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }




  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={handleSave} className="w-full max-w-lg bg-white rounded-3xl shadow-[var(--shadow-elegant)] p-6 sm:p-8 my-8 border border-[#f0d5dc]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold text-[#2d2029]">{product ? "Edit product" : "New product"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-[#faf0f2] hover:bg-[#f5a1ad] hover:text-white transition-colors">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Name</label>
            <input required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })}
              className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad]" />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Description</label>
            <textarea rows={3} value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })}
              className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad] resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Price (Birr)</label>
              <input type="number" min={0} step="1" required value={values.price}
                onChange={(e) => setValues({ ...values, price: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Category</label>
              <select value={values.category_id ?? ""} onChange={(e) => setValues({ ...values, category_id: e.target.value || null })}
                className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] px-4 py-3 outline-none focus:border-[#f5a1ad] bg-white">
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Image</label>
            <div className="mt-1.5 flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-[#fef5f7] border border-[#f0d5dc] flex items-center justify-center overflow-hidden shrink-0">
                {preview ? <img src={preview} alt="preview" className="w-full h-full object-cover" /> : <span className="text-[10px] uppercase tracking-wider text-[#b39aa1]">No image</span>}
              </div>
              <label className="flex-1 rounded-2xl border-2 border-dashed border-[#f0d5dc] p-4 text-center cursor-pointer hover:border-[#f5a1ad] transition-colors">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
                <div className="text-sm text-[#8b6b73]">
                  {uploading ? "Uploading…" : preview ? "Replace image" : "Click to upload"}
                </div>
                <div className="text-xs text-[#b39aa1] mt-1">JPG, PNG, WebP · up to 5 MB</div>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={values.available} onChange={(e) => setValues({ ...values, available: e.target.checked })} className="w-4 h-4 accent-[#f5a1ad]" />
              Available
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={values.featured} onChange={(e) => setValues({ ...values, featured: e.target.checked })} className="w-4 h-4 accent-[#f5a1ad]" />
              Featured
            </label>
          </div>

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</div>}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary text-sm flex-1">Cancel</button>
            <button type="submit" disabled={saving || uploading} className="btn-primary text-sm flex-1 disabled:opacity-60">
              {saving ? "Saving…" : "Save product"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
