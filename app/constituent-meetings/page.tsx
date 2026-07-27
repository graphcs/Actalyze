"use client";

import { useState } from "react";
import AppLayout from "../components/AppLayout";
import { Users, Calendar, Clock, MapPin, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle, XCircle, Loader2, Plus, Search, Filter, Bot } from "lucide-react";

interface MeetingRequest {
  id: string;
  constituentName: string;
  organization?: string;
  email: string;
  phone?: string;
  topic: string;
  description: string;
  preferredDate: string;
  preferredTime: string;
  location: "in-district" | "dc-office" | "virtual";
  status: "pending" | "approved" | "declined" | "scheduled";
  submittedAt: string;
  /** null until the request has actually been analysed. */
  aiScore: number | null;
  aiReasoning: string;
  aiRecommendation: "meet" | "delegate" | "decline" | null;
  priority: "high" | "medium" | "low";
}

const SAMPLE_REQUESTS: MeetingRequest[] = [
  {
    id: "1",
    constituentName: "Sarah Johnson",
    organization: "Local Chamber of Commerce",
    email: "sjohnson@chamber.org",
    phone: "(555) 123-4567",
    topic: "Small Business Tax Relief",
    description: "Requesting a meeting to discuss the impact of proposed tax legislation on small businesses in the district. We represent over 200 local businesses and would like to share data on how these changes would affect job creation.",
    preferredDate: "2025-01-15",
    preferredTime: "10:00 AM",
    location: "in-district",
    status: "pending",
    submittedAt: "2024-12-08T14:30:00Z",
    aiScore: 92,
    aiReasoning: "High-impact constituent group representing 200+ businesses. Topic aligns with member's economic priorities. Previous positive engagement history. District-level meeting preferred.",
    aiRecommendation: "meet",
    priority: "high",
  },
  {
    id: "2",
    constituentName: "Michael Chen",
    email: "mchen@email.com",
    topic: "VA Healthcare Access",
    description: "I'm a veteran struggling to get timely appointments at the local VA hospital. Wait times have exceeded 60 days for specialist care. I'd like to discuss this issue directly.",
    preferredDate: "2025-01-20",
    preferredTime: "2:00 PM",
    location: "virtual",
    status: "pending",
    submittedAt: "2024-12-07T09:15:00Z",
    aiScore: 85,
    aiReasoning: "Veteran constituent with legitimate healthcare access concerns. Issue falls under committee jurisdiction. Personal story valuable for advocacy. Recommend meeting to gather testimonial.",
    aiRecommendation: "meet",
    priority: "high",
  },
  {
    id: "3",
    constituentName: "Jennifer Williams",
    organization: "District Teachers Association",
    email: "jwilliams@dta.org",
    topic: "Education Funding",
    description: "Following up on our previous correspondence about Title I funding. We have compiled data showing the impact on our district schools.",
    preferredDate: "2025-01-22",
    preferredTime: "11:00 AM",
    location: "dc-office",
    status: "pending",
    submittedAt: "2024-12-06T16:45:00Z",
    aiScore: 78,
    aiReasoning: "Established relationship with constituent group. Follow-up to previous engagement. Educational policy is a priority area. Consider delegating to Education LA if schedule tight.",
    aiRecommendation: "meet",
    priority: "medium",
  },
  {
    id: "4",
    constituentName: "Robert Martinez",
    email: "rmartinez@gmail.com",
    topic: "Federal Grant Application Help",
    description: "I'm starting a small nonprofit and need help navigating federal grant applications. Looking for guidance on the process.",
    preferredDate: "2025-01-25",
    preferredTime: "3:00 PM",
    location: "virtual",
    status: "pending",
    submittedAt: "2024-12-05T11:20:00Z",
    aiScore: 45,
    aiReasoning: "Individual constituent request. Topic is casework-related rather than policy discussion. Better suited for staff handling. Recommend routing to casework team.",
    aiRecommendation: "delegate",
    priority: "low",
  },
  {
    id: "5",
    constituentName: "Anonymous",
    email: "concerned@tempmail.com",
    topic: "Conspiracy Allegations",
    description: "I have evidence of a massive conspiracy involving multiple government agencies. This is urgent and must be discussed in person only.",
    preferredDate: "2025-01-10",
    preferredTime: "Any",
    location: "in-district",
    status: "pending",
    submittedAt: "2024-12-04T23:55:00Z",
    aiScore: 12,
    aiReasoning: "Anonymous request with vague allegations. No verifiable constituent information. Temporary email address suggests potential bad-faith request. Standard response recommended.",
    aiRecommendation: "decline",
    priority: "low",
  },
];

