import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchProducts, fetchPaymentMethods, fetchSiteSettings } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
});

function Overview() {
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const cats = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const pays = useQuery({ queryKey: ["payments"], queryFn: fetchPaymentMethods });
  const settings = useQuery({ queryKey: ["site-settings"], queryFn: fetchSiteSettings });

  const stats = [
    { label: "Products", value: products.data?.length ?? "—", tint: "#fadadd" },
    { label: "Categories", value: cats.data?.length ?? "—", tint: "#ddf8f8" },
    { label: "Payment methods", value: pays.data?.length ?? "—", tint: "#fef0d5" },
    { label: "Featured items", value: products.data?.filter(p => p.featured).length ?? "—", tint: "#fadadd" },
    { label: "Available", value: products.data?.filter(p => p.available).length ?? "—", tint: "#ddf8f8" },
    { label: "Sold out", value: products.data?.filter(p => !p.available).length ?? "—", tint: "#fdecec" },
  ];

  return (
    <div>
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-[#2d2029]">Welcome back</h1>
        <p className="mt-1 text-[#8b6b73]">{settings.data?.shop_name ?? "Selam Cake Shop"} — dashboard overview.</p>
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-3xl p-6 border border-[#f0d5dc] shadow-[0_8px_24px_-16px_rgba(233,30,99,0.15)]">
            <div className="w-2 h-8 rounded-full" style={{ background: s.tint }} />
            <div className="mt-4 font-display text-3xl font-bold text-[#2d2029]">{s.value}</div>
            <div className="text-sm text-[#8b6b73]">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-[#f0d5dc]">
          <h3 className="font-display text-lg font-bold text-[#2d2029]">Recent products</h3>
          <ul className="mt-4 space-y-2">
            {(products.data ?? []).slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-[#faf0f2] last:border-0">
                <span className="truncate">{p.name}</span>
                <span className="text-[#8b6b73] shrink-0">{p.price} Birr</span>
              </li>
            ))}
            {products.data?.length === 0 && <li className="text-sm text-[#8b6b73]">No products yet. Add your first cake.</li>}
          </ul>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-[#f0d5dc]">
          <h3 className="font-display text-lg font-bold text-[#2d2029]">Payment methods</h3>
          <ul className="mt-4 space-y-2">
            {(pays.data ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm py-2 border-b border-[#faf0f2] last:border-0">
                <span>{m.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${m.enabled ? "bg-[#ddf8f8] text-[#2a6b6b]" : "bg-[#faf0f2] text-[#8b6b73]"}`}>{m.enabled ? "Active" : "Disabled"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
