-- Lista "lista para mudarte" dentro de cada solicitud (RF-31). No guarda documentos, solo el avance.
CREATE TABLE booking_steps (
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  step text NOT NULL CHECK (step IN ('passport','offer_letter','guarantee','contract_read','deposit_receipt')),
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, step)
);
ALTER TABLE booking_steps ENABLE ROW LEVEL SECURITY;
