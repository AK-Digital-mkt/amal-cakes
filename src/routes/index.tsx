import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import heroFallback from "@/assets/hero-cake.jpg";
import cakeStrawberry from "@/assets/cake-strawberry.jpg";
import cakeVanilla from "@/assets/cake-vanilla.jpg";
import cakeMint from "@/assets/cake-mint.jpg";
import cakeCupcake from "@/assets/cake-cupcake.jpg";
import cakeChocolate from "@/assets/cake-chocolate.jpg";
import cakeCheesecake from "@/assets/cake-cheesecake.jpg";
import logoAsset from "@/assets/logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCategories,
  fetchPaymentMethods,
  fetchProducts,
  fetchSiteSettings,
  type Product,
} from "@/lib/db";

export const Route = createFileRoute("/")({
  component: DigitalMenu,
});

type ModalKey = "payment" | "about" | null;

const LOGO_URL = logoAsset.url;

const FALLBACK_IMAGES = [
  cakeStrawberry, cakeVanilla, cakeMint,
  cakeCupcake, cakeChocolate, cakeCheesecake,
];
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function fallbackFor(item: { id: string; name: string }): string {
  return FALLBACK_IMAGES[hashString(item.id + item.name) % FALLBACK_IMAGES.length];
}
function buildMapEmbed(mapsUrl: string | null | undefined, address: string | null | undefined): string | null {
  const isEmbeddable = mapsUrl && /google\.com\/maps\/embed/.test(mapsUrl);
  if (isEmbeddable) return mapsUrl!;
  if (address) return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  return null;
}


function DigitalMenu() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["site-settings"], queryFn: fetchSiteSettings });
  const cats = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const pays = useQuery({ queryKey: ["payments"], queryFn: fetchPaymentMethods });

  const [activeCat, setActiveCat] = useState<string>("ALL");
  const [modal, setModal] = useState<ModalKey>(null);
  const [openItem, setOpenItem] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Realtime: reflect availability changes instantly
  useEffect(() => {
    const channel = supabase
      .channel("public:products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        qc.invalidateQueries({ queryKey: ["products"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const visibleCats = useMemo(() => (cats.data ?? []).filter((c) => c.visible), [cats.data]);
  const allProducts = products.data ?? [];

  const filtered = useMemo(
    () => (activeCat === "ALL"
      ? allProducts
      : allProducts.filter((p) => p.category_id === activeCat)),
    [allProducts, activeCat]
  );

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    showToast(`${label} copied`);
  }

  const heroImg = settings.data?.hero_display_url ?? heroFallback;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#fef5f7] to-[#f0fafa]">
      <div className="mx-auto w-full max-w-[520px] sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl relative">
        <Hero settings={settings.data} heroImg={heroImg} />
        <CategoryPills categories={visibleCats} activeCat={activeCat} setActiveCat={setActiveCat} />
        <MenuList items={filtered} activeCat={activeCat} categories={visibleCats} onOpen={setOpenItem} />
        {filtered.length === 0 && !products.isLoading && (
          <div className="text-center py-16 text-[#8b6b73] px-6">
            <img src={LOGO_URL} alt="" className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <div>No items in this category yet.</div>
          </div>
        )}
      </div>

      {modal === "payment" && (
        <PaymentModal methods={pays.data ?? []} onClose={() => setModal(null)} onCopy={copy} />
      )}
      {modal === "about" && (
        <AboutModal settings={settings.data} onClose={() => setModal(null)} />
      )}
      {openItem && (
        <ItemModal item={openItem} onClose={() => setOpenItem(null)} />
      )}

      <Toast msg={toast} />
    </div>
  );
}

