"use client";

import { useState } from "react";
import AppLayout from "../components/AppLayout";
import { Briefcase, Search, Filter, Clock, User, Building2, FileText, Bot, ArrowRight, CheckCircle, AlertCircle, Tag, ChevronRight } from "lucide-react";

interface CaseworkRequest {
  id: string;
  caseNumber: string;
  constituentName: string;
  email: string;
  phone?: string;
  category: string;
  subcategory: string;
  subject: string;
  description: string;
  status: "new" | "in-progress" | "pending-agency" | "resolved" | "closed";
  priority: "urgent" | "high" | "medium" | "low";
  submittedAt: string;
  assignedTo?: string;
  aiSummary: string;
  aiRouting: {
    recommendedTeam: string;
    confidence: number;
    reasoning: string;
    suggestedActions: string[];
  };
  relatedAgency?: string;
  timeline?: string;
}

const SAMPLE_CASES: CaseworkRequest[] = [
  {
    id: "1",
    caseNumber: "CW-2024-001847",
    constituentName: "Maria Garcia",
    email: "mgarcia@email.com",
    phone: "(555) 234-5678",
    category: "Immigration",
    subcategory: "Visa Processing",
    subject: "Spouse Visa Delay - Over 18 Months",
    description: "My husband applied for an IR-1 spouse visa in June 2023. We have been waiting over 18 months with no update. USCIS case status shows 'Case is Being Actively Reviewed' since March 2024. We have a 2-year-old daughter who has never met her father. Please help expedite this case.",
    status: "new",
    priority: "high",
    submittedAt: "2024-12-08T10:30:00Z",
    aiSummary: "Spouse visa (IR-1) processing delay exceeding 18 months. Constituent experiencing family separation with minor child. Case stuck in review stage since March 2024.",
    aiRouting: {
      recommendedTeam: "Immigration Casework Specialist",
      confidence: 95,
      reasoning: "Clear immigration casework request involving USCIS delay. Family separation with minor child increases urgency. Standard congressional inquiry to USCIS appropriate.",
      suggestedActions: [
        "Submit Privacy Release Form G-28 if not already obtained",
        "File congressional inquiry with USCIS Congressional Liaison",
        "Request expedite based on family separation",
        "Follow up with NVC if case involves consular processing"
      ]
    },
    relatedAgency: "USCIS",
    timeline: "2-4 weeks for agency response"
  },
  {
    id: "2",
    caseNumber: "CW-2024-001848",
    constituentName: "James Wilson",
    email: "jwilson@veteranmail.org",
    phone: "(555) 345-6789",
    category: "Veterans Affairs",
    subcategory: "Disability Compensation",
    subject: "VA Disability Claim Pending 14 Months",
    description: "I filed a disability claim with the VA in October 2023 for service-connected PTSD and hearing loss. The claim has been pending for 14 months. I've called the VA hotline multiple times but keep getting told to wait. I'm struggling financially and need this resolved.",
    status: "new",
    priority: "urgent",
    submittedAt: "2024-12-08T09:15:00Z",
    aiSummary: "VA disability claim (PTSD, hearing loss) pending 14 months. Constituent reports financial hardship. Multiple unsuccessful attempts to resolve through VA hotline.",
    aiRouting: {
      recommendedTeam: "Veterans Affairs Casework Specialist",
      confidence: 98,
      reasoning: "Clear VA benefits casework. Extended processing time and financial hardship indicate urgent priority. Congressional inquiry to VA Regional Office warranted.",
      suggestedActions: [
        "Obtain signed Privacy Release Form",
        "Contact VA Regional Office Congressional Liaison",
        "Request expedited processing due to financial hardship",
        "Consider contacting local VA benefits coordinator"
      ]
    },
    relatedAgency: "Department of Veterans Affairs",
    timeline: "1-2 weeks for status update"
  },
  {
    id: "3",
    caseNumber: "CW-2024-001849",
    constituentName: "Linda Thompson",
    email: "lthompson@senior.net",
    category: "Social Security",
    subcategory: "Medicare Enrollment",
    subject: "Medicare Part B Enrollment Error",
    description: "SSA enrolled me in Medicare Part B without my consent and is now deducting premiums from my Social Security check. I have coverage through my employer and did not want Part B. I've sent three letters to SSA with no response.",
    status: "new",
    priority: "medium",
    submittedAt: "2024-12-07T14:45:00Z",
    aiSummary: "Erroneous Medicare Part B enrollment affecting constituent's Social Security benefits. Constituent has employer coverage. Multiple unanswered correspondence with SSA.",
    aiRouting: {
      recommendedTeam: "Social Security Casework Specialist",
      confidence: 92,
      reasoning: "SSA administrative issue involving incorrect Medicare enrollment. Constituent has documented employer coverage. Congressional inquiry appropriate to resolve enrollment error.",
      suggestedActions: [
        "Collect proof of employer coverage (insurance card, HR letter)",
        "Submit congressional inquiry to SSA Regional Office",
        "Request retroactive disenrollment and premium refund",
        "Document all previous correspondence attempts"
      ]
    },
    relatedAgency: "Social Security Administration",
    timeline: "2-3 weeks for resolution"
  },
  {
    id: "4",
    caseNumber: "CW-2024-001850",
    constituentName: "David Brown",
    email: "dbrown@business.com",
    phone: "(555) 456-7890",
    category: "Small Business",
    subcategory: "SBA Loan",
    subject: "EIDL Loan Reconsideration Denied",
    description: "My small restaurant was denied EIDL loan reconsideration despite providing all requested documentation. The denial letter cited 'unverifiable information' but didn't specify what. I've been in business for 15 years with clean tax records.",
    status: "in-progress",
    priority: "medium",
    submittedAt: "2024-12-06T11:20:00Z",
    assignedTo: "Sarah Miller",
    aiSummary: "SBA EIDL reconsideration denial with vague reasoning. Established 15-year business with documented tax compliance. Denial reason unclear - may be documentation or verification issue.",
    aiRouting: {
      recommendedTeam: "Economic Development Specialist",
      confidence: 85,
      reasoning: "SBA loan reconsideration case. Denial reason vague - congressional inquiry may help clarify specific documentation issues. Business has long track record suggesting good faith application.",
      suggestedActions: [
        "Request specific denial reasons from SBA",
        "Review all submitted documentation for gaps",
        "Submit congressional inquiry to SBA Office of Congressional Affairs",
        "Consider requesting appeal or second reconsideration"
      ]
    },
    relatedAgency: "Small Business Administration",
    timeline: "3-4 weeks for SBA response"
  },
  {
    id: "5",
    caseNumber: "CW-2024-001851",
    constituentName: "Patricia Martinez",
    email: "pmartinez@mail.com",
    category: "Housing",
    subcategory: "HUD Complaint",
    subject: "Landlord Discrimination Complaint Stalled",
    description: "I filed a fair housing complaint with HUD 8 months ago regarding disability discrimination by my landlord who refused reasonable accommodation for my service animal. The case has been 'under investigation' with no updates despite multiple follow-ups.",
    status: "new",
    priority: "high",
    submittedAt: "2024-12-05T16:30:00Z",
    aiSummary: "HUD fair housing complaint (disability discrimination, service animal) pending 8 months. No investigation updates despite constituent follow-ups. ADA/Fair Housing Act implications.",
    aiRouting: {
      recommendedTeam: "Housing & Civil Rights Specialist",
      confidence: 90,
      reasoning: "Fair housing complaint involving disability rights and service animal accommodation. Extended investigation timeline warrants congressional inquiry to HUD FHEO.",
      suggestedActions: [
        "Contact HUD Office of Fair Housing and Equal Opportunity",
        "Request case status and investigation timeline",
        "Document all discrimination incidents",
        "Consider referral to local fair housing organization"
      ]
    },
    relatedAgency: "Department of Housing and Urban Development",
    timeline: "2-3 weeks for status update"
  }
];

