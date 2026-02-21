'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import {
  FiEdit3, FiUser, FiArrowLeft, FiCopy, FiCheck, FiChevronDown, FiChevronUp,
  FiTarget, FiStar, FiAlertTriangle, FiTrendingUp, FiBarChart2, FiBookOpen,
  FiZap, FiBriefcase, FiActivity, FiRefreshCw, FiShare2, FiAward, FiMessageCircle,
  FiThumbsUp, FiLayers
} from 'react-icons/fi'

// ---- Types ----
interface PostRoastResult {
  roast_text: string
  cringe_score: number
  cringe_patterns: Array<{ pattern: string; severity: number }>
  storytelling_rewrite: { title: string; content: string; hook: string }
  data_driven_rewrite: { title: string; content: string; hook: string }
  engagement_predictions: {
    original: { likes: string; comments: string; shares: string; score: number; reasoning: string }
    storytelling: { likes: string; comments: string; shares: string; score: number; reasoning: string }
    data_driven: { likes: string; comments: string; shares: string; score: number; reasoning: string }
  }
  improvement_summary: string
}

interface ProfileRoastResult {
  overall_score: number
  grade: string
  master_roast: string
  sections: {
    headline: { score: number; roast: string; improvements: string[] }
    about: { score: number; roast: string; improved_version: string }
    experience: { score: number; roast: string; improvements: string[] }
    skills: { score: number; roast: string; improvements: string[] }
  }
  action_plan: Array<{ step: number; title: string; description: string; priority: string }>
  strongest_section: string
  weakest_section: string
}

type ScreenState = 'landing' | 'post-input' | 'profile-input' | 'post-loading' | 'profile-loading' | 'post-results' | 'profile-results'

// ---- Constants ----
const POST_AGENT_ID = '699960c41b86f70befdb2390'
const PROFILE_AGENT_ID = '699960c4730bbd74d53e899f'

const THEME = {
  bg: '#120708',
  fg: '#F5F0F1',
  card: '#1A0B0D',
  cardFg: '#F5F0F1',
  primary: '#F5F0F1',
  primaryFg: '#211214',
  secondary: '#261517',
  secondaryFg: '#F5F0F1',
  accent: '#BD2D55',
  accentFg: '#FBF9FA',
  muted: '#2E1A1D',
  mutedFg: '#A38A8E',
  border: '#2E1A1D',
  input: '#3D2326',
  ring: '#BD2D55',
  chart1: '#D94068',
  chart2: '#CC3380',
  chart3: '#D9604A',
  chart4: '#CC4DA3',
  chart5: '#D94D4D',
} as const

const POST_LOADING_MESSAGES = [
  'Scanning for cringe patterns...',
  'Calculating engagement potential...',
  'Dissecting your word choices...',
  'Measuring LinkedIn buzzword density...',
  'Writing your personalized roast...',
  'Crafting better versions of your post...',
  'Rating your humblebragging skills...',
  'Analyzing thought-leader vibes...',
]

const PROFILE_LOADING_MESSAGES = [
  'Analyzing your headline...',
  'Reading your about section...',
  'Reviewing your experience...',
  'Evaluating your skills...',
  'Grading your overall profile...',
  'Writing your master roast...',
  'Building your improvement plan...',
  'Checking for corporate jargon overdose...',
]

const SAMPLE_POST_RESULT: PostRoastResult = {
  roast_text: "Oh, another 'I\'m excited to announce' post. How groundbreaking. You managed to combine a humble brag, three LinkedIn buzzwords, and a call-to-action so desperate it practically begs for engagement like a puppy at a barbecue. The excessive use of 'leveraging synergies' made my AI circuits cringe so hard they almost short-circuited.",
  cringe_score: 7,
  cringe_patterns: [
    { pattern: "Starting with 'I'm excited to announce' -- the most overused LinkedIn opener since the dawn of time", severity: 8 },
    { pattern: "Humble bragging about awards while pretending to be grateful", severity: 6 },
    { pattern: "Using 'synergy' unironically in 2025", severity: 9 },
    { pattern: "Ending with 'Agree?' to fish for comments", severity: 7 },
  ],
  storytelling_rewrite: {
    title: "The Story Version",
    hook: "Three years ago, I almost quit my career. Here's what changed everything.",
    content: "Three years ago, I almost quit my career. Here's what changed everything.\n\nI was sitting in a meeting where someone said 'let's leverage our synergies' for the third time that day. I snapped.\n\nInstead of quitting, I decided to actually DO something different. I started measuring real impact instead of throwing buzzwords at walls.\n\nThe result? Our team's output tripled. Not because of synergy -- because we finally talked like humans.\n\nIf your posts sound like a corporate word salad, try this: Write like you're telling a friend at a coffee shop. Your engagement will thank you."
  },
  data_driven_rewrite: {
    title: "The Data-Driven Version",
    hook: "87% of LinkedIn posts get zero engagement. Here's why yours might be one of them.",
    content: "87% of LinkedIn posts get zero engagement. Here's why yours might be one of them.\n\nI analyzed 500 LinkedIn posts from my network last month. The findings:\n\n- Posts starting with 'I'm excited to announce': 2.3x LESS engagement\n- Posts with corporate jargon: 45% lower comment rate\n- Posts telling a genuine story: 4.1x MORE shares\n\nThe data is clear: authenticity beats corporate speak every single time.\n\nHere are 3 changes that boosted my post engagement by 312%:\n1. Replace announcements with lessons learned\n2. Use specific numbers instead of vague claims\n3. Write at a 6th-grade reading level\n\nWhich of these surprises you most?"
  },
  engagement_predictions: {
    original: { likes: "15-30", comments: "2-5", shares: "0-1", score: 25, reasoning: "Generic corporate tone limits reach" },
    storytelling: { likes: "120-250", comments: "25-50", shares: "10-20", score: 78, reasoning: "Personal story creates emotional connection" },
    data_driven: { likes: "200-400", comments: "40-80", shares: "20-40", score: 88, reasoning: "Specific data points drive curiosity and shares" },
  },
  improvement_summary: "Your original post suffered from corporate jargon overload and a generic opener. Both rewrites transform it into engaging content by either leading with a personal story or backing claims with specific data. The key improvements: authentic voice, specific examples, and hooks that create curiosity rather than announce achievements."
}

