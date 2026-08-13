// Segment dimension types available when building/editing a COA Structure.
// NATURAL_ACCOUNT is excluded — it is always Segment 1 and cannot be re-added.
export const OPTIONAL_DIMENSION_TYPES = [
  'COST_CENTRE',
  'PROFIT_CENTRE',
  'PRODUCT',
  'PROJECT',
  'INTERCOMPANY',
  'CUSTOM_1',
  'CUSTOM_2',
  'CUSTOM_3',
  'CUSTOM_4',
  'CUSTOM_5',
  'CUSTOM_6',
  'CUSTOM_7',
];

const DIMENSION_TYPE_LABELS: Record<string, string> = {
  NATURAL_ACCOUNT: 'Natural Account',
  COST_CENTRE: 'Cost Centre',
  PROFIT_CENTRE: 'Profit Centre',
  PRODUCT: 'Product',
  PROJECT: 'Project',
  INTERCOMPANY: 'Intercompany',
};

export function dimensionTypeLabel(type: string): string {
  if (DIMENSION_TYPE_LABELS[type]) return DIMENSION_TYPE_LABELS[type];
  if (type.startsWith('CUSTOM_')) return `Custom ${type.split('_')[1]}`;
  return type;
}

const DIMENSION_TYPE_CODES: Record<string, string> = {
  NATURAL_ACCOUNT: 'NAT-ACCT',
  COST_CENTRE: 'COST-CTR',
  PROFIT_CENTRE: 'PROFIT-CTR',
  PRODUCT: 'PRODUCT',
  PROJECT: 'PROJECT',
  INTERCOMPANY: 'INTERCO',
};

export function autoSegmentCode(type: string): string {
  if (DIMENSION_TYPE_CODES[type]) return DIMENSION_TYPE_CODES[type];
  if (type.startsWith('CUSTOM_')) return `CUSTOM-${type.split('_')[1]}`;
  return type;
}

const DIMENSION_TYPE_BADGE_CLASSES: Record<string, string> = {
  NATURAL_ACCOUNT: 'bg-navy/10 text-navy',
  COST_CENTRE: 'bg-blue-light text-blue-dark',
  PRODUCT: 'bg-green-light text-green',
  PROFIT_CENTRE: 'bg-purple-100 text-purple-700',
  PROJECT: 'bg-amber-light text-amber',
};

export function dimensionTypeBadgeClass(type: string): string {
  return DIMENSION_TYPE_BADGE_CLASSES[type] ?? 'bg-slate-100 text-slate';
}

export function buildCombinationPreview(codes: string[], separator = '.'): string {
  return codes.map((c) => `[${c || '—'}]`).join(separator);
}
