-- =====================================================================
-- RESET HTX — UNIFIED RLS SECURITY SCHEME (AUDITED)
-- 
-- Run this ONCE in your Supabase SQL Editor.
-- It idempotently drops + recreates every policy so it is safe to
-- re-run without side-effects.
--
-- AUDIT NOTES (what was checked):
--   • Every .from('table') call in app/actions/*, app/admin/*, 
--     app/api/*, app/events/*, app/page.tsx was traced.
--   • Each operation (SELECT / INSERT / UPDATE / DELETE) was matched
--     to the role that executes it (anon vs authenticated).
--   • Public pages (checkout, cancel, event pages, reservations)
--     run as `anon`.
--   • Admin pages (/admin/*) and server actions called from admin
--     run as `authenticated`.
--   • Stripe webhook + API routes run with no session cookie → `anon`.
--   • contact.ts uses the service_role key → bypasses RLS entirely.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES  (the "tables" table — restaurant floor plan tables)
-- 
-- Public:   SELECT (view available tables on booking page)
-- Admin:    SELECT, INSERT, UPDATE, DELETE (manage floor plan)
-- ---------------------------------------------------------------------
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public tables are viewable by everyone" ON tables;
CREATE POLICY "Public tables are viewable by everyone"
ON tables FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admin tables full access" ON tables;
CREATE POLICY "Admin tables full access"
ON tables FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 2. EVENTS
-- 
-- Public:   SELECT (event listings, checkout validation, calendar)
-- Admin:    SELECT, INSERT, UPDATE, DELETE (create/edit/delete events,
--           toggle sold-out, recurring events)
--
-- NOTE: This table previously had RLS DISABLED.  Enabling it here is
-- safe because every public codepath only does SELECT, and all
-- mutations happen from authenticated admin pages.
-- ---------------------------------------------------------------------
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to events" ON events;
CREATE POLICY "Allow public read access to events"
ON events FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated admins full access to events" ON events;
CREATE POLICY "Allow authenticated admins full access to events"
ON events FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 3. EVENT_BOOKINGS
-- 
-- Public:   SELECT (check which tables are taken)
--           INSERT (book a table — checkout.ts, event-booking.ts)
--           UPDATE (cancel a booking — cancel.ts runs as anon)
-- Admin:    SELECT, INSERT, UPDATE, DELETE (manage bookings)
-- Webhook:  (no event_bookings ops in webhook currently)
-- ---------------------------------------------------------------------
ALTER TABLE event_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public bookings are viewable by everyone" ON event_bookings;
CREATE POLICY "Public bookings are viewable by everyone"
ON event_bookings FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can insert bookings" ON event_bookings;
CREATE POLICY "Public can insert bookings"
ON event_bookings FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update bookings" ON event_bookings;
CREATE POLICY "Public can update bookings"
ON event_bookings FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admin bookings full access" ON event_bookings;
CREATE POLICY "Admin bookings full access"
ON event_bookings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 4. TICKET_PURCHASES
-- 
-- Public:   SELECT (cancel.ts looks up booking by ref + email)
--           INSERT (checkout.ts, webhook route)
--           UPDATE (cancel.ts sets status = 'cancelled')
-- Admin:    SELECT, INSERT, UPDATE, DELETE (full management)
-- ---------------------------------------------------------------------
ALTER TABLE ticket_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view ticket purchases" ON ticket_purchases;
CREATE POLICY "Public can view ticket purchases"
ON ticket_purchases FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can insert ticket purchases" ON ticket_purchases;
CREATE POLICY "Public can insert ticket purchases"
ON ticket_purchases FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update ticket purchases" ON ticket_purchases;
CREATE POLICY "Public can update ticket purchases"
ON ticket_purchases FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can manage ticket purchases" ON ticket_purchases;
CREATE POLICY "Admin can manage ticket purchases"
ON ticket_purchases FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 5. RESERVATIONS
-- 
-- Public:   SELECT (idempotency check in reservations.ts)
--           INSERT (finalizeGeneralReservation, checkout, webhook)
--           UPDATE (cancel.ts sets status = 'cancelled')
-- Admin:    SELECT, INSERT, UPDATE, DELETE (full management)
-- ---------------------------------------------------------------------
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert reservations" ON reservations;
CREATE POLICY "Public can insert reservations"
ON reservations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view reservations" ON reservations;
CREATE POLICY "Public can view reservations"
ON reservations FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can update reservations" ON reservations;
CREATE POLICY "Public can update reservations"
ON reservations FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can manage reservations" ON reservations;
CREATE POLICY "Admin can manage reservations"
ON reservations FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can delete reservations" ON reservations;
CREATE POLICY "Admin can delete reservations"
ON reservations FOR DELETE
TO authenticated
USING (true);


-- ---------------------------------------------------------------------
-- 6. CONTACT_MESSAGES
-- 
-- NOTE: contact.ts uses getSupabaseAdmin() with the SERVICE_ROLE key,
-- which bypasses RLS entirely.  These policies are a safety net only.
--
-- Public:   INSERT (submit contact form — bypassed via service role)
-- Admin:    SELECT, UPDATE (inbox page, update remarks)
-- ---------------------------------------------------------------------
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert" ON contact_messages;
CREATE POLICY "Allow public insert"
ON contact_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admins read" ON contact_messages;
DROP POLICY IF EXISTS "Allow admins update" ON contact_messages;
DROP POLICY IF EXISTS "Admin full access to contact messages" ON contact_messages;
CREATE POLICY "Admin full access to contact messages"
ON contact_messages FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 7. PROMO_CODES
-- 
-- Public:   SELECT (validatePromo in promos.ts — anon user checking code)
--           UPDATE (event-booking.ts increments times_used after booking)
-- Admin:    SELECT, INSERT, UPDATE, DELETE (create/edit/delete promos)
--
-- NOTE: This table previously had RLS DISABLED.  Enabling it here is
-- safe because public codepaths only SELECT and UPDATE (increment usage),
-- and all other mutations are from authenticated admin pages.
-- ---------------------------------------------------------------------
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public to select promo codes" ON promo_codes;
CREATE POLICY "Allow public to select promo codes"
ON promo_codes FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow public to update promo code usage" ON promo_codes;
CREATE POLICY "Allow public to update promo code usage"
ON promo_codes FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access to promo codes" ON promo_codes;
CREATE POLICY "Admin full access to promo codes"
ON promo_codes FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 8. TESTIMONIALS
-- 
-- Public:   SELECT WHERE status='approved' (homepage / reviews page)
--           INSERT (submit a new review)
-- Admin:    SELECT all, UPDATE, DELETE (approve/reject, manage reviews)
--
-- NOTE: Postgres ORs multiple SELECT policies for the same role.
-- For `authenticated`: (status='approved') OR (true) = true → sees all.
-- For `anon`: only (status='approved') applies → sees approved only.
-- ---------------------------------------------------------------------
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert reviews" ON testimonials;
CREATE POLICY "Public can insert reviews"
ON testimonials FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view approved reviews" ON testimonials;
CREATE POLICY "Public can view approved reviews"
ON testimonials FOR SELECT
TO anon, authenticated
USING (status = 'approved');

DROP POLICY IF EXISTS "Authenticated users can do everything on testimonials" ON testimonials;
CREATE POLICY "Authenticated users can do everything on testimonials"
ON testimonials FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 9. GALLERY_IMAGES
-- 
-- Public:   SELECT (gallery page)
-- Admin:    SELECT, INSERT, DELETE (upload/remove photos)
-- ---------------------------------------------------------------------
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view gallery images" ON gallery_images;
CREATE POLICY "Public can view gallery images"
ON gallery_images FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admin can manage gallery images" ON gallery_images;
CREATE POLICY "Admin can manage gallery images"
ON gallery_images FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 10. FORCE POSTGREST SCHEMA CACHE RELOAD
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
