"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { get } from "@/lib/api";
import {
  ChevronLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Users,
  Flag,
  CheckCircle,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Lock,
  Unlock,
  Globe,
  Package,
  CreditCard,
  BarChart2,
  HashIcon,
  Tag,
  Star,
  Info,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface WeightItem { code?: string; name?: string; weight?: number }
interface KV { [k: string]: any }

interface UserLite {
  userId?: string
  fullname?: string
  username?: string
  url?: string
  picture?: string
  followers?: number
  engagements?: number
}

interface Sponsor { domain?: string; logo_url?: string; name?: string }

interface Post {
  id?: string
  text?: string
  url?: string
  created?: string
  likes?: number
  comments?: number
  views?: number
  video?: string
  image?: string
  thumbnail?: string
  type?: string
  title?: string
  mentions?: string[]
  hashtags?: string[]
  sponsors?: Sponsor[]
}

interface Audience {
  notable?: number
  genders?: WeightItem[]
  geoCountries?: WeightItem[]
  ages?: WeightItem[]
  gendersPerAge?: { code?: string; male?: number; female?: number }[]
  languages?: WeightItem[]
  notableUsers?: UserLite[]
  audienceLookalikes?: UserLite[]
  geoCities?: { name?: string; weight?: number }[]
  geoStates?: { name?: string; weight?: number }[]
  credibility?: number
  interests?: { name?: string; weight?: number }[]
  brandAffinity?: { name?: string; weight?: number }[]
  audienceReachability?: WeightItem[]
  audienceTypes?: WeightItem[]
  ethnicities?: WeightItem[]
}

interface CategoryLink {
  categoryId: number
  categoryName: string
  subcategoryId: string
  subcategoryName: string
}

interface SocialProfile {
  provider: "youtube" | "tiktok" | "instagram" | string
  // Identity
  userId?: string
  username?: string
  fullname?: string
  handle?: string
  url?: string
  picture?: string
  // Metrics
  followers?: number
  engagements?: number
  engagementRate?: number
  averageViews?: number
  // State/meta
  isPrivate?: boolean
  isVerified?: boolean
  accountType?: string
  secUid?: string
  // Localization
  city?: string
  state?: string
  country?: string
  ageGroup?: string
  gender?: string
  language?: { code?: string; name?: string }
  // Content stats & posts
  statsByContentType?: KV
  stats?: KV
  recentPosts?: Post[]
  popularPosts?: Post[]
  // Counts (normalized)
  postsCount?: number
  avgLikes?: number
  avgComments?: number
  avgViews?: number
  avgReelsPlays?: number
  totalLikes?: number
  totalViews?: number
  // Bio/tags/brand
  bio?: string
  categories?: CategoryLink[]
  hashtags?: { tag?: string; weight?: number }[]
  mentions?: { tag?: string; weight?: number }[]
  brandAffinity?: { id?: number; name?: string }[]
  // Audience
  audience?: Audience
  audienceCommenters?: Audience
  lookalikes?: UserLite[]
  // Paid/sponsored
  sponsoredPosts?: Post[]
  paidPostPerformance?: number
  paidPostPerformanceViews?: number
  sponsoredPostsMedianViews?: number
  sponsoredPostsMedianLikes?: number
  nonSponsoredPostsMedianViews?: number
  nonSponsoredPostsMedianLikes?: number
  // Misc
  audienceExtra?: KV
  providerRaw?: KV
}

interface LanguageRef { languageId?: string; code: string; name: string }

interface Onboarding {
  // 4.1
  formats: string[]
  budgets: { format: string; range: string }[]
  projectLength?: string
  capacity?: string
  // 4.2
  categoryId?: number
  categoryName?: string
  subcategories: CategoryLink[]
  collabTypes: string[]
  allowlisting: boolean
  cadences?: string[]
  // 4.3
  selectedPrompts?: { group: string; prompt: string }[]
  promptAnswers?: { group: string; prompt: string; answer: string }[]
}

interface PaymentMethod {
  paymentId: string
  type: 0 | 1
  isDefault: boolean
  bank?: {
    accountHolder?: string
    accountNumber?: string
    ifsc?: string
    swift?: string
    bankName?: string
    branch?: string
    countryId?: string
    countryName?: string
  }
  paypal?: {
    email?: string
    username?: string
  }
  createdAt?: string
  updatedAt?: string
}

interface SubscriptionFeature { key: string; limit: number; used: number }

interface InfluencerDetail {
  influencerId: string
  name?: string
  email: string
  password?: string
  phone?: string
  primaryPlatform?: "youtube" | "tiktok" | "instagram" | "other" | null
  socialProfiles: SocialProfile[]
  countryId?: string
  country?: string
  callingId?: string
  callingcode?: string
  city?: string
  dateOfBirth?: string
  gender?: "Female" | "Male" | "Non-binary" | "Prefer not to say" | ""
  languages: LanguageRef[]
  onboarding: Onboarding
  createdAt: string
  updatedAt: string
  otpCode?: string
  otpExpiresAt?: string
  otpVerified: boolean
  passwordResetCode?: string
  passwordResetExpiresAt?: string
  passwordResetVerified?: boolean
  paymentMethods: PaymentMethod[]
  subscription: {
    planName: string
    planId: string
    startedAt?: string
    expiresAt?: string
    features: SubscriptionFeature[]
  }
  subscriptionExpired: boolean
  failedLoginAttempts?: number
  lockUntil?: string | null
}

/* -------------------------------------------------------------------------- */
/*                                UI Utilities                                */
/* -------------------------------------------------------------------------- */

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString() : "—";

const fmtNum = (n?: number) => {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
};

const ageFromDob = (iso?: string) => {
  if (!iso) return "—";
  const dob = new Date(iso);
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const Copyable: React.FC<{ value?: string; className?: string }> = ({ value, className }) => {
  if (!value) return <span>—</span>;
  return (
    <button
      type="button"
      className={`text-blue-600 hover:underline hover:text-blue-800 ${className ?? ""}`}
      onClick={() => navigator.clipboard.writeText(value)}
      title="Copy"
    >
      {value}
    </button>
  );
};

const Pill: React.FC<{ children: React.ReactNode; tone?: "default" | "success" | "danger" | "warning" | "muted" }>
  = ({ children, tone = "default" }) => (
  <span
    className={
      `px-2 py-1 rounded-full text-xs font-medium ` +
      (tone === "success" ? "bg-green-100 text-green-700" :
       tone === "danger" ? "bg-red-100 text-red-700" :
       tone === "warning" ? "bg-yellow-100 text-yellow-800" :
       tone === "muted" ? "bg-slate-100 text-slate-700" :
       "bg-blue-100 text-blue-700")
    }
  >{children}</span>
);

const Section: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; className?: string; children?: React.ReactNode }>
  = ({ title, subtitle, right, className, children }) => (
  <Card className={`p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl ${className ?? ""}`}>
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">{title}</h3>
        {subtitle && <p className="text-slate-600 text-sm mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </Card>
);

const KVRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="grid grid-cols-3 gap-2 py-2">
    <div className="text-slate-500 text-sm col-span-1">{label}</div>
    <div className="col-span-2 font-medium text-slate-900 break-words">{value ?? "—"}</div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*                                Main Component                               */
/* -------------------------------------------------------------------------- */

export default function AdminInfluencerView() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("influencerId");

  const [data, setData] = useState<InfluencerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetcher = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const resp = await get("/admin/influencer/getById", { id });
        setData(resp.influencer as InfluencerDetail);
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load influencer");
      } finally {
        setLoading(false);
      }
    };
    fetcher();
  }, [id]);

  const primaryProfile = useMemo(() => {
    if (!data?.socialProfiles?.length) return undefined;
    return (
      data.socialProfiles.find((p) => p.provider === data.primaryPlatform) ||
      data.socialProfiles[0]
    );
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-60" />
          <Card className="p-6 space-y-6 shadow-xl">
            <div className="flex items-center gap-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-96" />
                <Skeleton className="h-4 w-80" />
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4 hover:bg-white/80">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Card className="p-6 border-red-200 bg-red-50 shadow-xl">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-600" />
              <p className="text-red-600 font-medium">Error: {error}</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) return null;

  /* --------------------------------- Header -------------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex gap-2 items-center">
          <Button variant="ghost" onClick={() => router.back()} className="hover:bg-white/80 shadow-sm">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Influencers
          </Button>
        </div>

        <Card className="p-6 md:p-8 bg-white/80 backdrop-blur-sm shadow-xl border-0">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            <div className="flex-shrink-0">
              {primaryProfile?.picture ? (
                <img
                  src={primaryProfile.picture}
                  alt={data.name ?? data.email}
                  className="h-28 w-28 md:h-32 md:w-32 rounded-full object-cover border-4 border-white shadow-lg ring-4 ring-blue-100"
                />
              ) : (
                <div className="h-28 w-28 md:h-32 md:w-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-4xl md:text-5xl font-bold shadow-lg ring-4 ring-blue-100">
                  {(data.name || data.email)?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 truncate">
                  {data.name || "Unnamed Influencer"}
                </h1>
                <span className="hidden md:inline text-slate-300">•</span>
                <Pill tone={data.subscriptionExpired ? "danger" : "success"}>
                  {data.subscriptionExpired ? "Subscription Expired" : "Subscription Active"}
                </Pill>
                {data.otpVerified && (
                  <Pill tone="success" >
                    <span className="inline-flex items-center gap-1"><CheckCircle className="h-3 w-3"/> OTP Verified</span>
                  </Pill>
                )}
                {data.lockUntil ? (
                  <Pill tone="warning"><span className="inline-flex items-center gap-1"><Lock className="h-3 w-3"/> Locked</span></Pill>
                ) : (
                  <Pill tone="muted"><span className="inline-flex items-center gap-1"><Unlock className="h-3 w-3"/> Unlocked</span></Pill>
                )}
                {data.primaryPlatform && (
                  <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">Primary: {String(data.primaryPlatform).toUpperCase()}</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2 rounded-lg"><Mail className="h-4 w-4 text-blue-600"/><Copyable value={data.email} /></div>
                <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2 rounded-lg"><Phone className="h-4 w-4 text-green-600"/><span>{data.phone || "—"}</span></div>
                <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2 rounded-lg"><MapPin className="h-4 w-4 text-red-600"/><span>{[data.city, data.country].filter(Boolean).join(", ") || "—"}</span></div>
                <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2 rounded-lg"><Calendar className="h-4 w-4 text-purple-600"/><span>{fmtDate(data.dateOfBirth)}{data.dateOfBirth ? ` • ${ageFromDob(data.dateOfBirth)} yrs` : ""}</span></div>
                <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2 rounded-lg"><Users className="h-4 w-4 text-orange-600"/><span>{data.gender || "—"}</span></div>
                <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2 rounded-lg"><Flag className="h-4 w-4 text-indigo-600"/>
                  <span className="truncate" title={data.languages?.map(l=>l.name).join(", ")}>{data.languages?.length ? data.languages.map(l=>l.name).join(", ") : "—"}</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 flex flex-wrap gap-4">
                <span>Influencer ID: <Copyable value={data.influencerId} /></span>
                {data.callingcode && <span>Calling Code: {data.callingcode}</span>}
                <span>Created: {fmtDateTime(data.createdAt)}</span>
                <span>Updated: {fmtDateTime(data.updatedAt)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* --------------------------------- Tabs -------------------------------- */}
        <Tabs defaultValue="social" className="space-y-6">
          <TabsList className="bg-white shadow-lg p-1 border-0">
            <TabsTrigger value="social" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">Social Profiles</TabsTrigger>
            <TabsTrigger value="onboarding" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">Onboarding</TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">Payments</TabsTrigger>
            <TabsTrigger value="subscription" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">Subscription</TabsTrigger>
            <TabsTrigger value="raw" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">Raw</TabsTrigger>
          </TabsList>

          {/* ------------------------------ Social Tab ------------------------------ */}
          <TabsContent value="social" className="space-y-4">
            {data.socialProfiles?.length ? (
              data.socialProfiles.map((p, idx) => (
                <Section
                  key={`${p.provider}-${idx}`}
                  title={<><Globe className="h-5 w-5"/> <span className="capitalize">{p.provider}</span> {p.isVerified && <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700"><CheckCircle className="h-3 w-3 mr-1"/>Verified</Badge>} {data.primaryPlatform === p.provider && <Badge className="ml-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white">Primary</Badge>}</>}
                  subtitle={p.bio}
                  right={p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                      View <ExternalLink className="h-4 w-4"/>
                    </a>
                  ) : undefined}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <Card className="p-4 bg-blue-50/60">
                      <div className="text-xs text-slate-600">Followers</div>
                      <div className="text-2xl font-bold text-blue-700">{fmtNum(p.followers)}</div>
                    </Card>
                    <Card className="p-4 bg-green-50/60">
                      <div className="text-xs text-slate-600">Engagement Rate</div>
                      <div className="text-2xl font-bold text-green-700">{p.engagementRate !== undefined ? `${(p.engagementRate * 100).toFixed(2)}%` : "—"}</div>
                    </Card>
                    <Card className="p-4 bg-purple-50/60">
                      <div className="text-xs text-slate-600">Avg Likes</div>
                      <div className="text-2xl font-bold text-purple-700">{fmtNum(p.avgLikes)}</div>
                    </Card>
                    <Card className="p-4 bg-pink-50/60">
                      <div className="text-xs text-slate-600">Avg Comments</div>
                      <div className="text-2xl font-bold text-pink-700">{fmtNum(p.avgComments)}</div>
                    </Card>
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    <Card className="p-4">
                      <div className="font-semibold mb-2 flex items-center gap-2"><Info className="h-4 w-4"/>Account</div>
                      <KVRow label="Username" value={p.username ? `@${p.username}` : "—"} />
                      <KVRow label="Full Name" value={p.fullname} />
                      <KVRow label="Handle" value={p.handle} />
                      <KVRow label="Account Type" value={p.accountType} />
                      <KVRow label="Private" value={p.isPrivate ? <Pill tone="warning">Yes</Pill> : <span>No</span>} />
                    </Card>
                    <Card className="p-4">
                      <div className="font-semibold mb-2 flex items-center gap-2"><MapPin className="h-4 w-4"/>Localization</div>
                      <KVRow label="City" value={p.city} />
                      <KVRow label="State" value={p.state} />
                      <KVRow label="Country" value={p.country} />
                      <KVRow label="Language" value={[p.language?.name, p.language?.code].filter(Boolean).join(" • ")} />
                      <KVRow label="Age Group" value={p.ageGroup} />
                      <KVRow label="Gender" value={p.gender} />
                    </Card>
                    <Card className="p-4">
                      <div className="font-semibold mb-2 flex items-center gap-2"><BarChart2 className="h-4 w-4"/>Summary</div>
                      <KVRow label="Posts" value={fmtNum(p.postsCount)} />
                      <KVRow label="Total Likes" value={fmtNum(p.totalLikes)} />
                      <KVRow label="Total Views" value={fmtNum(p.totalViews)} />
                      <KVRow label="Avg Views" value={fmtNum(p.avgViews)} />
                      <KVRow label="Avg Reels Plays" value={fmtNum(p.avgReelsPlays)} />
                    </Card>
                  </div>

                  {/* Categories / Tags */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <Card className="p-4">
                      <div className="font-semibold mb-3 flex items-center gap-2"><Tag className="h-4 w-4"/>Categories</div>
                      {p.categories?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {p.categories.map((c, i) => (
                            <Badge key={`${c.subcategoryId}-${i}`} variant="outline" className="border-slate-300">
                              {c.categoryName} • {c.subcategoryName}
                            </Badge>
                          ))}
                        </div>
                      ) : <div className="text-sm text-slate-500">No categories</div>}
                    </Card>
                    <Card className="p-4">
                      <div className="font-semibold mb-3 flex items-center gap-2"><HashIcon className="h-4 w-4"/>Hashtags & Mentions</div>
                      <div className="flex flex-wrap gap-2">
                        {p.hashtags?.map((h, i) => (
                          <Badge key={`h-${i}`} variant="secondary" className="bg-slate-100 text-slate-800">#{h.tag} {h.weight ? `(${h.weight})` : ""}</Badge>
                        ))}
                        {p.mentions?.map((m, i) => (
                          <Badge key={`m-${i}`} variant="secondary" className="bg-indigo-100 text-indigo-800">@{m.tag} {m.weight ? `(${m.weight})` : ""}</Badge>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* Audience */}
                  <Accordion type="single" collapsible className="mt-4">
                    <AccordionItem value="audience">
                      <AccordionTrigger className="text-left"><div className="font-semibold flex items-center gap-2"><Users className="h-4 w-4"/> Audience Insights</div></AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <Card className="p-4">
                            <div className="font-semibold mb-2">Overview</div>
                            <KVRow label="Credibility" value={data?.socialProfiles?.[idx]?.audience?.credibility ?? "—"} />
                            <KVRow label="Notable %" value={data?.socialProfiles?.[idx]?.audience?.notable ?? "—"} />
                            <KVRow label="Top Languages" value={data?.socialProfiles?.[idx]?.audience?.languages?.slice(0,5).map(a=>`${a.name ?? a.code}${a.weight?` (${a.weight})`:''}`).join(", ") || "—"} />
                          </Card>
                          <Card className="p-4">
                            <div className="font-semibold mb-2">Top Countries</div>
                            <Table>
                              <TableHeader>
                                <TableRow><TableHead>Country</TableHead><TableHead className="text-right">Weight</TableHead></TableRow>
                              </TableHeader>
                              <TableBody>
                                {(data?.socialProfiles?.[idx]?.audience?.geoCountries ?? []).slice(0,8).map((c,i)=> (
                                  <TableRow key={i}><TableCell>{c.name ?? c.code}</TableCell><TableCell className="text-right">{c.weight}</TableCell></TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Card>
                          <Card className="p-4">
                            <div className="font-semibold mb-2">Ages</div>
                            <Table>
                              <TableHeader>
                                <TableRow><TableHead>Age</TableHead><TableHead className="text-right">Weight</TableHead></TableRow>
                              </TableHeader>
                              <TableBody>
                                {(data?.socialProfiles?.[idx]?.audience?.ages ?? []).map((a,i)=> (
                                  <TableRow key={i}><TableCell>{a.code ?? a.name}</TableCell><TableCell className="text-right">{a.weight}</TableCell></TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Card>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Posts */}
                  <Accordion type="multiple" className="mt-4">
                    <AccordionItem value="recent">
                      <AccordionTrigger><div className="font-semibold">Recent Posts</div></AccordionTrigger>
                      <AccordionContent>
                        <ScrollArea className="h-64 rounded border bg-slate-50">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead className="text-right">Likes</TableHead>
                                <TableHead className="text-right">Comments</TableHead>
                                <TableHead className="text-right">Views</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(p.recentPosts ?? []).map((post, i) => (
                                <TableRow key={i} className="hover:bg-white">
                                  <TableCell>{fmtDate(post.created)}</TableCell>
                                  <TableCell>{post.type ?? "—"}</TableCell>
                                  <TableCell className="max-w-[320px] truncate" title={post.title || post.text}>{post.title || post.text || "—"}</TableCell>
                                  <TableCell className="text-right">{fmtNum(post.likes)}</TableCell>
                                  <TableCell className="text-right">{fmtNum(post.comments)}</TableCell>
                                  <TableCell className="text-right">{fmtNum(post.views)}</TableCell>
                                  <TableCell>
                                    {post.url && <a href={post.url} target="_blank" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">Open <ArrowUpRight className="h-4 w-4"/></a>}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="popular">
                      <AccordionTrigger><div className="font-semibold">Popular Posts</div></AccordionTrigger>
                      <AccordionContent>
                        <ScrollArea className="h-64 rounded border bg-slate-50">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead className="text-right">Likes</TableHead>
                                <TableHead className="text-right">Comments</TableHead>
                                <TableHead className="text-right">Views</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(p.popularPosts ?? []).map((post, i) => (
                                <TableRow key={i}>
                                  <TableCell className="max-w-[320px] truncate" title={post.title || post.text}>{post.title || post.text || "—"}</TableCell>
                                  <TableCell className="text-right">{fmtNum(post.likes)}</TableCell>
                                  <TableCell className="text-right">{fmtNum(post.comments)}</TableCell>
                                  <TableCell className="text-right">{fmtNum(post.views)}</TableCell>
                                  <TableCell>
                                    {post.url && <a href={post.url} target="_blank" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">Open <ArrowUpRight className="h-4 w-4"/></a>}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Paid / Sponsored */}
                  <Accordion type="single" collapsible className="mt-4">
                    <AccordionItem value="paid">
                      <AccordionTrigger><div className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4"/> Sponsored Performance</div></AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card className="p-4">
                            <KVRow label="Paid Post Performance (Likes)" value={fmtNum(p.paidPostPerformance)} />
                            <KVRow label="Paid Post Performance (Views)" value={fmtNum(p.paidPostPerformanceViews)} />
                          </Card>
                          <Card className="p-4">
                            <KVRow label="Sponsored Median Likes" value={fmtNum(p.sponsoredPostsMedianLikes)} />
                            <KVRow label="Sponsored Median Views" value={fmtNum(p.sponsoredPostsMedianViews)} />
                            <KVRow label="Non-Sponsored Median Likes" value={fmtNum(p.nonSponsoredPostsMedianLikes)} />
                            <KVRow label="Non-Sponsored Median Views" value={fmtNum(p.nonSponsoredPostsMedianViews)} />
                          </Card>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Section>
              ))
            ) : (
              <Card className="p-6 text-slate-600">No social profiles connected.</Card>
            )}
          </TabsContent>

          {/* ----------------------------- Onboarding Tab ----------------------------- */}
          <TabsContent value="onboarding">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title={<><Star className="h-5 w-5"/> Preferences</>}>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-slate-600 mb-2 font-medium">Formats</div>
                    <div className="flex flex-wrap gap-2">
                      {data.onboarding?.formats?.length ? data.onboarding.formats.map((f) => (
                        <Badge key={f} variant="secondary" className="bg-blue-100 text-blue-700">{f}</Badge>
                      )) : <span className="text-slate-500">—</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-2 font-medium">Budget Ranges</div>
                    <div className="space-y-2">
                      {data.onboarding?.budgets?.length ? data.onboarding.budgets.map((b, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                          <span className="font-medium text-slate-900">{b.format}</span>
                          <Badge className="bg-green-100 text-green-700">{b.range}</Badge>
                        </div>
                      )) : <span className="text-slate-500">—</span>}
                    </div>
                  </div>
                </div>
              </Section>

              <Section title={<><Package className="h-5 w-5"/> Work Details</>}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 bg-blue-50/60">
                    <div className="text-sm text-slate-600">Project Length</div>
                    <div className="font-semibold text-slate-900">{data.onboarding?.projectLength || "—"}</div>
                  </Card>
                  <Card className="p-4 bg-green-50/60">
                    <div className="text-sm text-slate-600">Capacity</div>
                    <div className="font-semibold text-slate-900">{data.onboarding?.capacity || "—"}</div>
                  </Card>
                </div>
                <Separator className="my-4"/>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="text-xs text-slate-600">Allowlisting</div>
                    <div className="mt-1">{data.onboarding?.allowlisting ? <Pill tone="success">Enabled</Pill> : <Pill tone="muted">Disabled</Pill>}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-slate-600">Collaboration Types</div>
                    <div className="mt-2 flex flex-wrap gap-2">{data.onboarding?.collabTypes?.length ? data.onboarding.collabTypes.map(t => (
                      <Badge key={t} variant="outline" className="border-slate-300">{t}</Badge>
                    )) : <span className="text-slate-500">—</span>}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-slate-600">Cadences</div>
                    <div className="mt-2 flex flex-wrap gap-2">{data.onboarding?.cadences?.length ? data.onboarding.cadences.map(c => (
                      <Badge key={c} variant="secondary" className="bg-purple-100 text-purple-700">{c}</Badge>
                    )) : <span className="text-slate-500">—</span>}</div>
                  </Card>
                </div>
                <Separator className="my-4"/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="font-semibold mb-2">Category</div>
                    <KVRow label="Category Name" value={data.onboarding?.categoryName || "—"} />
                    <KVRow label="Category ID" value={data.onboarding?.categoryId !== undefined ? String(data.onboarding.categoryId) : "—"} />
                    <Separator className="my-3" />
                    <div className="text-sm text-slate-600 mb-2">Subcategories</div>
                    {data.onboarding?.subcategories?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {data.onboarding.subcategories.map((sc, i) => (
                          <Badge key={`${sc.subcategoryId}-${i}`} variant="outline" className="border-slate-300" title={`${sc.categoryName} • ${sc.subcategoryName}`}>
                            {sc.categoryName} • {sc.subcategoryName}
                          </Badge>
                        ))}
                      </div>
                    ) : <div className="text-slate-500">—</div>}
                  </Card>
                  <Card className="p-4">
                    <div className="font-semibold mb-2">Prompting</div>
                    <div className="mb-3">
                      <div className="text-sm text-slate-600 mb-1">Selected Prompts</div>
                      {data.onboarding?.selectedPrompts?.length ? (
                        <ul className="list-disc list-inside text-sm text-slate-800 space-y-1">
                          {data.onboarding.selectedPrompts.map((sp, i) => (
                            <li key={i}><span className="text-slate-500">[{sp.group}]</span> {sp.prompt}</li>
                          ))}
                        </ul>
                      ) : <span className="text-slate-500">—</span>}
                    </div>
                    <div>
                      <div className="text-sm text-slate-600 mb-1">Prompt Answers</div>
                      {data.onboarding?.promptAnswers?.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-28">Group</TableHead>
                              <TableHead>Prompt</TableHead>
                              <TableHead>Answer</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.onboarding.promptAnswers.map((pa, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-slate-600 text-xs">{pa.group}</TableCell>
                                <TableCell className="text-slate-900 text-sm max-w-[320px] whitespace-pre-wrap">{pa.prompt}</TableCell>
                                <TableCell className="text-slate-900 text-sm max-w-[420px] whitespace-pre-wrap">{pa.answer}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : <span className="text-slate-500">—</span>}
                    </div>
                  </Card>
                </div>
              </Section>
            </div>
          </TabsContent>

          {/* ------------------------------ Payments Tab ----------------------------- */}
          <TabsContent value="payments">
            <Section title={<><CreditCard className="h-5 w-5"/> Payment Methods</>} subtitle="Only one default payment method is allowed (enforced by validation).">
              {data.paymentMethods?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.paymentMethods.map((pm) => (
                      <TableRow key={pm.paymentId}>
                        <TableCell className="font-medium">{pm.type === 0 ? "PayPal" : "Bank"}</TableCell>
                        <TableCell>
                          {pm.type === 0 ? (
                            <div className="space-y-1">
                              <div>Email: <Copyable value={pm.paypal?.email} /></div>
                              {pm.paypal?.username && <div>Username: {pm.paypal.username}</div>}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div>Holder: {pm.bank?.accountHolder || "—"}</div>
                              <div>Account No: {pm.bank?.accountNumber || "—"}</div>
                              <div>IFSC: {pm.bank?.ifsc || "—"} • SWIFT: {pm.bank?.swift || "—"}</div>
                              <div>Bank: {pm.bank?.bankName || "—"} ({pm.bank?.countryName || "—"})</div>
                              {pm.bank?.branch && <div>Branch: {pm.bank.branch}</div>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{pm.isDefault ? <Pill tone="success">Default</Pill> : <span className="text-slate-500">—</span>}</TableCell>
                        <TableCell>{fmtDateTime(pm.createdAt)}</TableCell>
                        <TableCell>{fmtDateTime(pm.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-slate-600">No payment methods added.</div>
              )}
            </Section>
          </TabsContent>

          {/* ---------------------------- Subscription Tab --------------------------- */}
          <TabsContent value="subscription">
            <Section title={<><ShieldCheck className="h-5 w-5"/> Subscription</>}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="space-y-1">
                  <div className="text-sm text-slate-600">Plan</div>
                  <div className="text-2xl font-bold text-slate-900">{data.subscription?.planName?.toUpperCase()} <span className="text-xs text-slate-500">({data.subscription?.planId})</span></div>
                </div>
                <Badge className={`px-4 py-2 text-lg ${data.subscriptionExpired ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-indigo-600"} text-white`}>
                  {data.subscriptionExpired ? "EXPIRED" : "ACTIVE"}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card className="p-4 bg-blue-50/60"><div className="text-xs text-slate-600">Started</div><div className="text-lg font-semibold">{fmtDateTime(data.subscription?.startedAt)}</div></Card>
                <Card className="p-4 bg-purple-50/60"><div className="text-xs text-slate-600">Expires</div><div className="text-lg font-semibold">{fmtDateTime(data.subscription?.expiresAt)}</div></Card>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Feature</TableHead>
                      <TableHead>Limit</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.subscription?.features?.map((f, idx) => {
                      const remaining = Math.max(0, (f.limit ?? 0) - (f.used ?? 0));
                      const pct = f.limit ? Math.min(100, (f.used / f.limit) * 100) : 0;
                      return (
                        <TableRow key={`${f.key}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <TableCell className="font-medium capitalize">{f.key?.replace(/_/g, " ")}</TableCell>
                          <TableCell>{f.limit}</TableCell>
                          <TableCell>{f.used}</TableCell>
                          <TableCell className={remaining === 0 ? "text-red-600 font-semibold" : "text-green-700 font-semibold"}>{remaining}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div className={`h-full ${pct>80?"bg-red-500":pct>50?"bg-yellow-500":"bg-green-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-slate-600">{pct.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Section>
          </TabsContent>

          {/* ---------------------------------- Raw ---------------------------------- */}
          <TabsContent value="raw">
            <Section title={<><FileText className="h-5 w-5"/> Document JSON</>} subtitle="Useful for debugging mismatches between API and UI.">
              <ScrollArea className="h-[500px] bg-slate-50 rounded border">
                <pre className="text-xs p-4 whitespace-pre-wrap break-all">{JSON.stringify(data, null, 2)}</pre>
              </ScrollArea>
            </Section>
          </TabsContent>
        </Tabs>

        <Card className="p-4 bg-white/60 backdrop-blur-sm text-sm text-slate-600 shadow-lg border-0">
          <div className="flex flex-col md:flex-row justify-between gap-2">
            <span>Account Created: {fmtDateTime(data.createdAt)}</span>
            <span>Last Updated: {fmtDateTime(data.updatedAt)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