const CATEGORIES = ["All", "Immigration", "Veterans Affairs", "Social Security", "Small Business", "Housing", "IRS", "Medicare"];
const TEAMS = ["Immigration Casework Specialist", "Veterans Affairs Casework Specialist", "Social Security Casework Specialist", "Economic Development Specialist", "Housing & Civil Rights Specialist"];

export default function CaseworkPage() {
  const [cases, setCases] = useState<CaseworkRequest[]>(SAMPLE_CASES);
  const [selectedCase, setSelectedCase] = useState<CaseworkRequest | null>(null);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCases = cases.filter(c => {
    const matchesCategory = filterCategory === "All" || c.category === filterCategory;
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    const matchesSearch = c.constituentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const handleAssign = (caseId: string, team: string) => {
    setCases(prev => prev.map(c =>
      c.id === caseId ? { ...c, assignedTo: team, status: "in-progress" as const } : c
    ));
    if (selectedCase?.id === caseId) {
      setSelectedCase(prev => prev ? { ...prev, assignedTo: team, status: "in-progress" } : null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "in-progress": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "pending-agency": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "resolved": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      default: return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      case "high": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
      default: return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
    }
  };

  const newCount = cases.filter(c => c.status === "new").length;
  const inProgressCount = cases.filter(c => c.status === "in-progress").length;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Casework Management
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                AI-powered constituent case routing and management
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500">New Cases</p>
            <p className="text-2xl font-bold text-blue-600">{newCount}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500">In Progress</p>
            <p className="text-2xl font-bold text-yellow-600">{inProgressCount}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500">Pending Agency</p>
            <p className="text-2xl font-bold text-purple-600">12</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500">Resolved (30d)</p>
            <p className="text-2xl font-bold text-green-600">47</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="in-progress">In Progress</option>
            <option value="pending-agency">Pending Agency</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Case List */}
          <div className="lg:col-span-2 space-y-3">
            {filteredCases.map(caseItem => (
              <div
                key={caseItem.id}
                onClick={() => setSelectedCase(caseItem)}
                className={`bg-white dark:bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all ${
                  selectedCase?.id === caseItem.id
                    ? "border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900 dark:ring-zinc-100"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-zinc-500">{caseItem.caseNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(caseItem.priority)}`}>
                        {caseItem.priority}
                      </span>
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {caseItem.subject}
                    </h3>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(caseItem.status)}`}>
                    {caseItem.status.replace("-", " ")}
                  </span>
                </div>

                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">
                  {caseItem.aiSummary}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm text-zinc-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {caseItem.constituentName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      {caseItem.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-zinc-400">
                    <Clock className="w-3 h-3" />
                    {new Date(caseItem.submittedAt).toLocaleDateString()}
                  </div>
                </div>

                {/* AI Routing Badge */}
                <div className="mt-3 flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <Bot className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    Route to: <span className="font-medium text-zinc-900 dark:text-zinc-100">{caseItem.aiRouting.recommendedTeam}</span>
                  </span>
                  <span className="ml-auto text-xs text-green-600 dark:text-green-400">
                    {caseItem.aiRouting.confidence}% confident
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            {selectedCase ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono text-zinc-500">{selectedCase.caseNumber}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedCase.status)}`}>
                    {selectedCase.status.replace("-", " ")}
                  </span>
                </div>

                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-2">
                  {selectedCase.subject}
                </h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <span className="text-xs text-zinc-500 uppercase">Constituent</span>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{selectedCase.constituentName}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectedCase.email}</p>
                  </div>

                  <div>
                    <span className="text-xs text-zinc-500 uppercase">Description</span>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{selectedCase.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-zinc-500 uppercase">Category</span>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">{selectedCase.category}</p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 uppercase">Agency</span>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">{selectedCase.relatedAgency}</p>
                    </div>
                  </div>
                </div>

                {/* AI Routing Analysis */}
                <div className="bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800/50 dark:to-zinc-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">AI Routing Analysis</span>
                  </div>

                  <div className="mb-3">
                    <span className="text-xs text-zinc-500 uppercase">Recommended Team</span>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {selectedCase.aiRouting.recommendedTeam}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${selectedCase.aiRouting.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500">{selectedCase.aiRouting.confidence}%</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <span className="text-xs text-zinc-500 uppercase">Reasoning</span>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {selectedCase.aiRouting.reasoning}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-zinc-500 uppercase">Suggested Actions</span>
                    <ul className="mt-1 space-y-1">
                      {selectedCase.aiRouting.suggestedActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <ChevronRight className="w-3 h-3 mt-1 text-zinc-400" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selectedCase.timeline && (
                    <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <span className="text-xs text-zinc-500 uppercase">Expected Timeline</span>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">{selectedCase.timeline}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {selectedCase.status === "new" && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase mb-2">Assign to Team</p>
                    {TEAMS.map(team => (
                      <button
                        key={team}
                        onClick={() => handleAssign(selectedCase.id, team)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors text-sm ${
                          team === selectedCase.aiRouting.recommendedTeam
                            ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                            : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        <span>{team}</span>
                        {team === selectedCase.aiRouting.recommendedTeam && (
                          <span className="text-xs bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded">Recommended</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedCase.assignedTo && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-green-700 dark:text-green-300">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Assigned to: {selectedCase.assignedTo}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 text-center">
                <Briefcase className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-500 dark:text-zinc-400">
                  Select a case to view details and AI routing recommendations
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