const SAMPLE_PROFILE_RESULT: ProfileRoastResult = {
  overall_score: 42,
  grade: "C-",
  master_roast: "Your LinkedIn profile reads like it was generated by a corporate buzzword AI from 2015. Your headline could belong to literally any of the 900 million LinkedIn users. Your about section is a masterclass in saying absolutely nothing while using the maximum number of words. Your experience section lists responsibilities when it should scream achievements. And your skills? You listed 'Microsoft Office' in 2025. Let that sink in.",
  sections: {
    headline: {
      score: 35,
      roast: "Your headline says 'Marketing Professional | Passionate about Growth'. Congratulations, you just described every marketer who ever lived. Your headline is so generic that if I searched it on LinkedIn, I'd get approximately 47,000 results.",
      improvements: [
        "Growth Marketing Lead | Turned $50K ad spend into $2M revenue at Series B startups",
        "B2B Marketing Strategist | 3x pipeline growth specialist | Ex-HubSpot",
        "Marketing Leader Who Actually Measures ROI | Helped 12 startups hit $1M ARR"
      ]
    },
    about: {
      score: 38,
      roast: "Your about section is a wall of text that begins with 'I am a results-driven professional.' You know who else says that? Everyone. Your summary reads like a cover letter from 2010. No numbers, no stories, no proof of anything you claim.",
      improved_version: "I help B2B startups turn marketing from a cost center into a revenue engine.\n\nIn the last 3 years, I've:\n- Grown pipeline from $500K to $5M at two different startups\n- Built content strategies that generated 10K+ organic leads/month\n- Reduced CAC by 60% through data-driven channel optimization\n\nMy approach is simple: test fast, measure everything, kill what doesn't work.\n\nCurrently open to fractional CMO roles at Series A-C startups.\nLet's talk: your-email@example.com"
    },
    experience: {
      score: 50,
      roast: "Your experience section reads like a job description copy-paste. 'Managed marketing campaigns' tells me nothing. WHAT campaigns? WHAT results? Your bullet points are the LinkedIn equivalent of a blank stare.",
      improvements: [
        "Replace 'managed campaigns' with specific results: 'Led 15 multi-channel campaigns generating $3.2M in pipeline'",
        "Add metrics to every bullet point -- numbers are the language of credibility",
        "Start each bullet with a power verb: 'Architected', 'Spearheaded', 'Transformed'"
      ]
    },
    skills: {
      score: 45,
      roast: "You listed 'Microsoft Office' and 'Communication Skills' as your top skills. In 2025. That's like listing 'can use a telephone' on your resume. Your skills section is a graveyard of generic competencies that tell recruiters absolutely nothing about your actual expertise.",
      improvements: [
        "Replace generic skills with specific tools: 'HubSpot Marketing Hub', 'Google Analytics 4', 'Salesforce Marketing Cloud'",
        "Add trending skills in your field: 'AI-Powered Marketing Automation', 'Product-Led Growth', 'Revenue Attribution'",
        "Remove outdated skills and focus on your top 10 most relevant, in-demand capabilities"
      ]
    }
  },
  action_plan: [
    { step: 1, title: "Rewrite Your Headline Today", description: "Replace your generic headline with one that includes specific results and your unique value proposition. Use the format: [Role] | [Specific Achievement] | [Notable Company/Niche]", priority: "high" },
    { step: 2, title: "Overhaul Your About Section", description: "Replace the corporate monologue with the improved version provided. Add 3-5 specific metrics that prove your claims. End with a clear CTA.", priority: "high" },
    { step: 3, title: "Add Metrics to Experience", description: "Go through each role and add at least 2 quantified achievements. Revenue generated, costs saved, growth percentages -- numbers build trust.", priority: "medium" }
  ],
  strongest_section: "Experience",
  weakest_section: "Headline"
}

// ---- Helpers ----
function parseAgentResult(result: any): any {
  let data = result?.response?.result
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { /* keep as string */ }
  }
  if (data && typeof data === 'object' && 'result' in data && !('roast_text' in data) && !('master_roast' in data)) {
    data = data.result
  }
  return data
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

function getCringeColor(score: number): string {
  if (score <= 3) return '#4ade80'
  if (score <= 5) return '#facc15'
  if (score <= 7) return '#fb923c'
  return '#ef4444'
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#4ade80'
  if (score >= 60) return '#facc15'
  if (score >= 40) return '#fb923c'
  return '#ef4444'
}

function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return '#4ade80'
  if (grade.startsWith('B')) return '#22d3ee'
  if (grade.startsWith('C')) return '#facc15'
  if (grade.startsWith('D')) return '#fb923c'
  return '#ef4444'
}

function getPriorityColor(priority: string): string {
  const p = priority?.toLowerCase() ?? ''
  if (p === 'high') return THEME.chart1
  if (p === 'medium') return '#facc15'
  return '#4ade80'
}

function getSeverityWidth(severity: number): string {
  return `${Math.min(Math.max(severity, 0), 10) * 10}%`
}

// ---- Sub-components ----

