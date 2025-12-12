/**
 * CaseCompass Taxonomy Integration
 *
 * Based on the House Digital Service CaseCompass taxonomy:
 * https://github.com/usgpo/innovation/blob/master/resources/CaseCompass/CaseCompassTaxonomy.json
 *
 * This implements recommendation #172 from the Select Committee on the
 * Modernization of Congress for standardized casework categorization.
 */

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

// Simplified taxonomy structure for the most common casework categories
// This is a curated subset of the full CaseCompass taxonomy focused on
// the most frequently encountered cases in congressional offices
export const CASECOMPASS_CATEGORIES: TaxonomyNode[] = [
  {
    label_id: "DHS1",
    name: "Department of Homeland Security (DHS)",
    tier: 1,
    abbreviation: "DHS",
    children: [
      {
        label_id: "USCIS2",
        name: "US Citizenship and Immigration Services (USCIS)",
        tier: 2,
        children: [
          {
            label_id: "ASY3",
            name: "Asylum",
            tier: 3,
            children: [
              { label_id: "AINT4", name: "Interview capacity", tier: 4, description: "USCIS asylum interview scheduling and capacity issues" },
              { label_id: "ANDT4", name: "Non-detained", tier: 4, description: "Asylum seekers not in detention" },
              { label_id: "APRO4", name: "Approval", tier: 4, description: "Asylum application approvals" },
              { label_id: "AWRK4", name: "Work authorization", tier: 4, description: "Employment authorization for asylum seekers" },
            ]
          },
          {
            label_id: "CITZ3",
            name: "Citizenship/Naturalization",
            tier: 3,
            children: [
              { label_id: "N4004", name: "N-400", tier: 4, description: "Application for naturalization" },
              { label_id: "OATH4", name: "Oath ceremonies", tier: 4, description: "Naturalization oath ceremony scheduling" },
              { label_id: "CERT4", name: "Certificate of Citizenship", tier: 4, description: "N-600 citizenship certificate applications" },
            ]
          },
          {
            label_id: "VISA3",
            name: "Visa Processing",
            tier: 3,
            children: [
              { label_id: "IR14", name: "IR-1 Spouse Visa", tier: 4, description: "Immediate relative spouse visa" },
              { label_id: "K1V4", name: "K-1 Fiance Visa", tier: 4, description: "Fiance/fiancee visa" },
              { label_id: "PTVS4", name: "Petition Processing", tier: 4, description: "Immigrant petition processing delays" },
              { label_id: "FMLY4", name: "Family-based", tier: 4, description: "Family preference visa categories" },
            ]
          },
          {
            label_id: "EAD3",
            name: "Employment Authorization",
            tier: 3,
            children: [
              { label_id: "EADI4", name: "Initial EAD", tier: 4, description: "Initial employment authorization document" },
              { label_id: "EADR4", name: "EAD Renewal", tier: 4, description: "Employment authorization renewal" },
            ]
          },
          {
            label_id: "GC3",
            name: "Green Card",
            tier: 3,
            children: [
              { label_id: "I4854", name: "I-485 Adjustment", tier: 4, description: "Adjustment of status applications" },
              { label_id: "GCRD4", name: "Green Card Renewal", tier: 4, description: "Permanent resident card renewal" },
              { label_id: "GCRC4", name: "Green Card Replacement", tier: 4, description: "Lost/stolen green card replacement" },
            ]
          },
        ]
      },
      {
        label_id: "CBP2",
        name: "Customs and Border Protection (CBP)",
        tier: 2,
        children: [
          {
            label_id: "TTP3",
            name: "Trusted Traveler Program",
            tier: 3,
            children: [
              { label_id: "GLBL4", name: "Global Entry", tier: 4, description: "Global Entry application and renewal" },
              { label_id: "NEXUS4", name: "NEXUS", tier: 4, description: "US-Canada expedited travel program" },
              { label_id: "SENTRI4", name: "SENTRI", tier: 4, description: "US-Mexico expedited travel program" },
            ]
          },
          {
            label_id: "ADM3",
            name: "Admissibility Issues",
            tier: 3,
            children: [
              { label_id: "DENY4", name: "Denied Entry", tier: 4, description: "Entry denial at port of entry" },
              { label_id: "ESTA4", name: "ESTA", tier: 4, description: "Electronic System for Travel Authorization issues" },
            ]
          },
        ]
      },
      {
        label_id: "ICE2",
        name: "US Immigration and Customs Enforcement (ICE)",
        tier: 2,
        children: [
          {
            label_id: "ENF3",
            name: "Enforcement",
            tier: 3,
            children: [
              { label_id: "DETD4", name: "Detained", tier: 4, description: "Immigration detention cases" },
              { label_id: "REMV4", name: "Removals", tier: 4, description: "Removal/deportation proceedings" },
              { label_id: "PRLE4", name: "Humanitarian Parole", tier: 4, description: "Humanitarian parole applications" },
            ]
          },
        ]
      },
      {
        label_id: "TSA2",
        name: "Transportation Security Administration (TSA)",
        tier: 2,
        children: [
          { label_id: "PRE3", name: "TSA PreCheck", tier: 3, description: "TSA PreCheck application and renewal" },
          { label_id: "TRIP3", name: "DHS TRIP", tier: 3, description: "Traveler Redress Inquiry Program" },
        ]
      },
      {
        label_id: "FEMA",
        name: "FEMA",
        tier: 2,
        children: [
          { label_id: "FEMA4", name: "Disaster Relief", tier: 3, description: "FEMA disaster assistance applications" },
        ]
      },
    ]
  },
  {
    label_id: "VA1",
    name: "Department of Veterans Affairs (VA)",
    tier: 1,
    abbreviation: "VA",
    children: [
      {
        label_id: "VBA2",
        name: "Veterans Benefits Administration (VBA)",
        tier: 2,
        children: [
          {
            label_id: "COMP3",
            name: "Compensation",
            tier: 3,
            children: [
              { label_id: "DISC4", name: "Disability Claims", tier: 4, description: "Service-connected disability compensation" },
              { label_id: "INCR4", name: "Increase Claims", tier: 4, description: "Claims for increased disability rating" },
              { label_id: "APPL4", name: "Appeals", tier: 4, description: "VA disability appeal process" },
            ]
          },
          {
            label_id: "PENS3",
            name: "Pension",
            tier: 3,
            children: [
              { label_id: "WPEN4", name: "Wartime Pension", tier: 4, description: "VA pension for wartime veterans" },
              { label_id: "APEN4", name: "Aid & Attendance", tier: 4, description: "Aid and Attendance benefits" },
            ]
          },
          {
            label_id: "EDUC3",
            name: "Education Benefits",
            tier: 3,
            children: [
              { label_id: "GIBL4", name: "GI Bill", tier: 4, description: "Post-9/11 GI Bill and other education benefits" },
              { label_id: "VREA4", name: "VR&E", tier: 4, description: "Vocational Rehabilitation & Employment" },
            ]
          },
        ]
      },
      {
        label_id: "VHA2",
        name: "Veterans Health Administration (VHA)",
        tier: 2,
        children: [
          { label_id: "ENRL3", name: "Enrollment", tier: 3, description: "VA health care enrollment" },
          { label_id: "APPT3", name: "Appointments", tier: 3, description: "VA medical appointment scheduling" },
          { label_id: "COMM3", name: "Community Care", tier: 3, description: "VA community care referrals" },
        ]
      },
      {
        label_id: "NCA2",
        name: "National Cemetery Administration",
        tier: 2,
        children: [
          { label_id: "BURL3", name: "Burial Benefits", tier: 3, description: "Burial and memorial benefits" },
          { label_id: "HEAD3", name: "Headstones/Markers", tier: 3, description: "Government headstones and markers" },
        ]
      },
    ]
  },
  {
    label_id: "SSA1",
    name: "Social Security Administration (SSA)",
    tier: 1,
    abbreviation: "SSA",
    children: [
      {
        label_id: "RTRM2",
        name: "Retirement",
        tier: 2,
        children: [
          { label_id: "RTAP3", name: "Applications", tier: 3, description: "Social Security retirement applications" },
          { label_id: "RTPY3", name: "Payments", tier: 3, description: "Retirement benefit payment issues" },
        ]
      },
      {
        label_id: "DISA2",
        name: "Disability",
        tier: 2,
        children: [
          { label_id: "SSDI3", name: "SSDI", tier: 3, description: "Social Security Disability Insurance" },
          { label_id: "SSIP3", name: "SSI", tier: 3, description: "Supplemental Security Income" },
          { label_id: "APEL3", name: "Appeals", tier: 3, description: "Disability determination appeals" },
        ]
      },
      {
        label_id: "MEDI2",
        name: "Medicare",
        tier: 2,
        children: [
          { label_id: "MEDA3", name: "Medicare Part A", tier: 3, description: "Hospital insurance" },
          { label_id: "MEDB3", name: "Medicare Part B", tier: 3, description: "Medical insurance enrollment" },
          { label_id: "MEDD3", name: "Medicare Part D", tier: 3, description: "Prescription drug coverage" },
        ]
      },
      {
        label_id: "CARD2",
        name: "Social Security Cards",
        tier: 2,
        children: [
          { label_id: "NEWC3", name: "New Card", tier: 3, description: "Original Social Security card" },
          { label_id: "REPC3", name: "Replacement Card", tier: 3, description: "Lost/stolen card replacement" },
          { label_id: "NAME3", name: "Name Change", tier: 3, description: "Name change on Social Security records" },
        ]
      },
    ]
  },
  {
    label_id: "DOS1",
    name: "Department of State (DOS)",
    tier: 1,
    abbreviation: "DOS",
    children: [
      {
        label_id: "PASS2",
        name: "Passport Services",
        tier: 2,
        children: [
          { label_id: "PNEW3", name: "New Passport", tier: 3, description: "First-time passport applications" },
          { label_id: "PREN3", name: "Passport Renewal", tier: 3, description: "Passport renewal processing" },
          { label_id: "PEXP3", name: "Expedited Processing", tier: 3, description: "Urgent passport requests" },
          { label_id: "PLST3", name: "Lost/Stolen Passport", tier: 3, description: "Lost or stolen passport replacement" },
        ]
      },
      {
        label_id: "CONS2",
        name: "Consular Services",
        tier: 2,
        children: [
          { label_id: "AMCZ3", name: "American Citizens Services", tier: 3, description: "Services for US citizens abroad" },
          { label_id: "NVIV3", name: "Nonimmigrant Visas", tier: 3, description: "Tourist, student, work visas" },
          { label_id: "IMMV3", name: "Immigrant Visas", tier: 3, description: "Immigrant visa processing at consulates" },
        ]
      },
    ]
  },
  {
    label_id: "IRS1",
    name: "Internal Revenue Service (IRS)",
    tier: 1,
    abbreviation: "IRS",
    children: [
      {
        label_id: "RFND2",
        name: "Refunds",
        tier: 2,
        children: [
          { label_id: "RFST3", name: "Refund Status", tier: 3, description: "Tax refund status inquiries" },
          { label_id: "RFDL3", name: "Refund Delays", tier: 3, description: "Delayed refund resolution" },
        ]
      },
      {
        label_id: "ACCT2",
        name: "Account Issues",
        tier: 2,
        children: [
          { label_id: "IDTH3", name: "Identity Theft", tier: 3, description: "Tax-related identity theft" },
          { label_id: "LIEN3", name: "Liens/Levies", tier: 3, description: "Tax liens and levies" },
          { label_id: "INST3", name: "Installment Agreements", tier: 3, description: "Payment plan arrangements" },
        ]
      },
      {
        label_id: "STIM2",
        name: "Stimulus/Credits",
        tier: 2,
        children: [
          { label_id: "EIP3", name: "Economic Impact Payments", tier: 3, description: "Stimulus payment issues" },
          { label_id: "CTC3", name: "Child Tax Credit", tier: 3, description: "Child tax credit inquiries" },
          { label_id: "EITC3", name: "Earned Income Credit", tier: 3, description: "EITC issues" },
        ]
      },
    ]
  },
  {
    label_id: "SBA1",
    name: "Small Business Administration (SBA)",
    tier: 1,
    abbreviation: "SBA",
    children: [
      {
        label_id: "LOAN2",
        name: "Loans",
        tier: 2,
        children: [
          { label_id: "EIDL3", name: "EIDL", tier: 3, description: "Economic Injury Disaster Loans" },
          { label_id: "PPP3", name: "PPP", tier: 3, description: "Paycheck Protection Program" },
          { label_id: "7A3", name: "7(a) Loans", tier: 3, description: "SBA 7(a) loan program" },
          { label_id: "504L3", name: "504 Loans", tier: 3, description: "SBA 504 loan program" },
        ]
      },
      {
        label_id: "DISA2",
        name: "Disaster Assistance",
        tier: 2,
        children: [
          { label_id: "DBUS3", name: "Business Disaster Loans", tier: 3, description: "Disaster loans for businesses" },
          { label_id: "DHOM3", name: "Home Disaster Loans", tier: 3, description: "Disaster loans for homeowners" },
        ]
      },
    ]
  },
  {
    label_id: "HUD1",
    name: "Department of Housing and Urban Development (HUD)",
    tier: 1,
    abbreviation: "HUD",
    children: [
      {
        label_id: "FHEO2",
        name: "Fair Housing",
        tier: 2,
        children: [
          { label_id: "DISC3", name: "Discrimination Complaints", tier: 3, description: "Housing discrimination complaints" },
          { label_id: "REAS3", name: "Reasonable Accommodation", tier: 3, description: "Disability accommodation requests" },
        ]
      },
      {
        label_id: "FHA2",
        name: "FHA",
        tier: 2,
        children: [
          { label_id: "FHAL3", name: "FHA Loans", tier: 3, description: "FHA mortgage issues" },
          { label_id: "RVMG3", name: "Reverse Mortgages", tier: 3, description: "HECM/reverse mortgage issues" },
        ]
      },
      {
        label_id: "HSNG2",
        name: "Public Housing",
        tier: 2,
        children: [
          { label_id: "S8V3", name: "Section 8 Vouchers", tier: 3, description: "Housing choice voucher program" },
          { label_id: "PHWL3", name: "Waitlist", tier: 3, description: "Public housing waitlist" },
        ]
      },
    ]
  },
  {
    label_id: "DOD1",
    name: "Department of Defense (DOD)",
    tier: 1,
    abbreviation: "DOD",
    children: [
      {
        label_id: "MPER2",
        name: "Military Personnel",
        tier: 2,
        children: [
          { label_id: "RCDS3", name: "Service Records", tier: 3, description: "Military service record requests" },
          { label_id: "DD2143", name: "DD-214", tier: 3, description: "Discharge document requests" },
          { label_id: "DCHR3", name: "Discharge Upgrade", tier: 3, description: "Military discharge upgrades" },
        ]
      },
      {
        label_id: "DFAS2",
        name: "DFAS",
        tier: 2,
        children: [
          { label_id: "MPAY3", name: "Military Pay", tier: 3, description: "Active duty pay issues" },
          { label_id: "RPAY3", name: "Retired Pay", tier: 3, description: "Military retirement pay" },
        ]
      },
      {
        label_id: "TRIC2",
        name: "TRICARE",
        tier: 2,
        children: [
          { label_id: "TENR3", name: "Enrollment", tier: 3, description: "TRICARE enrollment issues" },
          { label_id: "TCLM3", name: "Claims", tier: 3, description: "TRICARE claims and coverage" },
        ]
      },
    ]
  },
  {
    label_id: "ED1",
    name: "Department of Education (ED)",
    tier: 1,
    abbreviation: "ED",
    children: [
      {
        label_id: "FSA2",
        name: "Federal Student Aid",
        tier: 2,
        children: [
          { label_id: "FAFSA3", name: "FAFSA", tier: 3, description: "FAFSA application issues" },
          { label_id: "SLRP3", name: "Loan Repayment", tier: 3, description: "Student loan repayment" },
          { label_id: "PSLF3", name: "PSLF", tier: 3, description: "Public Service Loan Forgiveness" },
          { label_id: "IDR3", name: "IDR Plans", tier: 3, description: "Income-driven repayment plans" },
          { label_id: "FORG3", name: "Loan Forgiveness", tier: 3, description: "Student loan forgiveness programs" },
        ]
      },
    ]
  },
  {
    label_id: "CFPB1",
    name: "Consumer Financial Protection Bureau (CFPB)",
    tier: 1,
    abbreviation: "CFPB",
    children: [
      {
        label_id: "BANK3",
        name: "Banks",
        tier: 2,
        children: [
          { label_id: "CRED4", name: "Credit Cards", tier: 3, description: "Credit card issues" },
        ]
      },
      { label_id: "CRED3", name: "Credit Bureaus", tier: 2, description: "Credit reporting issues" },
      { label_id: "DEBT3", name: "Debt Collection", tier: 2, description: "Debt collection complaints" },
      { label_id: "MORT3", name: "Mortgages", tier: 2, description: "Mortgage servicing issues" },
    ]
  },
];

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
    const currentPath = [...path, node.name];
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
  const flat = flattenTaxonomy(CASECOMPASS_CATEGORIES);
  return flat.find(c => c.label_id === labelId);
}

/**
 * Generate taxonomy context for AI classification
 */
export function generateTaxonomyContext(): string {
  const flat = flattenTaxonomy(CASECOMPASS_CATEGORIES);
  const lines: string[] = [
    "CaseCompass Taxonomy Categories (House Digital Service standard):\n",
  ];

  for (const cat of flat) {
    const indent = "  ".repeat(cat.tier - 1);
    const desc = cat.description ? ` - ${cat.description}` : "";
    lines.push(`${indent}[${cat.label_id}] ${cat.name}${desc}`);
  }

  return lines.join("\n");
}

// Pre-computed flattened categories for quick lookup
export const FLATTENED_CATEGORIES = flattenTaxonomy(CASECOMPASS_CATEGORIES);
