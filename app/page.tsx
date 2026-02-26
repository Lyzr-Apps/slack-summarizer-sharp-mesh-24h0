'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { callAIAgent, type AIAgentResponse } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { HiHashtag, HiLockClosed, HiSearch, HiChevronDown, HiChevronUp, HiReply, HiClock, HiUserGroup, HiChat, HiExclamation, HiQuestionMarkCircle, HiFire, HiCheckCircle, HiX, HiRefresh, HiArrowLeft, HiFilter, HiMenuAlt2, HiDownload, HiGlobe } from 'react-icons/hi'

// ── Agent IDs ──
const MANAGER_AGENT_ID = '69a01a8ca2c9d4f61dfad00d'
const REPLY_AGENT_ID = '69a01a9c0312792fe8a4e5fd'
const SUMMARIZER_AGENT_ID = '69a01a648b888baee3576ce0' // Has SLACK_LIST_ALL_CHANNELS tool

// ── Sample Channels ──
const SAMPLE_CHANNELS = [
  { id: '1', name: 'general', is_private: false, member_count: 45, last_activity: '2 min ago' },
  { id: '2', name: 'engineering', is_private: false, member_count: 28, last_activity: '5 min ago' },
  { id: '3', name: 'design-team', is_private: true, member_count: 12, last_activity: '15 min ago' },
  { id: '4', name: 'product-updates', is_private: false, member_count: 67, last_activity: '1 hr ago' },
  { id: '5', name: 'leadership', is_private: true, member_count: 8, last_activity: '30 min ago' },
  { id: '6', name: 'random', is_private: false, member_count: 52, last_activity: '3 min ago' },
  { id: '7', name: 'incidents', is_private: false, member_count: 34, last_activity: '45 min ago' },
  { id: '8', name: 'sales-team', is_private: true, member_count: 19, last_activity: '2 hr ago' },
  { id: '9', name: 'announcements', is_private: false, member_count: 89, last_activity: '20 min ago' },
  { id: '10', name: 'dev-ops', is_private: false, member_count: 15, last_activity: '10 min ago' },
]