function ScoreCircle({ score, size = 120, color, label }: { score: number; size?: number; color: string; label?: string }) {
  const [animatedScore, setAnimatedScore] = useState(0)
  useEffect(() => {
    let start = 0
    const end = score
    if (end === start) return
    const duration = 1200
    const stepTime = 20
    const steps = duration / stepTime
    const increment = (end - start) / steps
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setAnimatedScore(end)
        clearInterval(timer)
      } else {
        setAnimatedScore(Math.round(start))
      }
    }, stepTime)
    return () => clearInterval(timer)
  }, [score])

  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedScore / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={THEME.muted} strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="font-serif font-bold text-2xl" style={{ color }}>{animatedScore}</span>
        {label && <span className="text-xs" style={{ color: THEME.mutedFg }}>{label}</span>}
      </div>
    </div>
  )
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
      style={{ background: copied ? '#4ade8033' : THEME.secondary, color: copied ? '#4ade80' : THEME.mutedFg, border: `1px solid ${copied ? '#4ade8044' : THEME.border}` }}
    >
      {copied ? <FiCheck className="w-3.5 h-3.5" /> : <FiCopy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

function ExpandableSection({ title, icon, score, children, defaultOpen = false }: { title: string; icon: React.ReactNode; score?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl overflow-hidden transition-all duration-300" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left transition-colors duration-200"
        style={{ color: THEME.fg }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: THEME.accent }}>{icon}</span>
          <span className="font-serif font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {score !== undefined && (
            <span className="text-sm font-medium px-2 py-0.5 rounded-md" style={{ background: `${getScoreColor(score)}22`, color: getScoreColor(score) }}>
              {score}/100
            </span>
          )}
          {open ? <FiChevronUp className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
        </div>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '2000px' : '0', opacity: open ? 1 : 0 }}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}

function EngagementCard({ title, data, color, best }: { title: string; data: { likes: string; comments: string; shares: string; score: number; reasoning: string }; color: string; best?: boolean }) {
  return (
    <div className="rounded-xl p-4 relative overflow-hidden transition-all duration-300 hover:scale-[1.02]" style={{ background: THEME.card, border: `1px solid ${best ? color : THEME.border}`, boxShadow: best ? `0 0 20px ${color}33` : 'none' }}>
      {best && (
        <div className="absolute top-0 right-0 px-2 py-0.5 rounded-bl-lg text-xs font-semibold" style={{ background: color, color: '#fff' }}>
          Best
        </div>
      )}
      <h4 className="font-serif font-semibold text-sm mb-3" style={{ color }}>{title}</h4>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: THEME.mutedFg }}><FiThumbsUp className="w-3 h-3" /> Likes</span>
          <span className="text-sm font-medium" style={{ color: THEME.fg }}>{data?.likes ?? '--'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: THEME.mutedFg }}><FiMessageCircle className="w-3 h-3" /> Comments</span>
          <span className="text-sm font-medium" style={{ color: THEME.fg }}>{data?.comments ?? '--'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: THEME.mutedFg }}><FiShare2 className="w-3 h-3" /> Shares</span>
          <span className="text-sm font-medium" style={{ color: THEME.fg }}>{data?.shares ?? '--'}</span>
        </div>
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${THEME.border}` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium" style={{ color: THEME.mutedFg }}>Engagement Score</span>
            <span className="text-lg font-bold" style={{ color }}>{data?.score ?? 0}</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: THEME.muted }}>
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${data?.score ?? 0}%`, background: color }} />
          </div>
        </div>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: THEME.mutedFg }}>{data?.reasoning ?? ''}</p>
      </div>
    </div>
  )
}

