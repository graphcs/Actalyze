"use client";

import { useState } from "react";
import AppLayout from "../components/AppLayout";
import { Shield, Search, Send, Bot, AlertTriangle, CheckCircle, XCircle, Info, BookOpen, Gift, Plane, DollarSign, Users, Building2, FileText, Loader2 } from "lucide-react";

interface EthicsQuery {
  id: string;
  question: string;
  answer: string;
  category: string;
  riskLevel: "low" | "medium" | "high";
  references: string[];
  timestamp: string;
}

const QUICK_TOPICS = [
  { icon: Gift, label: "Gifts", description: "Gift rules and limits" },
  { icon: Plane, label: "Travel", description: "Official & sponsored travel" },
  { icon: DollarSign, label: "Financial Disclosure", description: "Reporting requirements" },
  { icon: Users, label: "Outside Employment", description: "Permitted activities" },
  { icon: Building2, label: "Campaign Activity", description: "Official vs campaign" },
  { icon: FileText, label: "Franking", description: "Mass communications rules" },
];

const SAMPLE_HISTORY: EthicsQuery[] = [
  {
    id: "1",
    question: "Can I accept a $75 dinner from a lobbyist?",
    answer: "No, you cannot accept this dinner. Under House Gift Rule (House Rule 25), Members and staff are prohibited from accepting gifts from registered lobbyists or foreign agents. There is no de minimis exception for gifts from lobbyists.\n\n**Key Points:**\n- The $50 gift rule does NOT apply to lobbyists\n- Zero tolerance for lobbyist gifts\n- This applies regardless of the setting or occasion\n\n**Alternatives:**\n- You may pay for your own meal\n- The lobbyist may attend an event where you pay your own way\n- Widely attended events with prior approval may be an exception",
    category: "Gifts",
    riskLevel: "high",
    references: [
      "House Rule 25, Clause 5",
      "House Ethics Manual, Chapter 2",
      "Committee on Ethics Advisory Opinion"
    ],
    timestamp: "2024-12-08T14:30:00Z"
  },
  {
    id: "2",
    question: "Is it okay to use official resources to respond to constituent mail about a campaign event?",
    answer: "No, official resources cannot be used for campaign-related communications. This would violate the prohibition on using official resources for campaign purposes.\n\n**What's Prohibited:**\n- Using official letterhead for campaign matters\n- Having staff work on campaign correspondence during official time\n- Using official email or phones for campaign communications\n\n**Proper Approach:**\n- Campaign-related inquiries should be forwarded to campaign staff\n- Use campaign resources (letterhead, email, staff time) for responses\n- Maintain clear separation between official and campaign activities",
    category: "Campaign Activity",
    riskLevel: "high",
    references: [
      "31 U.S.C. § 1301(a)",
      "House Ethics Manual, Chapter 4",
      "Committee on Ethics Campaign Activity Guidelines"
    ],
    timestamp: "2024-12-07T10:15:00Z"
  },
  {
    id: "3",
    question: "What are the rules for accepting travel from a nonprofit for a speaking engagement?",
    answer: "Travel from nonprofits for speaking engagements may be permissible under certain conditions, but requires careful review and often pre-approval.\n\n**Requirements:**\n1. The organization must not be a registered lobbyist or retain/employ lobbyists\n2. Travel must be primarily for official business\n3. Pre-approval from the Committee on Ethics required for trips over 1 day\n4. Must file public disclosure within 15 days\n\n**What's Covered:**\n- Transportation (coach class for flights under 7 hours)\n- Lodging (reasonable and actual)\n- Meals during the event\n\n**Limitations:**\n- Domestic trips: max 4 days\n- International trips: max 7 days\n- No personal travel days added",
    category: "Travel",
    riskLevel: "medium",
    references: [
      "House Rule 25, Clause 5(b)(1)(C)",
      "House Ethics Manual, Chapter 2",
      "Travel Approval Process Guidelines"
    ],
    timestamp: "2024-12-06T16:45:00Z"
  }
];