// ── Sample Summary Data ──
const SAMPLE_SUMMARY = {
  channel_name: 'engineering',
  time_range: 'Last 24 hours',
  summary: {
    total_messages: 142,
    most_active_participants: ['Sarah Chen', 'Mike Johnson', 'Alex Rivera', 'Priya Patel'],
    topics: [
      {
        title: 'API v3 Migration Progress',
        summary: 'The team discussed the ongoing migration from API v2 to v3. The new endpoints are mostly ready, but authentication middleware needs additional testing. Performance benchmarks show a 23% improvement in response times.',
        key_takeaways: [
          'Migration is 75% complete, targeting end of sprint for full rollout',
          'Auth middleware refactor blocked on OAuth2 library update',
          'Performance benchmarks are promising - 23% faster response times',
        ],
        participants: ['Sarah Chen', 'Mike Johnson', 'Alex Rivera'],
        message_count: 38,
      },
      {
        title: 'Production Incident Post-Mortem',
        summary: "Review of yesterday's 45-minute outage caused by a misconfigured load balancer. The team agreed on implementing additional health checks and updating the runbook.",
        key_takeaways: [
          'Root cause: misconfigured load balancer health check interval',
          'Action: implement automated config validation in CI/CD',
          'Updated runbook to include LB config verification steps',
        ],
        participants: ['Priya Patel', 'Mike Johnson'],
        message_count: 24,
      },
      {
        title: 'New Hire Onboarding Improvements',
        summary: 'Discussion about streamlining the developer onboarding process. Several pain points were identified including outdated documentation and complex local setup.',
        key_takeaways: [
          'Create Docker-based dev environment for faster setup',
          'Update README with current architecture diagrams',
          'Assign onboarding buddies for first two weeks',
        ],
        participants: ['Sarah Chen', 'Alex Rivera'],
        message_count: 15,
      },
    ],
    overall_summary: "The engineering channel was highly active today with 142 messages across several important threads. The API v3 migration continues to be the primary focus, with good progress reported on performance improvements. The team conducted a thorough post-mortem of yesterday's production incident and identified concrete steps to prevent similar issues. There was also productive discussion about improving the onboarding experience for new team members.",
  },
  action_items: [
    {
      id: 'ai-1',
      category: 'urgent',
      priority: 'urgent',
      original_message: '@channel The staging environment is down. Database connection pool is exhausted. Need someone from the backend team to look into this ASAP.',
      sender_name: 'Priya Patel',
      timestamp: '11:42 AM',
      thread_id: 'T001',
      context: "Staging environment outage affecting QA team's ability to test the upcoming release. Multiple services are failing health checks.",
      suggested_reply: "Looking into the connection pool issue now. I'll check the pgbouncer config and restart the affected services. Will update the thread in 15 minutes.",
    },
    {
      id: 'ai-2',
      category: 'question',
      priority: 'question',
      original_message: "Has anyone tested the new caching layer with Redis Cluster? I'm seeing some inconsistencies with key distribution across nodes.",
      sender_name: 'Alex Rivera',
      timestamp: '2:15 PM',
      thread_id: 'T002',
      context: 'Redis Cluster deployment for the caching layer is part of the Q1 infrastructure upgrade. Consistent hashing might need tuning.',
      suggested_reply: "Yes, we ran into similar issues last sprint. The key distribution works better if you use hash tags for related keys. I can share our config and test results - let's sync tomorrow morning.",
    },
    {
      id: 'ai-3',
      category: 'decision',
      priority: 'decision',
      original_message: 'We need to decide on the error handling strategy for the new API. Option A: return detailed errors in dev, generic in prod. Option B: always return structured error codes with a lookup endpoint. Thoughts?',
      sender_name: 'Sarah Chen',
      timestamp: '10:30 AM',
      thread_id: 'T003',
      context: 'This decision affects the entire API v3 surface area. Both options have trade-offs around security vs developer experience.',
      suggested_reply: "I'd vote for Option B with structured error codes. It's more consistent across environments and gives clients a reliable contract. We can include a debug header in dev mode for additional context without changing the response shape.",
    },
    {
      id: 'ai-4',
      category: 'hot_thread',
      priority: 'hot_thread',
      original_message: 'The new deployment pipeline is taking 45 minutes per build. This is 3x slower than last week. We need to investigate the build cache invalidation.',
      sender_name: 'Mike Johnson',
      timestamp: '4:00 PM',
      thread_id: 'T004',
      context: 'Build times have increased significantly, likely due to the new monorepo structure. This is impacting team velocity and deploy frequency.',
      suggested_reply: 'I noticed the same thing. Let me check if the Docker layer caching is working correctly after the monorepo migration. We might need to restructure the Dockerfile to better leverage build cache.',
    },
  ],
  total_flagged_items: 4,
}

// ── Interfaces ──
interface Channel {
  id: string
  name: string
  is_private: boolean
  member_count: number
  last_activity: string
}

interface Topic {
  title: string
  summary: string
  key_takeaways: string[]
  participants: string[]
  message_count: number
}

interface ActionItem {
  id: string
  category: string
  priority: string
  original_message: string
  sender_name: string
  timestamp: string
  thread_id: string
  context: string
  suggested_reply: string
  replied?: boolean
}

interface SummaryData {
  channel_name: string
  time_range: string
  summary: {
    total_messages: number
    most_active_participants: string[]
    topics: Topic[]
    overall_summary: string
  }
  action_items: ActionItem[]
  total_flagged_items: number
}

// ── Markdown Renderer ──
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// ── Priority Helpers ──
function getPriorityStyle(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return 'bg-red-100 text-red-700 border border-red-200'
    case 'question':
      return 'bg-amber-100 text-amber-700 border border-amber-200'
    case 'decision':
      return 'bg-blue-100 text-blue-700 border border-blue-200'
    case 'hot_thread':
      return 'bg-orange-100 text-orange-700 border border-orange-200'
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200'
  }
}

function PriorityIcon({ priority }: { priority: string }) {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return <HiExclamation className="w-4 h-4" />
    case 'question':
      return <HiQuestionMarkCircle className="w-4 h-4" />
    case 'decision':
      return <HiChat className="w-4 h-4" />
    case 'hot_thread':
      return <HiFire className="w-4 h-4" />
    default:
      return <HiExclamation className="w-4 h-4" />
  }
}

