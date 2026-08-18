-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.payment_type AS ENUM ('bank', 'mobile', 'cash');

-- ============================================================
-- USER ROLES (separate table to prevent privilege escalation)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Auto-grant admin to the first signup (bootstrap)
-- Subsequent signups get 'user' role, admins must promote them.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INT;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Shared: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '🍰',
  sort_order INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible categories"
  ON public.categories FOR SELECT TO anon, authenticated
  USING (visible = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT,
  gallery TEXT[] DEFAULT ARRAY[]::TEXT[],
  emoji TEXT DEFAULT '🌸',
  available BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (available = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage products"
  ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX products_featured_idx ON public.products(featured) WHERE featured = true;

-- ============================================================
-- PAYMENT METHODS
-- ============================================================
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type payment_type NOT NULL DEFAULT 'bank',
  account_name TEXT DEFAULT '',
  account_number TEXT DEFAULT '',
  icon TEXT DEFAULT '🏦',
  qr_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_methods TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view enabled payment methods"
  ON public.payment_methods FOR SELECT TO anon, authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage payment methods"
  ON public.payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- SITE SETTINGS (single row)
-- ============================================================
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  shop_name TEXT NOT NULL DEFAULT 'Selam Cake Shop',
  tagline TEXT NOT NULL DEFAULT 'Sweetness, delicately made.',
  about_text TEXT NOT NULL DEFAULT 'Selam is a boutique cake atelier crafting elegant, handmade cakes and pastries.',
  hero_title TEXT NOT NULL DEFAULT 'Selam Cake Shop',
  hero_subtitle TEXT NOT NULL DEFAULT 'Handcrafted with love',
  hero_image_url TEXT,
  logo_url TEXT,
  address TEXT NOT NULL DEFAULT 'Adama, Ethiopia',
  phone TEXT NOT NULL DEFAULT '+251 921 109 307',
  whatsapp TEXT DEFAULT '+251921109307',
  email TEXT DEFAULT 'hello@selamcakes.et',
  working_hours TEXT DEFAULT 'Mon–Sun · 8:00 – 21:00',
  maps_url TEXT DEFAULT 'https://www.google.com/maps?q=Adama,Ethiopia&output=embed',
  facebook_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  telegram_url TEXT,
  primary_color TEXT DEFAULT '#f5a1ad',
  accent_color TEXT DEFAULT '#ddf8f8',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings"
  ON public.site_settings FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "Admins manage site settings"
  ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO public.site_settings (singleton) VALUES (true);

INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('Signature Cakes', 'signature', '🌸', 1),
  ('Cupcakes', 'cupcakes', '🧁', 2),
  ('Cheesecakes', 'cheesecakes', '🍰', 3),
  ('Macarons', 'macarons', '🍬', 4),
  ('Wedding Cakes', 'wedding', '💍', 5),
  ('Custom Orders', 'custom', '✨', 6);

WITH cat AS (SELECT id, slug FROM public.categories)
INSERT INTO public.products (name, description, price, category_id, emoji, featured, sort_order)
SELECT * FROM (VALUES
  ('Rose Strawberry Dream', 'Soft strawberry sponge with rose cream and fresh berries.', 1200, (SELECT id FROM cat WHERE slug='signature'), '🌸', true, 1),
  ('Vanilla Bloom', 'Two-tier vanilla cake finished with sugar florals.', 1800, (SELECT id FROM cat WHERE slug='signature'), '🤍', true, 2),
  ('Pink Drip Chocolate', 'Rich chocolate cake with pink ganache drip.', 1500, (SELECT id FROM cat WHERE slug='signature'), '🍫', true, 3),
  ('Blush Rose Cupcake', 'Vanilla cupcake topped with a pink buttercream rose.', 150, (SELECT id FROM cat WHERE slug='cupcakes'), '🧁', false, 1),
  ('Berry Cheesecake', 'Creamy cheesecake with mixed berry glaze.', 950, (SELECT id FROM cat WHERE slug='cheesecakes'), '🍰', true, 1),
  ('Mint Pearl Tower', 'Pastel macaron tower with edible pearls.', 2400, (SELECT id FROM cat WHERE slug='macarons'), '🍬', false, 1)
) AS v;

INSERT INTO public.payment_methods (name, type, account_name, account_number, icon, sort_order) VALUES
  ('CBE Birr', 'bank', 'Selam Cake Shop', '1000189273367', '🏦', 1),
  ('Awash Bank', 'bank', 'Selam Cake Shop', '01320123456789', '🏛️', 2),
  ('Bank of Abyssinia', 'bank', 'Selam Cake Shop', '12345678901234', '🏦', 3),
  ('Telebirr', 'mobile', 'Selam Cake Shop', '+251921109307', '📱', 4),
  ('Cash on Delivery', 'cash', '', '', '💵', 5);
