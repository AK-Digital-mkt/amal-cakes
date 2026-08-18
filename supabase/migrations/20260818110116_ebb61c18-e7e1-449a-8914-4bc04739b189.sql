CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.payment_type AS ENUM ('bank', 'mobile', 'cash');

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

CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

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
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

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
  USING ((visible = true) OR app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT,
  gallery TEXT[] DEFAULT ARRAY[]::TEXT[],
  emoji TEXT DEFAULT '🍒',
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
  USING ((available = true) OR app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage products"
  ON public.products FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX products_featured_idx ON public.products(featured) WHERE featured = true;

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
  USING ((enabled = true) OR app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage payment methods"
  ON public.payment_methods FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  shop_name TEXT NOT NULL DEFAULT 'Amal Cakes & Catering',
  tagline TEXT NOT NULL DEFAULT 'Cakes & catering, crafted with love.',
  about_text TEXT NOT NULL DEFAULT 'Amal Cakes & Catering is a boutique bakery and catering house creating bold, elegant celebration cakes, pastries and full event catering.',
  hero_title TEXT NOT NULL DEFAULT 'Amal Cakes & Catering',
  hero_subtitle TEXT NOT NULL DEFAULT 'Handcrafted cakes, pastries & event catering',
  hero_image_url TEXT,
  logo_url TEXT,
  address TEXT NOT NULL DEFAULT 'Nairobi, Kenya',
  phone TEXT NOT NULL DEFAULT '+254 700 000 000',
  whatsapp TEXT DEFAULT '+254700000000',
  email TEXT DEFAULT 'hello@amalcakes.com',
  working_hours TEXT DEFAULT 'Mon–Sun · 8:00 – 21:00',
  maps_url TEXT DEFAULT 'https://www.google.com/maps?q=Nairobi,Kenya&output=embed',
  facebook_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  telegram_url TEXT,
  primary_color TEXT DEFAULT '#a8102b',
  accent_color TEXT DEFAULT '#e8556b',
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
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');
CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND app_private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.products REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.products';
  END IF;
END $$;

INSERT INTO public.site_settings (singleton) VALUES (true);

INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('Signature Cakes', 'signature', '🎂', 1),
  ('Cupcakes', 'cupcakes', '🧁', 2),
  ('Cheesecakes', 'cheesecakes', '🍰', 3),
  ('Pastries', 'pastries', '🥐', 4),
  ('Wedding Cakes', 'wedding', '💍', 5),
  ('Catering Trays', 'catering', '🍽️', 6);

WITH cat AS (SELECT id, slug FROM public.categories)
INSERT INTO public.products (name, description, price, category_id, emoji, featured, sort_order)
SELECT * FROM (VALUES
  ('Red Velvet Royale', 'Deep red velvet layers with silky cream cheese frosting.', 4500, (SELECT id FROM cat WHERE slug='signature'), '❤️', true, 1),
  ('Black Forest Classic', 'Chocolate sponge, cherries and whipped cream.', 4200, (SELECT id FROM cat WHERE slug='signature'), '🍒', true, 2),
  ('Chocolate Fudge Drip', 'Rich chocolate cake with a glossy fudge drip.', 4800, (SELECT id FROM cat WHERE slug='signature'), '🍫', true, 3),
  ('Cherry Swirl Cupcake', 'Vanilla cupcake with a crimson buttercream swirl and cherry.', 350, (SELECT id FROM cat WHERE slug='cupcakes'), '🧁', false, 1),
  ('Strawberry Cheesecake', 'Creamy baked cheesecake with strawberry glaze.', 3800, (SELECT id FROM cat WHERE slug='cheesecakes'), '🍓', true, 1),
  ('Assorted Pastry Platter', 'Croissants, danishes and mini tarts for events.', 2500, (SELECT id FROM cat WHERE slug='pastries'), '🥐', false, 1),
  ('Two-Tier Wedding Cake', 'Elegant two-tier cake finished with sugar florals.', 15000, (SELECT id FROM cat WHERE slug='wedding'), '💍', true, 1),
  ('Event Catering Tray', 'Full savoury tray catering for parties and corporate events.', 9000, (SELECT id FROM cat WHERE slug='catering'), '🍽️', false, 1)
) AS v;

INSERT INTO public.payment_methods (name, type, account_name, account_number, icon, sort_order) VALUES
  ('M-Pesa', 'mobile', 'Amal Cakes & Catering', '+254700000000', '📱', 1),
  ('Bank Transfer', 'bank', 'Amal Cakes & Catering', '0100000000000', '🏦', 2),
  ('Cash on Delivery', 'cash', '', '', '💵', 3);