// ── Skeleton Loader ──
function SkeletonLoader() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse space-y-4">
        <div className="h-5 bg-muted rounded-lg w-3/4" />
        <div className="h-4 bg-muted rounded-lg w-1/2" />
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-4 bg-muted rounded-lg w-2/3" />
      </div>
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-muted rounded-lg w-1/3" />
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
      </div>
    </div>
  )
}

// ── Topic Card ──
function TopicCard({
  topic,
  isExpanded,
  onToggle,
}: {
  topic: Topic
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-[0.875rem] shadow-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50/50 transition-colors duration-200"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-foreground truncate">
              {topic?.title ?? 'Untitled Topic'}
            </h4>
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              <HiChat className="w-3 h-3" />
              {topic?.message_count ?? 0}
            </span>
          </div>
        </div>
        {isExpanded ? (
          <HiChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
        ) : (
          <HiChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50">
          <div className="pt-3">
            <p className="text-sm text-foreground/80 leading-relaxed">
              {topic?.summary ?? ''}
            </p>
          </div>
          {Array.isArray(topic?.key_takeaways) && topic.key_takeaways.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Key Takeaways
              </h5>
              <ul className="space-y-1">
                {topic.key_takeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(topic?.participants) && topic.participants.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {topic.participants.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full"
                >
                  <HiUserGroup className="w-3 h-3" />
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Action Item Card ──
function ActionItemCard({
  item,
  isExpanded,
  onToggle,
  editingReply,
  setEditingReply,
  onSendReply,
  isSending,
  onDiscard,
}: {
  item: ActionItem
  isExpanded: boolean
  onToggle: () => void
  editingReply: string
  setEditingReply: (v: string) => void
  onSendReply: () => void
  isSending: boolean
  onDiscard: () => void
}) {
  const priority = item?.priority ?? item?.category ?? 'unknown'

  return (
    <div className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-[0.875rem] shadow-md overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${getPriorityStyle(priority)}`}>
                <PriorityIcon priority={priority} />
                {priority?.replace('_', ' ') ?? 'unknown'}
              </span>
              {item?.replied && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                  <HiCheckCircle className="w-3.5 h-3.5" />
                  Replied
                </span>
              )}
            </div>
            <p className="text-sm text-foreground/90 line-clamp-2">
              {item?.original_message ?? ''}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <HiUserGroup className="w-3 h-3" />
                {item?.sender_name ?? 'Unknown'}
              </span>
              <span className="inline-flex items-center gap-1">
                <HiClock className="w-3 h-3" />
                {item?.timestamp ?? ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!item?.replied && (
              <button
                onClick={onToggle}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-full transition-colors duration-200"
              >
                {isExpanded ? (
                  <HiChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <HiReply className="w-3.5 h-3.5" />
                )}
                {isExpanded ? 'Collapse' : 'Reply'}
              </button>
            )}
          </div>
        </div>
      </div>

      {isExpanded && !item?.replied && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50">
          {item?.context && (
            <div className="pt-3">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Context
              </h5>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-foreground/80">
                {item.context}
              </div>
            </div>
          )}
          <div>
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Your Reply
            </h5>
            <textarea
              value={editingReply}
              onChange={(e) => setEditingReply(e.target.value)}
              rows={4}
              className="w-full bg-white border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none"
              placeholder="Type your reply..."
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onDiscard}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-full transition-colors duration-200"
            >
              <HiX className="w-3.5 h-3.5" />
              Discard
            </button>
            <button
              onClick={onSendReply}
              disabled={isSending || !editingReply.trim()}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 px-4 py-1.5 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <HiRefresh className="w-3.5 h-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <HiReply className="w-3.5 h-3.5" />
                  Send Reply
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Agent Status Bar ──
function AgentStatusBar({ activeAgentId }: { activeAgentId: string | null }) {
  const agents = [
    {
      id: SUMMARIZER_AGENT_ID,
      name: 'Conversation Summarizer',
      purpose: 'Fetches channels & conversation history',
    },
    {
      id: MANAGER_AGENT_ID,
      name: 'Channel Insights Coordinator',
      purpose: 'Summarizes channels & identifies action items',
    },
    {
      id: REPLY_AGENT_ID,
      name: 'Reply Agent',
      purpose: 'Sends replies to Slack threads',
    },
  ]

  return (
    <div className="backdrop-blur-[16px] bg-white/60 border border-white/[0.18] rounded-[0.875rem] p-3">
      <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
        AI Agents
      </h3>
      <div className="space-y-2">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${activeAgentId === agent.id ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-foreground truncate">
                {agent.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {agent.purpose}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ErrorBoundary ──
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              {this.state.error}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-[0.875rem] text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Main Page ──
export default function Page() {
  // Channel state
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | 'public' | 'private'>('all')
  const [timeRange, setTimeRange] = useState('Last 24 hours')
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false)

  // Summary state
  const [loading, setLoading] = useState(false)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [error, setError] = useState<string | null>(null)

  // Action items state
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [editingReply, setEditingReply] = useState('')
  const [sendingReply, setSendingReply] = useState<string | null>(null)
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set())

  // Live channels state
  const [liveChannels, setLiveChannels] = useState<Channel[]>([])
  const [fetchingChannels, setFetchingChannels] = useState(false)
  const [channelsFetched, setChannelsFetched] = useState(false)
  const [channelFetchError, setChannelFetchError] = useState<string | null>(null)

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSampleData, setShowSampleData] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const timeRangeRef = useRef<HTMLDivElement>(null)
  const TIME_OPTIONS = ['Last 24 hours', 'Last 7 days', 'Last 30 days']

  // Fetch live Slack channels via Conversation Summarizer Agent
  const handleFetchChannels = useCallback(async () => {
    setFetchingChannels(true)
    setChannelFetchError(null)
    setActiveAgentId(SUMMARIZER_AGENT_ID)

    const message = `List all Slack channels in the workspace using the SLACK_LIST_ALL_CHANNELS tool. Return the complete list of channels with their names, IDs, whether they are private or public, member count, and any other available metadata. Return EVERY channel available.`

    try {
      const result = await callAIAgent(message, SUMMARIZER_AGENT_ID)
      if (result.success) {
        let parsed = result?.response?.result
        if (typeof parsed === 'string') {
          parsed = parseLLMJson(parsed)
        }

        // The agent may return channels in various formats. Handle flexibly.
        let channelList: any[] = []

        if (Array.isArray(parsed)) {
          channelList = parsed
        } else if (parsed?.channels && Array.isArray(parsed.channels)) {
          channelList = parsed.channels
        } else if (parsed?.data && Array.isArray(parsed.data)) {
          channelList = parsed.data
        } else if (parsed?.summary?.channels && Array.isArray(parsed.summary.channels)) {
          channelList = parsed.summary.channels
        } else if (parsed?.topics && Array.isArray(parsed.topics)) {
          // Sometimes the response schema wraps it in topics
          channelList = parsed.topics
        } else {
          // Try to find any array in the top-level keys
          const keys = parsed ? Object.keys(parsed) : []
          for (const key of keys) {
            if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
              const first = parsed[key][0]
              if (first && (first.name || first.channel_name || first.id)) {
                channelList = parsed[key]
                break
              }
            }
          }
        }

        if (channelList.length > 0) {
          const mapped: Channel[] = channelList.map((ch: any, idx: number) => ({
            id: ch?.id || ch?.channel_id || `ch-${idx}`,
            name: ch?.name || ch?.channel_name || ch?.title || `channel-${idx}`,
            is_private: ch?.is_private ?? ch?.isPrivate ?? ch?.private ?? false,
            member_count: ch?.member_count ?? ch?.num_members ?? ch?.members ?? 0,
            last_activity: ch?.last_activity ?? ch?.updated ?? ch?.purpose?.last_set ?? 'N/A',
          }))
          setLiveChannels(mapped)
          setChannelsFetched(true)
          setSuccessMessage(`Fetched ${mapped.length} channels from Slack`)
          setTimeout(() => setSuccessMessage(null), 4000)
        } else {
          setChannelFetchError('No channels found in the response. The agent may need Slack authentication configured.')
        }
      } else {
        const errMsg = result?.error ?? 'Failed to fetch channels from Slack'
        const isAuthError = errMsg.toLowerCase().includes('tool_auth') || errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('token')
        setChannelFetchError(
          isAuthError
            ? 'Slack authentication required. Please connect your Slack workspace via Lyzr Studio to enable channel fetching.'
            : errMsg
        )
      }
    } catch (err) {
      setChannelFetchError('An error occurred while fetching Slack channels')
    } finally {
      setFetchingChannels(false)
      setActiveAgentId(null)
    }
  }, [])

  // Close time dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        timeRangeRef.current &&
        !timeRangeRef.current.contains(e.target as Node)
      ) {
        setTimeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Apply sample data
  useEffect(() => {
    if (showSampleData) {
      setSelectedChannel(SAMPLE_CHANNELS[1])
      setSummaryData(SAMPLE_SUMMARY as SummaryData)
      setActionItems(
        SAMPLE_SUMMARY.action_items.map((item) => ({ ...item, replied: false }))
      )
      setError(null)
    } else {
      setSummaryData(null)
      setActionItems([])
      setError(null)
    }
  }, [showSampleData])

  // Determine which channel source to use
  const channelSource = useMemo(() => {
    if (showSampleData) return SAMPLE_CHANNELS
    if (channelsFetched && liveChannels.length > 0) return liveChannels
    return SAMPLE_CHANNELS
  }, [showSampleData, channelsFetched, liveChannels])

  // Filter channels
  const filteredChannels = useMemo(() => {
    return channelSource.filter((ch) => {
      const matchesSearch = ch.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesFilter =
        channelFilter === 'all' ||
        (channelFilter === 'public' && !ch.is_private) ||
        (channelFilter === 'private' && ch.is_private)
      return matchesSearch && matchesFilter
    })
  }, [searchQuery, channelFilter, channelSource])

  // Summarize channel
  const handleSummarize = useCallback(async () => {
    if (!selectedChannel) return
    setLoading(true)
    setSummaryData(null)
    setActionItems([])
    setError(null)
    setExpandedTopics(new Set())
    setExpandedItem(null)
    setActiveAgentId(MANAGER_AGENT_ID)

    const message = `Summarize the Slack channel #${selectedChannel.name} for the ${timeRange}. Fetch the conversation history and identify all action items, urgent issues, questions, and decisions that need attention. Provide a comprehensive summary organized by topic.`

    try {
      const result = await callAIAgent(message, MANAGER_AGENT_ID)
      if (result.success) {
        let parsed = result?.response?.result
        if (typeof parsed === 'string') {
          parsed = parseLLMJson(parsed)
        }
        const summaryObj: SummaryData = {
          channel_name: parsed?.channel_name ?? selectedChannel.name,
          time_range: parsed?.time_range ?? timeRange,
          summary: {
            total_messages: parsed?.summary?.total_messages ?? 0,
            most_active_participants: Array.isArray(
              parsed?.summary?.most_active_participants
            )
              ? parsed.summary.most_active_participants
              : [],
            topics: Array.isArray(parsed?.summary?.topics)
              ? parsed.summary.topics
              : [],
            overall_summary: parsed?.summary?.overall_summary ?? '',
          },
          action_items: Array.isArray(parsed?.action_items)
            ? parsed.action_items
            : [],
          total_flagged_items: parsed?.total_flagged_items ?? 0,
        }
        setSummaryData(summaryObj)
        setActionItems(
          Array.isArray(parsed?.action_items)
            ? parsed.action_items.map((item: any, idx: number) => ({
                ...item,
                id: item?.id ?? `ai-${idx}`,
                replied: false,
              }))
            : []
        )
      } else {
        setError(result?.error ?? 'Failed to summarize channel')
      }
    } catch (err) {
      setError('An error occurred while summarizing the channel')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [selectedChannel, timeRange])

  // Send reply
  const handleSendReply = useCallback(
    async (actionItem: ActionItem, replyText: string) => {
      if (!replyText.trim()) return
      setSendingReply(actionItem?.id ?? null)
      setActiveAgentId(REPLY_AGENT_ID)
      setError(null)

      const channelName =
        summaryData?.channel_name ?? selectedChannel?.name ?? 'unknown'
      const threadPart = actionItem?.thread_id
        ? ` in thread ${actionItem.thread_id}`
        : ''
      const message = `Send this reply to Slack channel #${channelName}${threadPart}. The reply message is: "${replyText}"`

      try {
        const result = await callAIAgent(message, REPLY_AGENT_ID)
        if (result.success) {
          let parsed = result?.response?.result
          if (typeof parsed === 'string') {
            parsed = parseLLMJson(parsed)
          }
          setActionItems((prev) =>
            prev.map((item) =>
              item?.id === actionItem?.id ? { ...item, replied: true } : item
            )
          )
          setExpandedItem(null)
          setEditingReply('')
          setSuccessMessage(
            `Reply sent successfully to #${channelName}`
          )
          setTimeout(() => setSuccessMessage(null), 4000)
        } else {
          setError(result?.error ?? 'Failed to send reply')
        }
      } catch (err) {
        setError('An error occurred while sending the reply')
      } finally {
        setSendingReply(null)
        setActiveAgentId(null)
      }
    },
    [summaryData, selectedChannel]
  )

  // Expand action item
  const handleExpandItem = useCallback(
    (itemId: string, suggestedReply: string) => {
      if (expandedItem === itemId) {
        setExpandedItem(null)
        setEditingReply('')
      } else {
        setExpandedItem(itemId)
        setEditingReply(suggestedReply ?? '')
      }
    },
    [expandedItem]
  )

  // Toggle topic
  const toggleTopic = useCallback((idx: number) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }, [])

  // Select channel
  const handleSelectChannel = useCallback(
    (channel: Channel) => {
      setSelectedChannel(channel)
      setSidebarOpen(false)
      if (!showSampleData) {
        setSummaryData(null)
        setActionItems([])
        setError(null)
      }
    },
    [showSampleData]
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        <div
          className="min-h-screen flex flex-col"
          style={{
            background:
              'linear-gradient(135deg, hsl(210 20% 97%) 0%, hsl(220 25% 95%) 35%, hsl(200 20% 96%) 70%, hsl(230 15% 97%) 100%)',
          }}
        >
          {/* ── Top Header ── */}
          <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-border/50 backdrop-blur-[16px] bg-white/60 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <HiMenuAlt2 className="w-5 h-5 text-foreground" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <HiChat className="w-4 h-4 text-primary-foreground" />
                </div>
                <h1 className="text-base font-semibold text-foreground">
                  SlackPulse
                </h1>
              </div>
              <span className="hidden sm:inline-flex text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                Workspace
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs text-muted-foreground">
                  Sample Data
                </span>
                <button
                  role="switch"
                  aria-checked={showSampleData}
                  onClick={() => setShowSampleData(!showSampleData)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${showSampleData ? 'bg-primary' : 'bg-slate-300'}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${showSampleData ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
                  />
                </button>
              </label>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            {/* ── Sidebar Overlay (mobile) ── */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/20 z-20 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* ── Sidebar ── */}
            <aside
              className={`fixed md:relative z-20 md:z-0 top-14 md:top-0 bottom-0 left-0 w-[320px] flex-shrink-0 border-r border-border/50 backdrop-blur-[16px] bg-white/70 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
            >
              {/* Search */}
              <div className="p-4 space-y-3">
                <div className="relative">
                  <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search channels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50/60 border border-border/50 rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-400/30 transition-colors"
                  />
                </div>

                {/* Filters */}
                <div className="flex gap-1">
                  {(['all', 'public', 'private'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setChannelFilter(f)}
                      className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-full transition-colors duration-200 capitalize ${channelFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-slate-200/60'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Fetch Channels Button */}
                <button
                  onClick={handleFetchChannels}
                  disabled={fetchingChannels}
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fetchingChannels ? (
                    <>
                      <HiRefresh className="w-3.5 h-3.5 animate-spin" />
                      Fetching Channels...
                    </>
                  ) : (
                    <>
                      <HiDownload className="w-3.5 h-3.5" />
                      {channelsFetched ? 'Refresh Slack Channels' : 'Fetch Slack Channels'}
                    </>
                  )}
                </button>

                {/* Channel Fetch Status */}
                {channelsFetched && liveChannels.length > 0 && !showSampleData && (
                  <div className="flex items-center gap-1.5 text-[11px] text-green-600 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg">
                    <HiGlobe className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{liveChannels.length} live channels loaded</span>
                  </div>
                )}
                {channelFetchError && (
                  <div className="flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg">
                    <HiExclamation className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{channelFetchError}</span>
                  </div>
                )}
              </div>

              {/* Channel List */}
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {fetchingChannels ? (
                  <div className="space-y-1 px-1">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                        <div className="w-4 h-4 bg-muted rounded flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 bg-muted rounded w-3/4" />
                          <div className="h-2.5 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredChannels.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No channels found
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredChannels.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => handleSelectChannel(ch)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-150 ${selectedChannel?.id === ch.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-slate-100/60'}`}
                      >
                        <div className="flex-shrink-0">
                          {ch.is_private ? (
                            <HiLockClosed className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <HiHashtag className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {ch.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="inline-flex items-center gap-0.5">
                              <HiUserGroup className="w-3 h-3" />
                              {ch.member_count}
                            </span>
                            <span className="inline-flex items-center gap-0.5">
                              <HiClock className="w-3 h-3" />
                              {ch.last_activity}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Agent Status */}
              <div className="p-3 border-t border-border/50">
                <AgentStatusBar activeAgentId={activeAgentId} />
              </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 overflow-y-auto">
              {/* Success Message */}
              {successMessage && (
                <div className="mx-4 md:mx-6 mt-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-[0.875rem] text-sm">
                  <HiCheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{successMessage}</span>
                  <button
                    onClick={() => setSuccessMessage(null)}
                    className="ml-auto"
                  >
                    <HiX className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mx-4 md:mx-6 mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-[0.875rem] text-sm">
                  <HiExclamation className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto"
                  >
                    <HiX className="w-4 h-4" />
                  </button>
                </div>
              )}

              {!selectedChannel ? (
                /* ── Welcome State ── */
                <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
                  <div className="text-center max-w-sm px-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                      <HiChat className="w-8 h-8 text-primary/60" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      Welcome to SlackPulse
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Select a channel from the sidebar and click Summarize to
                      get AI-powered insights, identify action items, and reply
                      directly from here.
                    </p>
                    <div className="mt-4">
                      <button
                        onClick={() => setSidebarOpen(true)}
                        className="md:hidden inline-flex items-center gap-1.5 text-sm font-medium text-primary-foreground bg-primary px-4 py-2 rounded-full"
                      >
                        <HiMenuAlt2 className="w-4 h-4" />
                        Open Channels
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Channel Content ── */
                <div className="p-4 md:p-6 space-y-6">
                  {/* Channel Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      {selectedChannel.is_private ? (
                        <HiLockClosed className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <HiHashtag className="w-5 h-5 text-muted-foreground" />
                      )}
                      <h2 className="text-xl font-semibold text-foreground">
                        {selectedChannel.name}
                      </h2>
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                        {selectedChannel.member_count} members
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Time Range Selector */}
                      <div className="relative" ref={timeRangeRef}>
                        <button
                          onClick={() => setTimeDropdownOpen(!timeDropdownOpen)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-white border border-border px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <HiClock className="w-3.5 h-3.5 text-muted-foreground" />
                          {timeRange}
                          <HiChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        {timeDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
                            {TIME_OPTIONS.map((option) => (
                              <button
                                key={option}
                                onClick={() => {
                                  setTimeRange(option)
                                  setTimeDropdownOpen(false)
                                }}
                                className={`w-full text-left text-xs px-3 py-2 hover:bg-slate-50 transition-colors ${timeRange === option ? 'font-medium text-primary' : 'text-foreground'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Summarize Button */}
                      <button
                        onClick={handleSummarize}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <HiRefresh
                          className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                        />
                        {loading ? 'Summarizing...' : 'Summarize Channel'}
                      </button>
                    </div>
                  </div>

                  {/* Loading State */}
                  {loading && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      <div className="lg:col-span-3">
                        <div className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-[0.875rem] shadow-md p-6">
                          <SkeletonLoader />
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <div className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-[0.875rem] shadow-md p-6">
                          <SkeletonLoader />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary & Action Items */}
                  {!loading && summaryData && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* ── Summary Panel (3/5 ~ 60%) ── */}
                      <div className="lg:col-span-3 space-y-4">
                        {/* Stats Bar */}
                        <div className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-[0.875rem] shadow-md p-5">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                Messages
                              </p>
                              <p className="text-2xl font-semibold text-foreground mt-0.5">
                                {summaryData?.summary?.total_messages ?? 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                Topics
                              </p>
                              <p className="text-2xl font-semibold text-foreground mt-0.5">
                                {Array.isArray(summaryData?.summary?.topics)
                                  ? summaryData.summary.topics.length
                                  : 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                Flagged Items
                              </p>
                              <p className="text-2xl font-semibold text-foreground mt-0.5">
                                {summaryData?.total_flagged_items ?? 0}
                              </p>
                            </div>
                          </div>

                          {/* Most Active Participants */}
                          {Array.isArray(
                            summaryData?.summary?.most_active_participants
                          ) &&
                            summaryData.summary.most_active_participants
                              .length > 0 && (
                              <div className="mt-4 pt-4 border-t border-border/50">
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                  Most Active
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {summaryData.summary.most_active_participants.map(
                                    (p, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full"
                                      >
                                        <HiUserGroup className="w-3 h-3" />
                                        {p}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>

                        {/* Overall Summary */}
                        {summaryData?.summary?.overall_summary && (
                          <div className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-[0.875rem] shadow-md p-5">
                            <h3 className="text-sm font-semibold text-foreground mb-3">
                              Overall Summary
                            </h3>
                            <div className="text-sm text-foreground/80 leading-relaxed">
                              {renderMarkdown(
                                summaryData.summary.overall_summary
                              )}
                            </div>
                          </div>
                        )}

                        {/* Topics */}
                        {Array.isArray(summaryData?.summary?.topics) &&
                          summaryData.summary.topics.length > 0 && (
                            <div className="space-y-2">
                              <h3 className="text-sm font-semibold text-foreground px-1">
                                Topics ({summaryData.summary.topics.length})
                              </h3>
                              {summaryData.summary.topics.map((topic, idx) => (
                                <TopicCard
                                  key={idx}
                                  topic={topic}
                                  isExpanded={expandedTopics.has(idx)}
                                  onToggle={() => toggleTopic(idx)}
                                />
                              ))}
                            </div>
                          )}
                      </div>

                      {/* ── Action Items Panel (2/5 ~ 40%) ── */}
                      <div className="lg:col-span-2 space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-sm font-semibold text-foreground">
                            Action Items
                            {actionItems.length > 0 && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                ({actionItems.length})
                              </span>
                            )}
                          </h3>
                          {actionItems.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {actionItems.filter((i) => i?.replied).length}{' '}
                              replied
                            </span>
                          )}
                        </div>

                        {actionItems.length === 0 ? (
                          <div className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-[0.875rem] shadow-md p-6 text-center">
                            <HiCheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              No action items found
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {actionItems.map((item) => (
                              <ActionItemCard
                                key={item?.id ?? ''}
                                item={item}
                                isExpanded={expandedItem === item?.id}
                                onToggle={() =>
                                  handleExpandItem(
                                    item?.id ?? '',
                                    item?.suggested_reply ?? ''
                                  )
                                }
                                editingReply={
                                  expandedItem === item?.id
                                    ? editingReply
                                    : ''
                                }
                                setEditingReply={setEditingReply}
                                onSendReply={() =>
                                  handleSendReply(item, editingReply)
                                }
                                isSending={sendingReply === item?.id}
                                onDiscard={() => {
                                  setExpandedItem(null)
                                  setEditingReply('')
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Empty state when channel is selected but not summarized */}
                  {!loading && !summaryData && (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center max-w-xs">
                        <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4">
                          <HiSearch className="w-7 h-7 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">
                          Ready to Analyze
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Click{' '}
                          <strong className="text-foreground">
                            Summarize Channel
                          </strong>{' '}
                          to get AI-powered insights for #{selectedChannel.name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
