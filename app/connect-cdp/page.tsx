"use client";

import { useState } from "react";
import AppLayout from "../components/AppLayout";
import { Database, Check, ExternalLink, AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface CDPIntegration {
  id: string;
  name: string;
  description: string;
  logo: string;
  category: string;
  status: "connected" | "disconnected" | "pending";
  lastSync?: string;
  recordCount?: number;
}

// Logo colors for fallback display
const LOGO_COLORS: Record<string, string> = {
  "ngp-van": "bg-blue-600",
  "l2": "bg-red-600",
  "aristotle": "bg-emerald-600",
  "nationbuilder": "bg-sky-600",
  "salesforce": "bg-blue-500",
  "hubspot": "bg-orange-500",
  "fireside21": "bg-amber-600",
  "intranet-quorum": "bg-violet-600",
  "mailchimp": "bg-yellow-500",
  "actblue": "bg-blue-700",
  "winred": "bg-red-700",
  "anedot": "bg-indigo-600",
};

const CDP_INTEGRATIONS: CDPIntegration[] = [
  {
    id: "ngp-van",
    name: "NGP VAN",
    description: "The leading technology provider to Democratic campaigns and progressive organizations",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/NGP_VAN_logo.svg/320px-NGP_VAN_logo.svg.png",
    category: "Voter Data",
    status: "disconnected",
  },
  {
    id: "l2",
    name: "L2 Political",
    description: "Comprehensive voter file and consumer data for political campaigns",
    logo: "https://images.crunchbase.com/image/upload/c_pad,h_170,w_170,f_auto,b_white,q_auto:eco,dpr_1/v1486050690/xsqjwh7cwdqezhwhtbrh.png",
    category: "Voter Data",
    status: "disconnected",
  },
  {
    id: "aristotle",
    name: "Aristotle",
    description: "Political data and compliance solutions for campaigns and organizations",
    logo: "https://images.crunchbase.com/image/upload/c_pad,h_170,w_170,f_auto,b_white,q_auto:eco,dpr_1/lktb0yvqpdrxsqmscvst",
    category: "Voter Data",
    status: "disconnected",
  },
  {
    id: "nationbuilder",
    name: "NationBuilder",
    description: "Community organizing and campaign management platform",
    logo: "https://images.crunchbase.com/image/upload/c_pad,h_170,w_170,f_auto,b_white,q_auto:eco,dpr_1/v1455807371/xbqvtqnrlbktjfttjnj7.png",
    category: "CRM",
    status: "disconnected",
  },
  {
    id: "salesforce",
    name: "Salesforce NPSP",
    description: "Nonprofit Success Pack for constituent relationship management",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Salesforce.com_logo.svg/320px-Salesforce.com_logo.svg.png",
    category: "CRM",
    status: "disconnected",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Marketing, sales, and service software for growing organizations",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/HubSpot_Logo.svg/320px-HubSpot_Logo.svg.png",
    category: "CRM",
    status: "disconnected",
  },
  {
    id: "fireside21",
    name: "Fireside21",
    description: "Constituent correspondence management system used by Congress",
    logo: "https://images.crunchbase.com/image/upload/c_pad,h_170,w_170,f_auto,b_white,q_auto:eco,dpr_1/v1486989887/bvcbxwryqmxvqaopwzvi.png",
    category: "Congressional",
    status: "disconnected",
  },
  {
    id: "intranet-quorum",
    name: "Intranet Quorum (IQ)",
    description: "Congressional office management and constituent services platform",
    logo: "https://images.crunchbase.com/image/upload/c_pad,h_170,w_170,f_auto,b_white,q_auto:eco,dpr_1/rkyrkmmzdw9pxnkfhnlk",
    category: "Congressional",
    status: "disconnected",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Email marketing and automation platform",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Mailchimp_Logo.svg/320px-Mailchimp_Logo.svg.png",
    category: "Email",
    status: "disconnected",
  },
  {
    id: "actblue",
    name: "ActBlue",
    description: "Fundraising platform for Democratic candidates and progressive causes",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/ActBlue_logo.svg/320px-ActBlue_logo.svg.png",
    category: "Fundraising",
    status: "disconnected",
  },
  {
    id: "winred",
    name: "WinRed",
    description: "Fundraising platform for Republican candidates and conservative causes",
    logo: "https://images.crunchbase.com/image/upload/c_pad,h_170,w_170,f_auto,b_white,q_auto:eco,dpr_1/mzwm4zjzfpwrgukofzxb",
    category: "Fundraising",
    status: "disconnected",
  },
  {
    id: "anedot",
    name: "Anedot",
    description: "Payment processing and fundraising for political organizations",
    logo: "https://images.crunchbase.com/image/upload/c_pad,h_170,w_170,f_auto,b_white,q_auto:eco,dpr_1/dxaflr93tqy0sldz5chj",
    category: "Fundraising",
    status: "disconnected",
  },
];

const CATEGORIES = ["All", "Voter Data", "CRM", "Congressional", "Email", "Fundraising"];

export default function ConnectCDPPage() {
  const [integrations, setIntegrations] = useState<CDPIntegration[]>(CDP_INTEGRATIONS);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const filteredIntegrations = selectedCategory === "All"
    ? integrations
    : integrations.filter(i => i.category === selectedCategory);

  const handleConnect = async (id: string) => {
    setConnectingId(id);

    // Simulate OAuth flow
    await new Promise(resolve => setTimeout(resolve, 2000));

    setIntegrations(prev => prev.map(i =>
      i.id === id
        ? {
            ...i,
            status: "connected" as const,
            lastSync: new Date().toISOString(),
            recordCount: Math.floor(Math.random() * 50000) + 10000
          }
        : i
    ));
    setConnectingId(null);
  };

  const handleDisconnect = (id: string) => {
    setIntegrations(prev => prev.map(i =>
      i.id === id
        ? { ...i, status: "disconnected" as const, lastSync: undefined, recordCount: undefined }
        : i
    ));
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    await new Promise(resolve => setTimeout(resolve, 3000));

    setIntegrations(prev => prev.map(i =>
      i.id === id
        ? {
            ...i,
            lastSync: new Date().toISOString(),
            recordCount: (i.recordCount || 0) + Math.floor(Math.random() * 500)
          }
        : i
    ));
    setSyncingId(null);
  };

  const connectedCount = integrations.filter(i => i.status === "connected").length;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Connect Your CDP
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                Integrate your constituent data platforms for unified insights
              </p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Connected</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{connectedCount}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Records</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {integrations.reduce((sum, i) => sum + (i.recordCount || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Available</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{integrations.length}</p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Integrations Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map(integration => (
            <div
              key={integration.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden relative ${LOGO_COLORS[integration.id] || 'bg-zinc-500'}`}>
                  <span className="text-xl font-bold text-white">
                    {integration.name.charAt(0)}
                  </span>
                  <img
                    src={integration.logo}
                    alt={integration.name}
                    className="absolute inset-0 w-full h-full object-contain p-1 bg-white rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  integration.status === "connected"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}>
                  {integration.status === "connected" ? "Connected" : "Not Connected"}
                </span>
              </div>

              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                {integration.name}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2">
                {integration.description}
              </p>

              <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
                Category: {integration.category}
              </div>

              {integration.status === "connected" && (
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 mb-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">Records</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {integration.recordCount?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">Last Sync</span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {integration.lastSync
                        ? new Date(integration.lastSync).toLocaleString()
                        : "Never"
                      }
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {integration.status === "connected" ? (
                  <>
                    <button
                      onClick={() => handleSync(integration.id)}
                      disabled={syncingId === integration.id}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {syncingId === integration.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Sync
                    </button>
                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors text-sm font-medium"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(integration.id)}
                    disabled={connectingId === integration.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {connectingId === integration.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        Connect
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Secure Integration
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                All connections use OAuth 2.0 authentication and data is encrypted in transit and at rest.
                Your constituent data is never shared with third parties and remains under your control.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
