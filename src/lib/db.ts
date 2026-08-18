// Shared client-side data helpers that read from Lovable Cloud via RLS.
import { supabase } from "@/integrations/supabase/client";

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
  visible: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string | null;
  image_url: string | null;
  image_display_url?: string | null;
  gallery: string[];
  emoji: string;
  available: boolean;
  featured: boolean;
  sort_order: number;
};


export type PaymentMethod = {
  id: string;
  name: string;
  type: "bank" | "mobile" | "cash";
  account_name: string;
  account_number: string;
  icon: string;
  qr_url: string | null;
  enabled: boolean;
  sort_order: number;
};

export type SiteSettings = {
  id: string;
  shop_name: string;
  tagline: string;
  about_text: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string | null;
  hero_display_url?: string | null;
  logo_url: string | null;

  address: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  working_hours: string | null;
  maps_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  telegram_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

export async function signImagePath(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  const { data } = await supabase.storage
    .from("product-images")
    .createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Product[];
  const signed = await Promise.all(rows.map((p) => signImagePath(p.image_url)));
  return rows.map((p, i) => ({ ...p, image_display_url: signed[i] }));
}

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PaymentMethod[];
}

export async function fetchSiteSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const s = data as SiteSettings;
  s.hero_display_url = await signImagePath(s.hero_image_url);
  return s;
}

/** Sync helper for absolute URLs; storage paths return null and callers should use *_display_url. */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return null;
}


export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return path;
}

export async function isAdmin(): Promise<boolean> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return false;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}