function Hero({ settings, heroImg }: { settings: any; heroImg: string }) {
  const bgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      if (bgRef.current && window.scrollY < 500) {
        bgRef.current.style.transform = `translateY(${window.scrollY * 0.4}px)`;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="relative h-[380px] sm:h-[440px] md:h-[500px] lg:h-[560px] overflow-hidden sm:rounded-b-[32px]">
      <div ref={bgRef} className="absolute inset-0">
        <img src={heroImg} alt="Signature cake" className="w-full h-full object-cover" />
      </div>
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(250,218,221,0.55) 55%, rgba(221,248,248,0.85) 100%)" }} />

      <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2 glass px-3 py-2 rounded-full">
          <img src={LOGO_URL} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-sm" />
          <span className="font-display font-semibold text-sm sm:text-base">{settings?.shop_name ?? "Selam"}</span>
        </div>
        <Link to="/auth" className="glass w-11 h-11 rounded-full flex items-center justify-center hover:scale-105 transition-transform" aria-label="Admin">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#8b6b73]">
            <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </Link>
      </div>

      <div className="absolute bottom-8 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 glass px-3.5 py-1.5 rounded-full text-xs font-semibold mb-3">
          <span className="w-2 h-2 rounded-full bg-[#f5a1ad] animate-pulse shadow-[0_0_10px_#f5a1ad]" />
          {settings?.hero_subtitle ?? "Handcrafted with love"}
        </div>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-tight text-[#2d2029]">
          {settings?.hero_title ?? "Selam Cake Shop"}
        </h1>
        <p className="mt-2 sm:mt-3 text-sm sm:text-base md:text-lg text-[#5a4a52] font-medium">{settings?.tagline ?? "Sweetness, delicately made."}</p>
      </div>
    </section>
  );
}

