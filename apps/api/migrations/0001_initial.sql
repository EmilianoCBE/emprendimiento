-- Esquema inicial de Aterriza. Ver docs/06-base-de-datos.md.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('student','mentor','landlord','admin')),
  home_country text,
  student_status text NOT NULL DEFAULT 'none' CHECK (student_status IN ('none','pending','verified','rejected')),
  matricula text,
  email_verified_at timestamptz,
  failed_logins int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE UNIQUE INDEX users_matricula_unique ON users (matricula) WHERE matricula IS NOT NULL AND student_status <> 'rejected';

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expires ON sessions (expires_at);

CREATE TABLE one_time_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX one_time_codes_lookup ON one_time_codes (user_id, purpose, created_at DESC);

CREATE TABLE student_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('institutional_email','manual')),
  matricula text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_verifications_status ON student_verifications (status, created_at);

CREATE TABLE zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  transit_note text NOT NULL,
  life_note text NOT NULL
);

CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES users(id),
  zone_id uuid NOT NULL REFERENCES zones(id),
  title text NOT NULL,
  description text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('room','studio','apartment','residence')),
  monthly_rent_mxn int NOT NULL CHECK (monthly_rent_mxn > 0),
  deposit_months double precision NOT NULL DEFAULT 1 CHECK (deposit_months >= 0),
  min_months int NOT NULL DEFAULT 5 CHECK (min_months > 0),
  semester_contract boolean NOT NULL DEFAULT true,
  minutes_walk int NOT NULL CHECK (minutes_walk >= 0),
  minutes_transit int NOT NULL CHECK (minutes_transit >= 0),
  furnished boolean NOT NULL DEFAULT false,
  utilities_included boolean NOT NULL DEFAULT false,
  air_conditioning boolean NOT NULL DEFAULT false,
  approx_lat double precision NOT NULL,
  approx_lng double precision NOT NULL,
  exact_address text NOT NULL,
  available_from date NOT NULL,
  occupied_until date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','active','under_review','archived')),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listings_status_rent ON listings (status, monthly_rent_mxn);
CREATE INDEX listings_zone_status ON listings (zone_id, status);
CREATE INDEX listings_landlord ON listings (landlord_id);

CREATE TABLE listing_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text NOT NULL,
  position int NOT NULL DEFAULT 0
);
CREATE INDEX listing_photos_listing ON listing_photos (listing_id, position);

CREATE TABLE listing_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  label text NOT NULL,
  included boolean NOT NULL,
  estimate_mxn int
);
CREATE INDEX listing_cost_items_listing ON listing_cost_items (listing_id);

CREATE TABLE listing_criteria (
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  criterion text NOT NULL CHECK (criterion IN ('ownership_docs','landlord_identity','model_contract','dated_photos')),
  met boolean NOT NULL DEFAULT false,
  checked_by uuid REFERENCES users(id),
  checked_at timestamptz,
  PRIMARY KEY (listing_id, criterion)
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id),
  student_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('requested','tour_scheduled','accepted','confirmed','completed','rejected','cancelled')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  message text NOT NULL,
  tour_at timestamptz,
  fraud_notice_ack_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);
CREATE UNIQUE INDEX bookings_one_active ON bookings (student_id, listing_id)
  WHERE status IN ('requested','tour_scheduled','accepted','confirmed');
CREATE INDEX bookings_student ON bookings (student_id, status);
CREATE INDEX bookings_listing ON bookings (listing_id, status);

CREATE TABLE booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id),
  from_status text,
  to_status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_events_booking ON booking_events (booking_id, created_at);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
  author_id uuid NOT NULL REFERENCES users(id),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL,
  stay_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_listing ON reviews (listing_id, created_at DESC);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id),
  reporter_id uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL CHECK (reason IN ('fake_listing','asked_prepayment','changed_conditions','no_receipt','other')),
  detail text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','upheld')),
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, reporter_id)
);
CREATE INDEX reports_status ON reports (status, created_at);

CREATE TABLE mentor_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('local','ex_exchange')),
  university text NOT NULL,
  headline text NOT NULL,
  bio text NOT NULL,
  languages text[] NOT NULL DEFAULT '{}',
  topics text[] NOT NULL DEFAULT '{}',
  zone_id uuid REFERENCES zones(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  accepting boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mentor_profiles_status ON mentor_profiles (status);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('mentor','booking')),
  student_id uuid NOT NULL REFERENCES users(id),
  counterpart_id uuid NOT NULL REFERENCES users(id),
  booking_id uuid REFERENCES bookings(id),
  status text NOT NULL CHECK (status IN ('pending','active','declined','closed')),
  intro text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX conversations_one_mentor ON conversations (student_id, counterpart_id)
  WHERE kind = 'mentor' AND status IN ('pending','active');
CREATE UNIQUE INDEX conversations_one_booking ON conversations (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX conversations_student ON conversations (student_id);
CREATE INDEX conversations_counterpart ON conversations (counterpart_id);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  risk_flags text[] NOT NULL DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation ON messages (conversation_id, created_at);

CREATE TABLE cost_assumptions (
  key text PRIMARY KEY,
  amount_mxn int NOT NULL CHECK (amount_mxn >= 0),
  label text NOT NULL,
  note text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  body text NOT NULL,
  reviewed_on date NOT NULL,
  position int NOT NULL DEFAULT 0
);

CREATE TABLE checklist_tasks (
  id text PRIMARY KEY,
  phase text NOT NULL CHECK (phase IN ('before','week1')),
  title text NOT NULL,
  hint text NOT NULL,
  position int NOT NULL
);

CREATE TABLE checklist_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id text NOT NULL REFERENCES checklist_tasks(id) ON DELETE CASCADE,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON notifications (user_id, created_at DESC);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created ON audit_log (created_at DESC);

-- Defensa en profundidad: la API automática de Supabase (PostgREST) expone el
-- esquema public. RLS sin políticas la deja sin acceso. La API propia se conecta
-- como dueña de las tablas, a la que no le aplica RLS.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
