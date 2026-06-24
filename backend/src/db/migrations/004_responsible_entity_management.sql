-- Responsible Entity Management fields and production entity types.

ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'municipal_department';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'utility_company';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'contractor';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'other';

ALTER TABLE responsible_entities ADD COLUMN IF NOT EXISTS notes TEXT;
