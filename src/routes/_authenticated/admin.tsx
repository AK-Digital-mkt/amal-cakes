import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/db";
import logoAsset from "@/assets/logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const nav: { to: string; label: string; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/payments", label: "Payments" },
  { to: "/admin/settings", label: "Site Settings" },
];

const LOGO_URL = logoAsset.url;

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [mobileNav, setMobileNav] = useState(false);

  const { data: admin, isLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: isAdmin,
  });

  useEffect(() => setMobileNav(false), [location.pathname]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fef5f7]">
        <div className="text-[#8b6b73]">Loading…</div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #ffffff, #fef5f7)" }}>
        <div className="max-w-md text-center bg-white rounded-3xl p-8 shadow-[var(--shadow-soft)] border border-[#f0d5dc]">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#fadadd]/60 flex items-center justify-center mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#e88aab]"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-[#2d2029]">Access denied</h1>
          <p className="mt-2 text-sm text-[#8b6b73]">
            You are signed in, but this account isn't an admin. Ask the shop owner to grant you access.
          </p>
          <div className="mt-6 flex gap-2 justify-center">
            <button onClick={handleSignOut} className="btn-secondary text-sm">Sign out</button>
            <Link to="/" className="btn-primary text-sm">Back to shop</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf5f6] flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-[#f0d5dc] p-6">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <img src={LOGO_URL} alt="" className="w-8 h-8 rounded" />
          <span className="font-display text-xl font-semibold text-[#2d2029]">Selam Admin</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to as any}
              activeOptions={n.exact ? { exact: true } : undefined}
              activeProps={{ className: "bg-gradient-to-r from-[#fadadd] to-[#ddf8f8] text-[#2d2029] font-semibold" }}
              inactiveProps={{ className: "text-[#8b6b73] hover:bg-[#fef5f7]" }}
              className="block px-4 py-2.5 rounded-2xl transition-colors text-sm"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <button onClick={handleSignOut} className="mt-4 btn-secondary text-sm w-full">Sign out</button>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 bg-white/90 backdrop-blur border-b border-[#f0d5dc] px-4 h-16 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <img src={LOGO_URL} alt="" className="w-7 h-7 shrink-0 rounded" />
          <span className="font-display text-lg font-semibold truncate">Selam Admin</span>
        </Link>
        <button onClick={() => setMobileNav(!mobileNav)} className="w-10 h-10 shrink-0 rounded-xl bg-[#fadadd]/40 flex items-center justify-center text-lg" aria-label="Menu">
          {mobileNav ? "×" : "☰"}
        </button>
      </header>
      {mobileNav && (
        <div className="lg:hidden fixed top-16 inset-x-0 z-30 bg-white border-b border-[#f0d5dc] p-4 space-y-1 animate-fade-up">
          {nav.map((n) => (
            <Link key={n.to} to={n.to as any} activeOptions={n.exact ? { exact: true } : undefined}
              activeProps={{ className: "bg-[#fadadd]/50 font-semibold" }}
              className="block px-4 py-2.5 rounded-2xl text-[#2d2029] text-sm">
              {n.label}
            </Link>
          ))}
          <button onClick={handleSignOut} className="w-full text-left block px-4 py-2.5 rounded-2xl text-[#8b6b73] text-sm">
            Sign out
          </button>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 lg:ml-64 pt-20 lg:pt-0 pb-10 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto py-6 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
