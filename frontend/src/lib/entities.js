export const ENTITY_TYPES = ['municipal_department', 'utility_company', 'contractor', 'ngo', 'other'];

export const ENTITY_TYPE_LABELS = {
  municipal_department: 'Municipal Department',
  utility_company: 'Utility Company',
  contractor: 'Contractor',
  ngo: 'NGO',
  other: 'Other',
  company: 'Utility Company',
  department: 'Municipal Department',
  informal_group: 'Other',
};

export const entityTypeLabel = (type) => ENTITY_TYPE_LABELS[type] || type;