function CategoryPills({ categories, activeCat, setActiveCat }: any) {
  return (
    <div className="flex gap-2.5 overflow-x-auto px-4 sm:px-6 md:px-8 pt-5 pb-2 sm:flex-wrap sm:overflow-x-visible" style={{ scrollbarWidth: "none" }}>
      <style>{`div::-webkit-scrollbar{display:none}`}</style>
      {[{ id: "ALL", name: "All" }, ...categories].map((c: any) => {
        const active = activeCat === c.id;
        return (
          <button key={c.id} onClick={() => setActiveCat(c.id)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex-shrink-0 ${
              active ? "text-white shadow-[0_6px_18px_-4px_#f5c1c8] scale-[1.03]" : "bg-white text-[#8b6b73] border border-[#f0d5dc] hover:bg-[#ddf8f8]/40"
            }`}
            style={active ? { background: "linear-gradient(135deg, #f5a1ad 0%, #e88aab 100%)" } : {}}>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function MenuList({ items, activeCat, categories, onOpen }: {
  items: Product[]; activeCat: string; categories: any[]; onOpen: (p: Product) => void;
}) {
  let lastCat: string | null = null;
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Other";

  return (
    <div className="px-4 sm:px-6 md:px-8 pt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
      {items.map((item, i) => {
        const showHeading = activeCat === "ALL" && item.category_id !== lastCat;
        if (showHeading) lastCat = item.category_id;
        const url = item.image_display_url ?? fallbackFor(item);

        const soldOut = !item.available;
        return (
          <div key={item.id} className="contents">
            {showHeading && (
              <div className="col-span-2 sm:col-span-3 lg:col-span-4 flex items-center gap-2 pt-4 pb-1 text-xs font-bold uppercase tracking-[1.5px] text-[#8b6b73]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f5a1ad]" />
                {catName(item.category_id)}
              </div>
            )}
            <article
              onClick={() => !soldOut && onOpen(item)}
              aria-disabled={soldOut}
              className={`group bg-white rounded-3xl p-2.5 border border-[#f0d5dc] transition-all duration-300 animate-fade-up ${
                soldOut
                  ? "opacity-60 cursor-not-allowed grayscale-[0.4]"
                  : "cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-10px_rgba(233,30,99,0.15)] hover:border-[#f5a1ad]/40"
              }`}
              style={{ animationDelay: `${i * 0.04}s`, animationFillMode: "both" }}>
              <div className="relative overflow-hidden rounded-2xl aspect-square">
                <img src={url} alt={item.name} loading="lazy" className={`w-full h-full object-cover transition-transform duration-500 ${!soldOut && "group-hover:scale-105"}`} />
                {soldOut && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <span className="px-3 py-1.5 rounded-md text-[11px] font-extrabold tracking-[1.5px] text-white bg-red-600 shadow-lg">
                      SOLD OUT
                    </span>
                  </div>
                )}
                {!soldOut && item.featured && (
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-[1px] text-white backdrop-blur-sm" style={{ background: "linear-gradient(135deg, #f5a1ad, #e88aab)" }}>
                    FEATURED
                  </span>
                )}
                {!soldOut && !item.featured && (
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold text-[#2d2029] bg-white/85 backdrop-blur-sm">
                    {item.price}
                  </span>
                )}
              </div>
              <div className="px-1 pt-3 pb-1 flex flex-col">
                <div className="text-[14px] font-bold leading-tight text-[#2d2029] line-clamp-2">
                  {item.name}
                </div>
                <div className="text-[11px] text-[#8b6b73] mt-1.5 leading-snug line-clamp-2">{item.description}</div>
                <div className="mt-2.5 flex items-center justify-between">
                  <div className="text-[15px] font-extrabold text-[#2d2029]">
                    <span className="text-[11px] font-bold text-[#8b6b73] mr-1">Birr</span>{item.price}
                  </div>
                  {soldOut ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Unavailable</span>
                  ) : (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm shadow-[0_6px_14px_-4px_#f5c1c8] group-hover:scale-110 transition-transform" style={{ background: "linear-gradient(135deg, #f5a1ad, #e88aab)" }}>
                      →
                    </span>
                  )}
                </div>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}

function NavIcon({ name }: { name: "pay" | "home" | "info" }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "pay") return (<svg {...common}><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></svg>);
  if (name === "home") return (<svg {...common}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>);
  return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/></svg>);
}



function ModalShell({ children, onClose }: any) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onEsc); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-up" style={{ animationDuration: "0.25s" }}>
      <div className="w-full sm:max-w-[560px] md:max-w-[640px] sm:mb-6 bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#f0d5dc] shadow-[0_-8px_40px_rgba(233,30,99,0.15)] max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function PaymentModal({ methods, onClose, onCopy }: any) {
  const enabled = methods.filter((m: any) => m.enabled);
  return (
    <ModalShell onClose={onClose}>
      <div className="p-7 pb-10 relative">
        <button onClick={onClose} aria-label="Close" className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#f8e1e7] hover:bg-[#f5a1ad] hover:text-white text-[#8b6b73] flex items-center justify-center">×</button>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-[#fadadd]/50 border border-[#f5a1ad]/30 text-[#e88aab]">
          <NavIcon name="pay" />
        </div>
        <h2 className="font-display text-2xl font-bold text-[#2d2029]">Payment Information</h2>
        <p className="text-sm text-[#8b6b73] mt-1.5 mb-6 leading-relaxed">Accepted payment methods for your order</p>
        <div className="space-y-3">
          {enabled.map((m: any) => (
            <button key={m.id}
              onClick={() => m.account_number && onCopy(m.account_number, m.name)}
              disabled={!m.account_number}
              className="w-full flex items-center justify-between gap-3 bg-[#fef5f7] hover:bg-[#ddf8f8]/40 border border-transparent hover:border-[#f5a1ad]/30 rounded-2xl p-4 transition-all text-left disabled:hover:bg-[#fef5f7]">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#2d2029] truncate">{m.name}</div>
                <div className="text-xs text-[#8b6b73] truncate">
                  {m.account_name}{m.account_number && ` · ${m.account_number}`}
                </div>
              </div>
              {m.account_number && <span className="text-[11px] font-bold uppercase tracking-wider text-[#e88aab] shrink-0">Copy</span>}
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

function AboutModal({ settings, onClose }: any) {
  const s = settings ?? {};
  const phoneClean = (s.whatsapp || s.phone || "").replace(/[^\d]/g, "");
  const socials = [
    { key: "facebook_url", label: "Facebook" },
    { key: "instagram_url", label: "Instagram" },
    { key: "tiktok_url", label: "TikTok" },
    { key: "telegram_url", label: "Telegram" },
  ].filter((sc) => s[sc.key]);

  return (
    <ModalShell onClose={onClose}>
      <div className="p-7 pb-10 relative">
        <button onClick={onClose} aria-label="Close" className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#f8e1e7] hover:bg-[#f5a1ad] hover:text-white text-[#8b6b73] flex items-center justify-center">×</button>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-white border border-[#f0d5dc] overflow-hidden">
          <img src={LOGO_URL} alt="" className="w-10 h-10" />
        </div>
        <h2 className="font-display text-2xl font-bold text-[#2d2029]">About {s.shop_name ?? "Selam"}</h2>
        <p className="text-sm text-[#8b6b73] mt-1.5 mb-6 leading-relaxed">{s.about_text}</p>
        <div className="space-y-3">
          {s.address && <Row label="Address" text={s.address} />}
          {s.phone && <Row label="Phone" text={s.phone} href={`tel:${s.phone}`} />}
          {s.email && <Row label="Email" text={s.email} href={`mailto:${s.email}`} />}
          {s.working_hours && <Row label="Hours" text={s.working_hours} />}
          {phoneClean && <Row label="WhatsApp" text={s.whatsapp ?? s.phone} href={`https://wa.me/${phoneClean}`} />}
          {socials.map((sc) => <Row key={sc.key} label={sc.label} text={sc.label} href={s[sc.key]} />)}
        </div>
        {(() => {
          const embed = buildMapEmbed(s.maps_url, s.address);
          if (!embed) return null;
          return (
            <div className="mt-5 rounded-2xl overflow-hidden h-48 border border-[#f0d5dc]">
              <iframe title="Location" src={embed} width="100%" height="100%" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
            </div>
          );
        })()}
        {s.maps_url && (
          <a href={s.maps_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-bold uppercase tracking-wider text-[#e88aab] hover:underline">Open in Google Maps →</a>
        )}

      </div>
    </ModalShell>
  );
}

function Row({ label, text, href }: { label: string; text: string; href?: string }) {
  const inner = (
    <div className="flex items-center justify-between gap-3 bg-[#fef5f7] hover:bg-[#ddf8f8]/40 rounded-2xl p-4 transition-colors">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b6b73] shrink-0">{label}</span>
      <span className="text-sm font-medium text-[#2d2029] truncate text-right">{text}</span>
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer" className="block">{inner}</a> : <div>{inner}</div>;
}

function ItemModal({ item, onClose }: { item: Product; onClose: () => void }) {
  const url = item.image_display_url ?? fallbackFor(item);

  const soldOut = !item.available;
  return (
    <ModalShell onClose={onClose}>
      <div className="relative">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm">×</button>
        <div className="relative">
          <img src={url} alt={item.name} className={`w-full h-64 sm:h-80 md:h-96 object-cover ${soldOut ? "grayscale-[0.5] opacity-80" : ""}`} />
          {soldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="px-4 py-2 rounded-lg text-sm font-extrabold tracking-[2px] text-white bg-red-600 shadow-lg">SOLD OUT</span>
            </div>
          )}
        </div>
        <div className="p-7 pb-10">
          <h2 className="font-display text-2xl font-bold text-[#2d2029]">{item.name}</h2>
          <p className="text-[15px] text-[#8b6b73] mt-2.5 mb-5 leading-relaxed">{item.description}</p>
          <div className="flex items-center justify-between gap-4">
            <div className="font-display text-3xl font-extrabold" style={{ color: soldOut ? "#8b6b73" : "#e88aab" }}>
              {item.price} <span className="text-base font-bold text-[#8b6b73]">Birr</span>
            </div>
            {soldOut && (
              <span className="px-3 py-1.5 rounded-md text-[11px] font-extrabold tracking-[1.5px] text-white bg-red-600">SOLD OUT</span>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function Toast({ msg }: { msg: string | null }) {
  return (
    <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-full text-white font-bold text-sm flex items-center gap-2 shadow-[0_12px_28px_-6px_rgba(233,30,99,0.5)] transition-all duration-300 ${
      msg ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
    }`} style={{ background: "linear-gradient(135deg, #f5a1ad 0%, #e88aab 100%)" }}>
      <span>{msg}</span>
    </div>
  );
}
