-- Migration: Deprecated Statuses ENVOYEE -> SOUMISE, TRANSFORMEE -> EN_COURS_COMMANDE
-- Date: 2026-01-12
-- Description: Migrate existing data from deprecated statuses to new statuses

-- Migrate ENVOYEE to SOUMISE
UPDATE demandes_approvisionnement_mp 
SET status = 'SOUMISE' 
WHERE status = 'ENVOYEE';

-- Migrate TRANSFORMEE to EN_COURS_COMMANDE
UPDATE demandes_approvisionnement_mp 
SET status = 'EN_COURS_COMMANDE' 
WHERE status = 'TRANSFORMEE';

-- Verify migration
SELECT status, COUNT(*) as count 
FROM demandes_approvisionnement_mp 
GROUP BY status;