const COMMON_QUESTIONS = [
  "Can I accept a gift worth $45 from a constituent?",
  "What are the rules for my spouse's financial disclosure?",
  "Can staff volunteer on my campaign after work hours?",
  "Is it okay to send a mailer about my legislative achievements before an election?",
  "Can I accept free tickets to a sporting event from a constituent?",
  "What qualifies as a 'widely attended event' exception?",
];

export default function EthicsCompliancePage() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<EthicsQuery[]>(SAMPLE_HISTORY);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<EthicsQuery | null>(null);

  const handleSubmit = async (question: string) => {
    if (!question.trim()) return;

    setIsLoading(true);
    setQuery("");

    // Simulate AI response
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newQuery: EthicsQuery = {
      id: Date.now().toString(),
      question: question,
      answer: `Based on House ethics rules, here is guidance on your question about "${question}":\n\n**Analysis:**\nThis scenario requires careful consideration of applicable ethics rules. The specific circumstances matter significantly in determining compliance.\n\n**Key Considerations:**\n1. Review the source and nature of any benefit\n2. Consider whether any exceptions apply\n3. Document the circumstances thoroughly\n4. When in doubt, seek pre-approval\n\n**Recommendation:**\nFor this specific situation, I recommend consulting with the House Ethics Committee for a formal advisory opinion if you're uncertain. This provides protection and clarity.\n\n**Note:** This is AI-generated guidance for informational purposes. For binding opinions, contact the Committee on Ethics directly.`,
      category: "General",
      riskLevel: "medium",
      references: [
        "House Rule 25",
        "House Ethics Manual",
        "Committee on Ethics Advisory Opinions"
      ],
      timestamp: new Date().toISOString()
    };

    setHistory(prev => [newQuery, ...prev]);
    setSelectedQuery(newQuery);
    setIsLoading(false);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "high": return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
      case "medium": return "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30";
      default: return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case "high": return <XCircle className="w-4 h-4" />;
      case "medium": return <AlertTriangle className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Ethics & Compliance Copilot
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                AI-powered guidance on House ethics rules and compliance
              </p>
            </div>
          </div>
        </div>

        {/* Quick Topics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {QUICK_TOPICS.map(topic => (
            <button
              key={topic.label}
              onClick={() => setQuery(`What are the rules for ${topic.label.toLowerCase()}?`)}
              className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors text-left"
            >
              <topic.icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400 mb-2" />
              <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{topic.label}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{topic.description}</p>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Chat Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Query Input */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(query);
                      }
                    }}
                    placeholder="Ask about gifts, travel, financial disclosure, campaign activity, or any ethics question..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Press Enter to submit, Shift+Enter for new line
                </p>
                <button
                  onClick={() => handleSubmit(query)}
                  disabled={!query.trim() || isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Ask Copilot
                </button>
              </div>
            </div>

            {/* Common Questions */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Common Questions:</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(q)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Query Response */}
            {selectedQuery && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Your Question:</p>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{selectedQuery.question}</p>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(selectedQuery.riskLevel)}`}>
                    {getRiskIcon(selectedQuery.riskLevel)}
                    {selectedQuery.riskLevel} risk
                  </span>
                </div>

                <div className="prose prose-zinc dark:prose-invert max-w-none mb-4">
                  <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                    {selectedQuery.answer}
                  </div>
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-2">
                    References
                  </p>
                  <ul className="space-y-1">
                    {selectedQuery.references.map((ref, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <BookOpen className="w-3.5 h-3.5" />
                        {ref}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex gap-2">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      This is AI-generated guidance for informational purposes only. For binding ethics opinions,
                      contact the House Committee on Ethics at (202) 225-7103 or ethics.house.gov.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* History Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 sticky top-24">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Recent Queries</h3>
              <div className="space-y-3">
                {history.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedQuery(item)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedQuery?.id === item.id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.category}</span>
                      <span className={`flex items-center gap-1 text-xs ${
                        item.riskLevel === "high" ? "text-red-600" :
                        item.riskLevel === "medium" ? "text-yellow-600" :
                        "text-green-600"
                      }`}>
                        {getRiskIcon(item.riskLevel)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
                      {item.question}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
