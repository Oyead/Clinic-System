-- Remove overlapping availability slots so the no-overlap constraint can be added.
-- Keeps the earliest-published slot (lowest id) in each overlapping group.
DELETE FROM availability_slots
WHERE status IN ('open', 'booked')
  AND id IN (
    SELECT s1.id
    FROM availability_slots s1
    JOIN availability_slots s2 ON s1.doctor_id = s2.doctor_id
    WHERE s1.id > s2.id
      AND s1.status IN ('open', 'booked')
      AND s2.status IN ('open', 'booked')
      AND tsrange(s1.starts_at, s1.starts_at + (s1.duration_minutes * INTERVAL '1 minute'), '[)')
          && tsrange(s2.starts_at, s2.starts_at + (s2.duration_minutes * INTERVAL '1 minute'), '[)')
  );

-- Prevent overlapping live availability slots for the same doctor.
DO $$ BEGIN ALTER TABLE availability_slots ADD CONSTRAINT no_slot_overlap EXCLUDE USING gist (doctor_id WITH =, tsrange(starts_at, starts_at + (duration_minutes * INTERVAL '1 minute'), '[)') WITH &&) WHERE (status IN ('open', 'booked')); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