export default function ConstituentMeetingsPage() {
  const [requests, setRequests] = useState<MeetingRequest[]>(SAMPLE_REQUESTS);
  const [selectedRequest, setSelectedRequest] = useState<MeetingRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    constituentName: "",
    organization: "",
    email: "",
    phone: "",
    topic: "",
    description: "",
    preferredDate: "",
    preferredTime: "",
    location: "virtual" as "in-district" | "dc-office" | "virtual",
  });

  const filteredRequests = requests.filter(req => {
    const matchesStatus = filterStatus === "all" || req.status === filterStatus;
    const matchesSearch = req.constituentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.organization?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleStatusChange = (id: string, newStatus: MeetingRequest["status"]) => {
    setRequests(prev => prev.map(req =>
      req.id === id ? { ...req, status: newStatus } : req
    ));
    if (selectedRequest?.id === id) {
      setSelectedRequest(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  // A null score means the request has not been analysed yet - render it neutrally
  // rather than colouring it as if it had scored badly.
  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-zinc-500 dark:text-zinc-400";
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return "bg-zinc-100 dark:bg-zinc-800/40";
    if (score >= 80) return "bg-green-100 dark:bg-green-900/30";
    if (score >= 50) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  const getRecommendationIcon = (rec: string | null) => {
    switch (rec) {
      case "meet": return <ThumbsUp className="w-4 h-4 text-green-600" />;
      case "delegate": return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "decline": return <ThumbsDown className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  const scoredRequests = requests.filter(
    (r): r is MeetingRequest & { aiScore: number } => r.aiScore !== null
  );

  const handleCreateRequest = async () => {
    if (!newRequest.constituentName || !newRequest.email || !newRequest.topic) return;

    // Score the request with the real model rather than assigning a number.
    // If scoring is unavailable the request is still created, marked as awaiting
    // analysis — never with an invented score.
    let aiScore: number | null = null;
    let aiReasoning = "Awaiting analysis.";
    let aiRecommendation: "meet" | "delegate" | "decline" | null = null;

    try {
      const res = await fetch("/api/meetings/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          constituentName: newRequest.constituentName,
          organization: newRequest.organization,
          topic: newRequest.topic,
          description: newRequest.description,
          location: newRequest.location,
        }),
      });
      const data = await res.json();
      if (data?.analyzed) {
        aiScore = data.score;
        aiReasoning = data.reasoning;
        aiRecommendation = data.recommendation;
      }
    } catch {
      // Leave the request unscored rather than guessing.
    }

    const newMeetingRequest: MeetingRequest = {
      id: Date.now().toString(),
      constituentName: newRequest.constituentName,
      organization: newRequest.organization || undefined,
      email: newRequest.email,
      phone: newRequest.phone || undefined,
      topic: newRequest.topic,
      description: newRequest.description,
      preferredDate: newRequest.preferredDate || new Date().toISOString().split("T")[0],
      preferredTime: newRequest.preferredTime || "TBD",
      location: newRequest.location,
      status: "pending",
      submittedAt: new Date().toISOString(),
      aiScore,
      aiReasoning,
      aiRecommendation,
      priority: aiScore === null ? "medium" : aiScore >= 70 ? "high" : aiScore >= 40 ? "medium" : "low",
    };

    setRequests(prev => [newMeetingRequest, ...prev]);
    setNewRequest({
      constituentName: "",
      organization: "",
      email: "",
      phone: "",
      topic: "",
      description: "",
      preferredDate: "",
      preferredTime: "",
      location: "virtual",
    });
    setShowNewForm(false);
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const scheduledCount = requests.filter(r => r.status === "scheduled").length;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Constituent Meetings
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400">
                  AI-assisted meeting request management
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Request
            </button>
          </div>
        </div>

        {/* New Request Form */}
        {showNewForm && (
          <div className="mb-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">New Meeting Request</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 uppercase mb-1">Constituent Name *</label>
                <input
                  type="text"
                  value={newRequest.constituentName}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, constituentName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase mb-1">Organization</label>
                <input
                  type="text"
                  value={newRequest.organization}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, organization: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  placeholder="Organization (optional)"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase mb-1">Email *</label>
                <input
                  type="email"
                  value={newRequest.email}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase mb-1">Phone</label>
                <input
                  type="tel"
                  value={newRequest.phone}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-zinc-500 uppercase mb-1">Topic *</label>
                <input
                  type="text"
                  value={newRequest.topic}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, topic: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  placeholder="Meeting topic"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-zinc-500 uppercase mb-1">Description</label>
                <textarea
                  value={newRequest.description}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  placeholder="Details about the meeting request..."
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase mb-1">Preferred Date</label>
                <input
                  type="date"
                  value={newRequest.preferredDate}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, preferredDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase mb-1">Preferred Time</label>
                <input
                  type="text"
                  value={newRequest.preferredTime}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, preferredTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  placeholder="e.g., 10:00 AM"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase mb-1">Location</label>
                <select
                  value={newRequest.location}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, location: e.target.value as "in-district" | "dc-office" | "virtual" }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="virtual">Virtual</option>
                  <option value="in-district">In-District</option>
                  <option value="dc-office">DC Office</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCreateRequest}
                disabled={!newRequest.constituentName || !newRequest.email || !newRequest.topic}
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Request
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500">Pending Review</p>
            <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500">Scheduled</p>
            <p className="text-2xl font-bold text-green-600">{scheduledCount}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500">This Week</p>
            <p className="text-2xl font-bold text-blue-600">8</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500">Avg AI Score</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {scoredRequests.length === 0
                ? "—"
                : Math.round(
                    scoredRequests.reduce((sum, r) => sum + r.aiScore, 0) / scoredRequests.length
                  )}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name, topic, or organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="scheduled">Scheduled</option>
            <option value="declined">Declined</option>
          </select>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Request List */}
          <div className="lg:col-span-2 space-y-3">
            {filteredRequests.map(request => (
              <div
                key={request.id}
                onClick={() => setSelectedRequest(request)}
                className={`bg-white dark:bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all ${
                  selectedRequest?.id === request.id
                    ? "border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900 dark:ring-zinc-100"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {request.constituentName}
                      </h3>
                      {request.organization && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          • {request.organization}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      {request.topic}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getScoreBg(request.aiScore)} ${getScoreColor(request.aiScore)}`}>
                      {request.aiScore === null ? "Awaiting analysis" : `AI: ${request.aiScore}`}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      request.status === "pending" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                      request.status === "scheduled" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                      request.status === "approved" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    }`}>
                      {request.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(request.preferredDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {request.preferredTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {request.location === "in-district" ? "In-District" :
                     request.location === "dc-office" ? "DC Office" : "Virtual"}
                  </span>
                </div>

                {/* AI Recommendation Badge */}
                <div className="mt-3 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs text-zinc-500">AI Recommends:</span>
                  <span className={`flex items-center gap-1 text-xs font-medium ${
                    request.aiRecommendation === "meet" ? "text-green-600" :
                    request.aiRecommendation === "delegate" ? "text-yellow-600" :
                    "text-red-600"
                  }`}>
                    {getRecommendationIcon(request.aiRecommendation)}
                    {request.aiRecommendation === "meet" ? "Schedule Meeting" :
                     request.aiRecommendation === "delegate" ? "Delegate to Staff" :
                     "Decline Politely"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            {selectedRequest ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 sticky top-24">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-1">
                  {selectedRequest.constituentName}
                </h3>
                {selectedRequest.organization && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    {selectedRequest.organization}
                  </p>
                )}

                <div className="space-y-3 mb-4">
                  <div>
                    <span className="text-xs text-zinc-500 uppercase">Topic</span>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {selectedRequest.topic}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 uppercase">Description</span>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {selectedRequest.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-zinc-500 uppercase">Date</span>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">
                        {new Date(selectedRequest.preferredDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 uppercase">Time</span>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">
                        {selectedRequest.preferredTime}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 uppercase">Contact</span>
                    <p className="text-sm text-zinc-900 dark:text-zinc-100">{selectedRequest.email}</p>
                    {selectedRequest.phone && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectedRequest.phone}</p>
                    )}
                  </div>
                </div>

                {/* AI Analysis */}
                <div className={`rounded-lg p-4 mb-4 ${getScoreBg(selectedRequest.aiScore)}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">AI Analysis</span>
                    <span className={`ml-auto text-lg font-bold ${getScoreColor(selectedRequest.aiScore)}`}>
                      {selectedRequest.aiScore === null ? "—" : `${selectedRequest.aiScore}/100`}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">
                    {selectedRequest.aiReasoning}
                  </p>
                  <div className={`flex items-center gap-2 text-sm font-medium ${
                    selectedRequest.aiRecommendation === "meet" ? "text-green-700 dark:text-green-300" :
                    selectedRequest.aiRecommendation === "delegate" ? "text-yellow-700 dark:text-yellow-300" :
                    "text-red-700 dark:text-red-300"
                  }`}>
                    {getRecommendationIcon(selectedRequest.aiRecommendation)}
                    Recommendation: {
                      selectedRequest.aiRecommendation === "meet" ? "Member should meet" :
                      selectedRequest.aiRecommendation === "delegate" ? "Delegate to staff" :
                      "Politely decline"
                    }
                  </div>
                </div>

                {/* Action Buttons */}
                {selectedRequest.status === "pending" && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleStatusChange(selectedRequest.id, "scheduled")}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Schedule Meeting
                    </button>
                    <button
                      onClick={() => handleStatusChange(selectedRequest.id, "approved")}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <Users className="w-4 h-4" />
                      Delegate to Staff
                    </button>
                    <button
                      onClick={() => handleStatusChange(selectedRequest.id, "declined")}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Decline Request
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 text-center">
                <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-500 dark:text-zinc-400">
                  Select a meeting request to view details and AI analysis
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
