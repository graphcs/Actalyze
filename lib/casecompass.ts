/**
 * CaseCompass Taxonomy Integration
 *
 * Uses the official House Digital Service CaseCompass taxonomy:
 * https://github.com/usgpo/innovation/blob/master/resources/CaseCompass/CaseCompassTaxonomy.json
 *
 * This implements recommendation #172 from the Select Committee on the
 * Modernization of Congress for standardized casework categorization.
 */

import taxonomyData from "../CaseCompassTaxonomy.json";

export interface TaxonomyNode {
  label_id: string;
  name: string;
  tier: number;
  description?: string;
  abbreviation?: string;
  children?: TaxonomyNode[];
}

export interface TaxonomyMetadata {
  title: string;
  description: string;
  version: string;
  modified: string;
  publisher: string;
}

export interface FlattenedCategory {
  label_id: string;
  name: string;
  tier: number;
  description?: string;
  abbreviation?: string;
  path: string[]; // Full path from tier 1 to this node
  pathIds: string[]; // Label IDs in path
  parentId?: string;
}

// Load the official taxonomy from the JSON file
const TAXONOMY_DATA = taxonomyData as {
  metadata: TaxonomyMetadata;
  data: TaxonomyNode[];
};

export const CASECOMPASS_METADATA = TAXONOMY_DATA.metadata;
export const CASECOMPASS_CATEGORIES: TaxonomyNode[] = TAXONOMY_DATA.data;

/**
 * Flatten the taxonomy tree into a searchable array
 */
export function flattenTaxonomy(
  nodes: TaxonomyNode[],
  path: string[] = [],
  pathIds: string[] = [],
  parentId?: string
): FlattenedCategory[] {
  const result: FlattenedCategory[] = [];

  for (const node of nodes) {
    const currentPath = [...path, node.abbreviation || node.name];
    const currentPathIds = [...pathIds, node.label_id];

    result.push({
      label_id: node.label_id,
      name: node.name,
      tier: node.tier,
      description: node.description,
      abbreviation: node.abbreviation,
      path: currentPath,
      pathIds: currentPathIds,
      parentId,
    });

    if (node.children) {
      result.push(
        ...flattenTaxonomy(node.children, currentPath, currentPathIds, node.label_id)
      );
    }
  }

  return result;
}

/**
 * Get all tier 1 agencies
 */
export function getTier1Agencies(): TaxonomyNode[] {
  return CASECOMPASS_CATEGORIES;
}

/**
 * Get children of a specific node
 */
export function getChildren(labelId: string, nodes: TaxonomyNode[] = CASECOMPASS_CATEGORIES): TaxonomyNode[] | undefined {
  for (const node of nodes) {
    if (node.label_id === labelId) {
      return node.children;
    }
    if (node.children) {
      const found = getChildren(labelId, node.children);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Find a node by label_id
 */
export function findNode(labelId: string, nodes: TaxonomyNode[] = CASECOMPASS_CATEGORIES): TaxonomyNode | undefined {
  for (const node of nodes) {
    if (node.label_id === labelId) {
      return node;
    }
    if (node.children) {
      const found = findNode(labelId, node.children);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Get the full path for a category
 */
export function getCategoryPath(labelId: string): FlattenedCategory | undefined {
  const flat = FLATTENED_CATEGORIES;
  return flat.find(c => c.label_id === labelId);
}

/**
 * Validate that a label_id exists in the taxonomy
 */
export function isValidLabelId(labelId: string): boolean {
  return FLATTENED_CATEGORIES.some(c => c.label_id === labelId);
}

/**
 * Get all valid label_ids for a specific tier
 */
export function getLabelIdsByTier(tier: number): string[] {
  return FLATTENED_CATEGORIES
    .filter(c => c.tier === tier)
    .map(c => c.label_id);
}

/**
 * Generate taxonomy context for AI classification
 * Returns a structured list of all categories with their label_ids
 */
export function generateTaxonomyContext(): string {
  const flat = FLATTENED_CATEGORIES;
  const lines: string[] = [
    `CaseCompass Taxonomy v${CASECOMPASS_METADATA.version} (${CASECOMPASS_METADATA.publisher})`,
    "",
    "IMPORTANT: You MUST use the exact label_id values from this taxonomy.",
    "Do NOT make up or guess label_ids. Only use IDs that appear in this list.",
    "",
    "Format: [label_id] Name (Tier X) - Description",
    "",
    "=== TIER 1 AGENCIES ===",
  ];

  // Group by tier 1 agencies for better organization
  const tier1Agencies = flat.filter(c => c.tier === 1);

  for (const agency of tier1Agencies) {
    const abbrev = agency.abbreviation ? ` (${agency.abbreviation})` : "";
    lines.push(`\n[${agency.label_id}] ${agency.name}${abbrev}`);
    if (agency.description) {
      lines.push(`  Description: ${agency.description}`);
    }

    // Add tier 2 under this agency
    const tier2 = flat.filter(c => c.tier === 2 && c.pathIds[0] === agency.label_id);
    for (const sub of tier2) {
      lines.push(`  [${sub.label_id}] ${sub.name}`);

      // Add tier 3 under this sub-agency
      const tier3 = flat.filter(c => c.tier === 3 && c.pathIds[1] === sub.label_id);
      for (const cat of tier3) {
        const desc = cat.description ? ` - ${cat.description}` : "";
        lines.push(`    [${cat.label_id}] ${cat.name}${desc}`);

        // Add tier 4 under this category
        const tier4 = flat.filter(c => c.tier === 4 && c.pathIds[2] === cat.label_id);
        for (const specific of tier4) {
          const desc4 = specific.description ? ` - ${specific.description}` : "";
          lines.push(`      [${specific.label_id}] ${specific.name}${desc4}`);
        }
      }
    }
  }

  return lines.join("\n");
}

/**
 * Generate a compact list of all label_ids for validation
 */
export function getAllLabelIds(): string[] {
  return FLATTENED_CATEGORIES.map(c => c.label_id);
}

// Pre-computed flattened categories for quick lookup
export const FLATTENED_CATEGORIES = flattenTaxonomy(CASECOMPASS_CATEGORIES);

// Export metadata version for display
export const TAXONOMY_VERSION = CASECOMPASS_METADATA.version;