function AgentStatusBar({ activeAgentId }: { activeAgentId: string | null }) {
  const agents = [
    { id: POST_AGENT_ID, name: 'Post Roast Agent', purpose: 'Analyzes and roasts LinkedIn post drafts' },
    { id: PROFILE_AGENT_ID, name: 'Profile Roast Agent', purpose: 'Analyzes and roasts LinkedIn profiles' },
  ]
  return (
    <div className="rounded-xl p-4" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: THEME.mutedFg }}>AI Agents</h3>
      <div className="space-y-2">
        {agents.map((a) => (
          <div key={a.id} className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: activeAgentId === a.id ? THEME.accent : THEME.muted, boxShadow: activeAgentId === a.id ? `0 0 8px ${THEME.accent}` : 'none' }} />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium block truncate" style={{ color: activeAgentId === a.id ? THEME.fg : THEME.mutedFg }}>{a.name}</span>
              <span className="text-xs block truncate" style={{ color: THEME.mutedFg }}>{a.purpose}</span>
            </div>
            {activeAgentId === a.id && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${THEME.accent}22`, color: THEME.accent }}>Active</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- ErrorBoundary ----
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
        <div className="min-h-screen flex items-center justify-center" style={{ background: THEME.bg, color: THEME.fg }}>
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm mb-4" style={{ color: THEME.mutedFg }}>{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: THEME.accent, color: THEME.accentFg }}>
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---- Main Page ----
export default function Page() {
  const [screen, setScreen] = useState<ScreenState>('landing')
  const [postDraft, setPostDraft] = useState('')
  const [profileData, setProfileData] = useState({ headline: '', about: '', experience: '', skills: '' })
  const [postResult, setPostResult] = useState<PostRoastResult | null>(null)
  const [profileResult, setProfileResult] = useState<ProfileRoastResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [sampleData, setSampleData] = useState(false)

  // Loading message cycling
  useEffect(() => {
    if (screen !== 'post-loading' && screen !== 'profile-loading') return
    const messages = screen === 'post-loading' ? POST_LOADING_MESSAGES : PROFILE_LOADING_MESSAGES
    let idx = 0
    setLoadingMsg(messages[0])
    const interval = setInterval(() => {
      idx = (idx + 1) % messages.length
      setLoadingMsg(messages[idx])
    }, 2500)
    return () => clearInterval(interval)
  }, [screen])

  // Sample data toggle
  useEffect(() => {
    if (sampleData) {
      if (screen === 'landing') {
        // Do nothing on landing
      } else if (screen === 'post-input') {
        setPostDraft("I'm excited to announce that I've been recognized as a Top Voice in leveraging synergies for cross-functional paradigm shifts! This journey has been incredible, and I'm so grateful for every opportunity to disrupt the industry.\n\nKey takeaways from my experience:\n- Always leverage your network\n- Synergy is the key to success\n- Think outside the box\n\nAgree? Drop a comment below!")
      } else if (screen === 'profile-input') {
        setProfileData({
          headline: 'Marketing Professional | Passionate about Growth',
          about: 'I am a results-driven professional with over 10 years of experience in marketing. I am passionate about leveraging innovative strategies to drive growth and deliver exceptional results. I thrive in fast-paced environments and am always looking for new challenges.',
          experience: 'Marketing Manager at TechCorp (2020-Present)\n- Managed marketing campaigns\n- Collaborated with cross-functional teams\n- Developed marketing strategies\n\nMarketing Coordinator at StartupXYZ (2017-2020)\n- Assisted with marketing efforts\n- Created content for social media\n- Supported the marketing team',
          skills: 'Marketing, Microsoft Office, Communication Skills, Team Player, Social Media, Leadership, Problem Solving, Strategic Planning',
        })
      } else if (screen === 'post-results' && !postResult) {
        setPostResult(SAMPLE_POST_RESULT)
      } else if (screen === 'profile-results' && !profileResult) {
        setProfileResult(SAMPLE_PROFILE_RESULT)
      }
    }
  }, [sampleData, screen, postResult, profileResult])

  const handlePostRoast = useCallback(async () => {
    if (postDraft.length < 50) return
    setError(null)
    setScreen('post-loading')
    setActiveAgentId(POST_AGENT_ID)
    try {
      const result = await callAIAgent(
        `Please roast and analyze this LinkedIn post draft:\n\n${postDraft}`,
        POST_AGENT_ID
      )
      if (result.success) {
        const data = parseAgentResult(result)
        if (data && typeof data === 'object' && ('roast_text' in data || 'cringe_score' in data)) {
          setPostResult(data as PostRoastResult)
          setScreen('post-results')
        } else {
          setError('Unexpected response format from the agent. Please try again.')
          setScreen('post-input')
        }
      } else {
        setError(result.error ?? 'Failed to get a response. Please try again.')
        setScreen('post-input')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.')
      setScreen('post-input')
    } finally {
      setActiveAgentId(null)
    }
  }, [postDraft])

  const handleProfileRoast = useCallback(async () => {
    if (!profileData.headline.trim()) return
    setError(null)
    setScreen('profile-loading')
    setActiveAgentId(PROFILE_AGENT_ID)
    try {
      const message = `Please roast and analyze this LinkedIn profile:\n\nHeadline: ${profileData.headline}\n\nAbout/Summary: ${profileData.about || 'Not provided'}\n\nExperience: ${profileData.experience || 'Not provided'}\n\nSkills: ${profileData.skills || 'Not provided'}`
      const result = await callAIAgent(message, PROFILE_AGENT_ID)
      if (result.success) {
        const data = parseAgentResult(result)
        if (data && typeof data === 'object' && ('master_roast' in data || 'overall_score' in data)) {
          setProfileResult(data as ProfileRoastResult)
          setScreen('profile-results')
        } else {
          setError('Unexpected response format from the agent. Please try again.')
          setScreen('profile-input')
        }
      } else {
        setError(result.error ?? 'Failed to get a response. Please try again.')
        setScreen('profile-input')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.')
      setScreen('profile-input')
    } finally {
      setActiveAgentId(null)
    }
  }, [profileData])

  // ---- Landing Screen ----
  function LandingScreen() {
    const features = [
      { icon: <FiZap className="w-5 h-5" />, title: 'Brutal Honesty', desc: 'No sugar-coating. Get the raw truth about your LinkedIn content.' },
      { icon: <FiTrendingUp className="w-5 h-5" />, title: 'Engagement Predictions', desc: 'See how your post will actually perform with predicted metrics.' },
      { icon: <FiBookOpen className="w-5 h-5" />, title: 'Smart Rewrites', desc: 'Get storytelling and data-driven versions that actually work.' },
      { icon: <FiTarget className="w-5 h-5" />, title: 'Cringe Detection', desc: 'We find every humble brag, buzzword, and cliche in your content.' },
      { icon: <FiBarChart2 className="w-5 h-5" />, title: 'Section Scoring', desc: 'Every part of your profile gets scored and roasted individually.' },
      { icon: <FiAward className="w-5 h-5" />, title: 'Action Plans', desc: 'Step-by-step improvements ranked by priority and impact.' },
    ]
    return (
      <div className="min-h-screen flex flex-col">
        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6" style={{ background: `${THEME.accent}22`, color: THEME.accent, border: `1px solid ${THEME.accent}33` }}>
            <FiActivity className="w-3.5 h-3.5" />
            AI-Powered LinkedIn Feedback
          </div>
          <h1 className="font-serif font-bold text-4xl md:text-6xl lg:text-7xl mb-4 tracking-tight" style={{ color: THEME.fg, letterSpacing: '-0.02em' }}>
            RoastMyPost <span style={{ color: THEME.accent }}>AI</span>
          </h1>
          <p className="text-base md:text-lg max-w-xl mb-10 leading-relaxed" style={{ color: THEME.mutedFg }}>
            Get brutally honest feedback on your LinkedIn posts and profile. No more cringe. No more corporate jargon. Just content that actually works.
          </p>

          {/* CTA Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-16">
            <button
              onClick={() => { setScreen('post-input'); setError(null) }}
              className="group rounded-xl p-6 text-left transition-all duration-300 hover:scale-[1.03]"
              style={{ background: THEME.card, border: `1px solid ${THEME.border}`, boxShadow: `0 4px 24px ${THEME.bg}` }}
            >
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors duration-300" style={{ background: `${THEME.accent}22` }}>
                <FiEdit3 className="w-6 h-6" style={{ color: THEME.accent }} />
              </div>
              <h3 className="font-serif font-semibold text-lg mb-2" style={{ color: THEME.fg }}>Roast My Post Draft</h3>
              <p className="text-sm leading-relaxed" style={{ color: THEME.mutedFg }}>
                Paste your LinkedIn post draft and get a savage roast, cringe score, and two rewritten versions with engagement predictions.
              </p>
            </button>
            <button
              onClick={() => { setScreen('profile-input'); setError(null) }}
              className="group rounded-xl p-6 text-left transition-all duration-300 hover:scale-[1.03]"
              style={{ background: THEME.card, border: `1px solid ${THEME.border}`, boxShadow: `0 4px 24px ${THEME.bg}` }}
            >
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors duration-300" style={{ background: `${THEME.accent}22` }}>
                <FiUser className="w-6 h-6" style={{ color: THEME.accent }} />
              </div>
              <h3 className="font-serif font-semibold text-lg mb-2" style={{ color: THEME.fg }}>Roast My Profile</h3>
              <p className="text-sm leading-relaxed" style={{ color: THEME.mutedFg }}>
                Enter your headline, about, experience, and skills to get a comprehensive profile roast with an action plan.
              </p>
            </button>
          </div>

          {/* Features */}
          <div className="w-full max-w-4xl">
            <h2 className="font-serif font-semibold text-xl mb-6" style={{ color: THEME.fg }}>What You Get</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {features.map((f, i) => (
                <div key={i} className="rounded-xl p-4 transition-all duration-200 hover:scale-[1.02]" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <span style={{ color: THEME.accent }}>{f.icon}</span>
                    <h3 className="font-semibold text-sm" style={{ color: THEME.fg }}>{f.title}</h3>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: THEME.mutedFg }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Social proof */}
          <div className="flex flex-wrap items-center justify-center gap-8 mt-12">
            {[
              { value: '10,000+', label: 'Posts Roasted' },
              { value: '4,200+', label: 'Profiles Analyzed' },
              { value: '92%', label: 'Engagement Boost' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="font-serif font-bold text-2xl" style={{ color: THEME.accent }}>{s.value}</div>
                <div className="text-xs" style={{ color: THEME.mutedFg }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Status */}
        <div className="px-4 pb-6 max-w-4xl mx-auto w-full">
          <AgentStatusBar activeAgentId={activeAgentId} />
        </div>
      </div>
    )
  }

  // ---- Post Input Screen ----
  function PostInputScreen() {
    const charCount = postDraft.length
    const isValid = charCount >= 50
    return (
      <div className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto w-full">
        <button onClick={() => { setScreen('landing'); setError(null) }} className="inline-flex items-center gap-2 text-sm mb-8 transition-colors duration-200" style={{ color: THEME.mutedFg }}>
          <FiArrowLeft className="w-4 h-4" /> Back to home
        </button>

        <div className="mb-6">
          <h1 className="font-serif font-bold text-2xl md:text-3xl mb-2" style={{ color: THEME.fg }}>Roast My Post Draft</h1>
          <p className="text-sm" style={{ color: THEME.mutedFg }}>Paste your LinkedIn post draft below for a brutally honest critique.</p>
        </div>

        <div className="rounded-xl p-1 mb-2" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
          <textarea
            value={postDraft}
            onChange={(e) => setPostDraft(e.target.value.slice(0, 3000))}
            placeholder="Paste your LinkedIn post draft here... (minimum 50 characters)"
            className="w-full min-h-[240px] p-4 rounded-lg text-sm leading-relaxed resize-y focus:outline-none placeholder-opacity-50"
            style={{ background: THEME.input, color: THEME.fg, border: 'none' }}
          />
        </div>
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs" style={{ color: charCount < 50 ? THEME.chart5 : THEME.mutedFg }}>
            {charCount < 50 ? `${50 - charCount} more characters needed` : 'Ready to roast'}
          </span>
          <span className="text-xs" style={{ color: charCount > 2800 ? THEME.chart3 : THEME.mutedFg }}>
            {charCount}/3,000
          </span>
        </div>

        {error && (
          <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: `${THEME.chart5}15`, color: THEME.chart5, border: `1px solid ${THEME.chart5}33` }}>
            <FiAlertTriangle className="w-4 h-4 inline mr-2" />{error}
          </div>
        )}

        <button
          onClick={handlePostRoast}
          disabled={!isValid}
          className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200"
          style={{
            background: isValid ? THEME.accent : THEME.muted,
            color: isValid ? THEME.accentFg : THEME.mutedFg,
            cursor: isValid ? 'pointer' : 'not-allowed',
            opacity: isValid ? 1 : 0.6,
          }}
        >
          <FiZap className="w-4 h-4" /> Roast This Post
        </button>

        {/* Tips */}
        <div className="mt-8 rounded-xl p-5" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
          <h3 className="font-serif font-semibold text-sm mb-3" style={{ color: THEME.fg }}>Tips for Best Results</h3>
          <ul className="space-y-2">
            {[
              'Paste the complete post, including any hashtags or calls to action',
              'Include the exact text you plan to publish -- do not summarize',
              'Longer posts give more material for a thorough roast',
              'The AI will analyze tone, structure, cringe level, and engagement potential',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: THEME.mutedFg }}>
                <FiStar className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: THEME.accent }} />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // ---- Profile Input Screen ----
  function ProfileInputScreen() {
    const isValid = profileData.headline.trim().length > 0
    return (
      <div className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto w-full">
        <button onClick={() => { setScreen('landing'); setError(null) }} className="inline-flex items-center gap-2 text-sm mb-8 transition-colors duration-200" style={{ color: THEME.mutedFg }}>
          <FiArrowLeft className="w-4 h-4" /> Back to home
        </button>

        <div className="mb-6">
          <h1 className="font-serif font-bold text-2xl md:text-3xl mb-2" style={{ color: THEME.fg }}>Roast My Profile</h1>
          <p className="text-sm" style={{ color: THEME.mutedFg }}>Enter your LinkedIn profile details for a comprehensive roast and improvement plan.</p>
        </div>

        <div className="space-y-5">
          {/* Headline */}
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: THEME.fg }}>
              Headline <span style={{ color: THEME.accent }}>*</span>
            </label>
            <input
              type="text"
              value={profileData.headline}
              onChange={(e) => setProfileData(prev => ({ ...prev, headline: e.target.value }))}
              placeholder="e.g., Marketing Manager | Growth Strategist"
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all duration-200"
              style={{ background: THEME.input, color: THEME.fg, border: `1px solid ${THEME.border}` }}
            />
          </div>

          {/* About */}
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: THEME.fg }}>About / Summary</label>
            <textarea
              value={profileData.about}
              onChange={(e) => setProfileData(prev => ({ ...prev, about: e.target.value }))}
              placeholder="Paste your LinkedIn summary/about section..."
              className="w-full min-h-[120px] px-4 py-3 rounded-xl text-sm leading-relaxed resize-y focus:outline-none"
              style={{ background: THEME.input, color: THEME.fg, border: `1px solid ${THEME.border}` }}
            />
          </div>

          {/* Experience */}
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: THEME.fg }}>Experience</label>
            <textarea
              value={profileData.experience}
              onChange={(e) => setProfileData(prev => ({ ...prev, experience: e.target.value }))}
              placeholder="List your roles, companies, and achievements..."
              className="w-full min-h-[120px] px-4 py-3 rounded-xl text-sm leading-relaxed resize-y focus:outline-none"
              style={{ background: THEME.input, color: THEME.fg, border: `1px solid ${THEME.border}` }}
            />
          </div>

          {/* Skills */}
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: THEME.fg }}>Skills</label>
            <textarea
              value={profileData.skills}
              onChange={(e) => setProfileData(prev => ({ ...prev, skills: e.target.value }))}
              placeholder="Comma-separated list of skills..."
              className="w-full min-h-[80px] px-4 py-3 rounded-xl text-sm leading-relaxed resize-y focus:outline-none"
              style={{ background: THEME.input, color: THEME.fg, border: `1px solid ${THEME.border}` }}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg p-3 mt-4 text-sm" style={{ background: `${THEME.chart5}15`, color: THEME.chart5, border: `1px solid ${THEME.chart5}33` }}>
            <FiAlertTriangle className="w-4 h-4 inline mr-2" />{error}
          </div>
        )}

        <button
          onClick={handleProfileRoast}
          disabled={!isValid}
          className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-6 transition-all duration-200"
          style={{
            background: isValid ? THEME.accent : THEME.muted,
            color: isValid ? THEME.accentFg : THEME.mutedFg,
            cursor: isValid ? 'pointer' : 'not-allowed',
            opacity: isValid ? 1 : 0.6,
          }}
        >
          <FiZap className="w-4 h-4" /> Roast This Profile
        </button>
      </div>
    )
  }

  // ---- Loading Screen ----
  function LoadingScreen() {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: `${THEME.accent}33` }} />
            <div className="absolute inset-2 rounded-full animate-pulse" style={{ background: `${THEME.accent}55` }} />
            <div className="absolute inset-4 rounded-full flex items-center justify-center" style={{ background: THEME.accent }}>
              <FiZap className="w-6 h-6" style={{ color: THEME.accentFg }} />
            </div>
          </div>
          <h2 className="font-serif font-bold text-xl mb-3" style={{ color: THEME.fg }}>
            {screen === 'post-loading' ? 'Roasting Your Post' : 'Roasting Your Profile'}
          </h2>
          <p className="text-sm mb-6 transition-opacity duration-500" style={{ color: THEME.mutedFg }}>
            {loadingMsg}
          </p>
          <div className="w-48 h-1.5 rounded-full mx-auto overflow-hidden" style={{ background: THEME.muted }}>
            <div className="h-full rounded-full animate-pulse" style={{ background: THEME.accent, width: '60%' }} />
          </div>
        </div>
      </div>
    )
  }

  // ---- Post Results Screen ----
  function PostResultsScreen() {
    const r = postResult
    if (!r) return null

    const predictions = r.engagement_predictions
    const origScore = predictions?.original?.score ?? 0
    const storyScore = predictions?.storytelling?.score ?? 0
    const dataScore = predictions?.data_driven?.score ?? 0
    const bestScore = Math.max(origScore, storyScore, dataScore)

    return (
      <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto w-full">
        <button onClick={() => { setScreen('post-input'); setError(null); setPostResult(null) }} className="inline-flex items-center gap-2 text-sm mb-8 transition-colors duration-200" style={{ color: THEME.mutedFg }}>
          <FiArrowLeft className="w-4 h-4" /> Roast Another Post
        </button>

        {/* Roast + Cringe Score */}
        <div className="rounded-xl p-6 mb-6" style={{ background: THEME.card, border: `1px solid ${THEME.accent}44`, boxShadow: `0 0 30px ${THEME.accent}15` }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h2 className="font-serif font-bold text-xl" style={{ color: THEME.fg }}>The Roast</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: THEME.mutedFg }}>Cringe Score</span>
              <span className="text-2xl font-bold px-3 py-1 rounded-lg" style={{ background: `${getCringeColor(r.cringe_score ?? 0)}22`, color: getCringeColor(r.cringe_score ?? 0) }}>
                {r.cringe_score ?? 0}/10
              </span>
            </div>
          </div>
          <div style={{ color: THEME.fg }}>
            {renderMarkdown(r.roast_text ?? '')}
          </div>
        </div>

        {/* Cringe Patterns */}
        {Array.isArray(r.cringe_patterns) && r.cringe_patterns.length > 0 && (
          <div className="rounded-xl p-6 mb-6" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
            <h3 className="font-serif font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: THEME.fg }}>
              <FiAlertTriangle className="w-5 h-5" style={{ color: THEME.chart3 }} />
              Cringe Patterns Detected
            </h3>
            <div className="space-y-3">
              {r.cringe_patterns.map((cp, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: THEME.secondary }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: THEME.fg }}>{cp?.pattern ?? ''}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ml-2" style={{ background: `${getCringeColor(cp?.severity ?? 0)}22`, color: getCringeColor(cp?.severity ?? 0) }}>
                      {cp?.severity ?? 0}/10
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: THEME.muted }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: getSeverityWidth(cp?.severity ?? 0), background: getCringeColor(cp?.severity ?? 0) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Engagement Predictions */}
        <div className="rounded-xl p-6 mb-6" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
          <h3 className="font-serif font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: THEME.fg }}>
            <FiBarChart2 className="w-5 h-5" style={{ color: THEME.accent }} />
            Engagement Predictions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <EngagementCard title="Original Post" data={predictions?.original} color={THEME.chart5} best={origScore === bestScore && origScore > 0} />
            <EngagementCard title="Storytelling Version" data={predictions?.storytelling} color={THEME.chart2} best={storyScore === bestScore && storyScore > 0} />
            <EngagementCard title="Data-Driven Version" data={predictions?.data_driven} color={THEME.chart1} best={dataScore === bestScore && dataScore > 0} />
          </div>
        </div>

        {/* Storytelling Rewrite */}
        <div className="rounded-xl p-6 mb-6" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-semibold text-lg flex items-center gap-2" style={{ color: THEME.fg }}>
              <FiBookOpen className="w-5 h-5" style={{ color: THEME.chart2 }} />
              {r.storytelling_rewrite?.title ?? 'Storytelling Rewrite'}
            </h3>
            <CopyButton text={`${r.storytelling_rewrite?.hook ?? ''}\n\n${r.storytelling_rewrite?.content ?? ''}`} label="Copy" />
          </div>
          {r.storytelling_rewrite?.hook && (
            <div className="rounded-lg p-3 mb-4" style={{ background: `${THEME.chart2}15`, borderLeft: `3px solid ${THEME.chart2}` }}>
              <span className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: THEME.chart2 }}>Hook</span>
              <p className="text-sm font-medium" style={{ color: THEME.fg }}>{r.storytelling_rewrite.hook}</p>
            </div>
          )}
          <div style={{ color: THEME.fg }}>
            {renderMarkdown(r.storytelling_rewrite?.content ?? '')}
          </div>
        </div>

        {/* Data-Driven Rewrite */}
        <div className="rounded-xl p-6 mb-6" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-semibold text-lg flex items-center gap-2" style={{ color: THEME.fg }}>
              <FiTrendingUp className="w-5 h-5" style={{ color: THEME.chart1 }} />
              {r.data_driven_rewrite?.title ?? 'Data-Driven Rewrite'}
            </h3>
            <CopyButton text={`${r.data_driven_rewrite?.hook ?? ''}\n\n${r.data_driven_rewrite?.content ?? ''}`} label="Copy" />
          </div>
          {r.data_driven_rewrite?.hook && (
            <div className="rounded-lg p-3 mb-4" style={{ background: `${THEME.chart1}15`, borderLeft: `3px solid ${THEME.chart1}` }}>
              <span className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: THEME.chart1 }}>Hook</span>
              <p className="text-sm font-medium" style={{ color: THEME.fg }}>{r.data_driven_rewrite.hook}</p>
            </div>
          )}
          <div style={{ color: THEME.fg }}>
            {renderMarkdown(r.data_driven_rewrite?.content ?? '')}
          </div>
        </div>

        {/* Improvement Summary */}
        {r.improvement_summary && (
          <div className="rounded-xl p-6 mb-6" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
            <h3 className="font-serif font-semibold text-lg mb-3 flex items-center gap-2" style={{ color: THEME.fg }}>
              <FiStar className="w-5 h-5" style={{ color: THEME.accent }} />
              Improvement Summary
            </h3>
            <div style={{ color: THEME.fg }}>
              {renderMarkdown(r.improvement_summary)}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button
            onClick={() => { setScreen('post-input'); setPostResult(null); setPostDraft(''); setError(null) }}
            className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200"
            style={{ background: THEME.accent, color: THEME.accentFg }}
          >
            <FiRefreshCw className="w-4 h-4" /> Roast Another Post
          </button>
          <CopyButton
            text={`RoastMyPost AI Results\n\nCringe Score: ${r.cringe_score ?? 0}/10\n\n${r.roast_text ?? ''}\n\nImprovement Summary:\n${r.improvement_summary ?? ''}`}
            label="Share Results"
          />
        </div>

        <AgentStatusBar activeAgentId={activeAgentId} />
      </div>
    )
  }

  // ---- Profile Results Screen ----
  function ProfileResultsScreen() {
    const r = profileResult
    if (!r) return null

    const sections = r.sections
    const overallScore = r.overall_score ?? 0
    const grade = r.grade ?? '?'

    return (
      <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto w-full">
        <button onClick={() => { setScreen('profile-input'); setError(null); setProfileResult(null) }} className="inline-flex items-center gap-2 text-sm mb-8 transition-colors duration-200" style={{ color: THEME.mutedFg }}>
          <FiArrowLeft className="w-4 h-4" /> Roast Another Profile
        </button>

        {/* Score + Grade Header */}
        <div className="rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-6" style={{ background: THEME.card, border: `1px solid ${THEME.accent}44`, boxShadow: `0 0 30px ${THEME.accent}15` }}>
          <div className="relative flex-shrink-0">
            <ScoreCircle score={overallScore} size={130} color={getScoreColor(overallScore)} label="/ 100" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
              <h2 className="font-serif font-bold text-xl" style={{ color: THEME.fg }}>Profile Score</h2>
              <span className="text-3xl font-bold px-3 py-0.5 rounded-lg" style={{ background: `${getGradeColor(grade)}22`, color: getGradeColor(grade) }}>
                {grade}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-start">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: `#4ade8022`, color: '#4ade80' }}>
                <FiTrendingUp className="w-3 h-3" /> Strongest: {r.strongest_section ?? '--'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: `${THEME.chart5}22`, color: THEME.chart5 }}>
                <FiAlertTriangle className="w-3 h-3" /> Weakest: {r.weakest_section ?? '--'}
              </span>
            </div>
          </div>
        </div>

        {/* Master Roast */}
        <div className="rounded-xl p-6 mb-6" style={{ background: THEME.card, border: `1px solid ${THEME.accent}33` }}>
          <h3 className="font-serif font-semibold text-lg mb-3 flex items-center gap-2" style={{ color: THEME.fg }}>
            <FiZap className="w-5 h-5" style={{ color: THEME.accent }} />
            The Master Roast
          </h3>
          <div style={{ color: THEME.fg }}>
            {renderMarkdown(r.master_roast ?? '')}
          </div>
        </div>

        {/* Section Cards */}
        <div className="space-y-3 mb-6">
          {/* Headline */}
          <ExpandableSection title="Headline" icon={<FiTarget className="w-5 h-5" />} score={sections?.headline?.score} defaultOpen>
            <div className="space-y-4">
              <div style={{ color: THEME.fg }}>
                {renderMarkdown(sections?.headline?.roast ?? '')}
              </div>
              {Array.isArray(sections?.headline?.improvements) && sections.headline.improvements.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: THEME.accent }}>Improved Headlines</h4>
                  <div className="space-y-2">
                    {sections.headline.improvements.map((imp, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-lg p-3" style={{ background: THEME.secondary }}>
                        <span className="text-sm" style={{ color: THEME.fg }}>{imp}</span>
                        <CopyButton text={imp} label="Copy" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ExpandableSection>

          {/* About */}
          <ExpandableSection title="About / Summary" icon={<FiBookOpen className="w-5 h-5" />} score={sections?.about?.score}>
            <div className="space-y-4">
              <div style={{ color: THEME.fg }}>
                {renderMarkdown(sections?.about?.roast ?? '')}
              </div>
              {sections?.about?.improved_version && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.accent }}>Improved Version</h4>
                    <CopyButton text={sections.about.improved_version} label="Copy" />
                  </div>
                  <div className="rounded-lg p-4" style={{ background: THEME.secondary, borderLeft: `3px solid ${THEME.accent}` }}>
                    <div style={{ color: THEME.fg }}>
                      {renderMarkdown(sections.about.improved_version)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ExpandableSection>

          {/* Experience */}
          <ExpandableSection title="Experience" icon={<FiBriefcase className="w-5 h-5" />} score={sections?.experience?.score}>
            <div className="space-y-4">
              <div style={{ color: THEME.fg }}>
                {renderMarkdown(sections?.experience?.roast ?? '')}
              </div>
              {Array.isArray(sections?.experience?.improvements) && sections.experience.improvements.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: THEME.accent }}>Improvements</h4>
                  <ul className="space-y-1.5">
                    {sections.experience.improvements.map((imp, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: THEME.fg }}>
                        <FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
                        {imp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ExpandableSection>

          {/* Skills */}
          <ExpandableSection title="Skills" icon={<FiLayers className="w-5 h-5" />} score={sections?.skills?.score}>
            <div className="space-y-4">
              <div style={{ color: THEME.fg }}>
                {renderMarkdown(sections?.skills?.roast ?? '')}
              </div>
              {Array.isArray(sections?.skills?.improvements) && sections.skills.improvements.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: THEME.accent }}>Improvements</h4>
                  <ul className="space-y-1.5">
                    {sections.skills.improvements.map((imp, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: THEME.fg }}>
                        <FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
                        {imp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ExpandableSection>
        </div>

        {/* Action Plan */}
        {Array.isArray(r.action_plan) && r.action_plan.length > 0 && (
          <div className="rounded-xl p-6 mb-6" style={{ background: THEME.card, border: `1px solid ${THEME.border}` }}>
            <h3 className="font-serif font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: THEME.fg }}>
              <FiTarget className="w-5 h-5" style={{ color: THEME.accent }} />
              Your Action Plan
            </h3>
            <div className="space-y-4">
              {r.action_plan.map((step, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ background: `${THEME.accent}22`, color: THEME.accent }}>
                    {step?.step ?? i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm" style={{ color: THEME.fg }}>{step?.title ?? ''}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${getPriorityColor(step?.priority ?? '')}22`, color: getPriorityColor(step?.priority ?? '') }}>
                        {step?.priority ?? 'medium'}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: THEME.mutedFg }}>{step?.description ?? ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button
            onClick={() => { setScreen('profile-input'); setProfileResult(null); setProfileData({ headline: '', about: '', experience: '', skills: '' }); setError(null) }}
            className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200"
            style={{ background: THEME.accent, color: THEME.accentFg }}
          >
            <FiRefreshCw className="w-4 h-4" /> Roast Another Profile
          </button>
          <CopyButton
            text={`RoastMyPost AI - Profile Results\n\nOverall Score: ${overallScore}/100 (${grade})\n\n${r.master_roast ?? ''}\n\nStrongest: ${r.strongest_section ?? ''}\nWeakest: ${r.weakest_section ?? ''}`}
            label="Share Results"
          />
        </div>

        <AgentStatusBar activeAgentId={activeAgentId} />
      </div>
    )
  }

  // ---- Render ----
  return (
    <ErrorBoundary>
      <div className="min-h-screen font-sans" style={{ background: THEME.bg, color: THEME.fg, letterSpacing: '-0.01em', lineHeight: 1.5 }}>
        {/* Sample Data Toggle */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-full px-3 py-1.5" style={{ background: THEME.card, border: `1px solid ${THEME.border}`, boxShadow: `0 4px 16px ${THEME.bg}` }}>
          <span className="text-xs font-medium" style={{ color: THEME.mutedFg }}>Sample Data</span>
          <button
            onClick={() => {
              const next = !sampleData
              setSampleData(next)
              if (next) {
                // Pre-populate results based on current screen
                if (screen === 'post-results' || screen === 'landing') {
                  // Will be handled in useEffect
                }
              } else {
                // Clear sample data
                if (screen === 'post-input') setPostDraft('')
                if (screen === 'profile-input') setProfileData({ headline: '', about: '', experience: '', skills: '' })
              }
            }}
            className="relative w-10 h-5 rounded-full transition-colors duration-200"
            style={{ background: sampleData ? THEME.accent : THEME.muted }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200"
              style={{ background: THEME.fg, left: sampleData ? '22px' : '2px' }}
            />
          </button>
        </div>

        {/* Screens */}
        {screen === 'landing' && <LandingScreen />}
        {screen === 'post-input' && <PostInputScreen />}
        {screen === 'profile-input' && <ProfileInputScreen />}
        {(screen === 'post-loading' || screen === 'profile-loading') && <LoadingScreen />}
        {screen === 'post-results' && <PostResultsScreen />}
        {screen === 'profile-results' && <ProfileResultsScreen />}
      </div>
    </ErrorBoundary>
  )
}
