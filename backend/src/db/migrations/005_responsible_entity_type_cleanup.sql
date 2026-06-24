-- Normalize older seed/demo entity type values to the managed vocabulary.

UPDATE responsible_entities SET type = 'utility_company' WHERE type = 'company';
UPDATE responsible_entities SET type = 'municipal_department' WHERE type = 'department';
UPDATE responsible_entities SET type = 'other' WHERE type = 'informal_group';
