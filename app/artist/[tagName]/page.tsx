'use client';

import React, { useState, useEffect, use } from 'react';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import NextImage from 'next/image';
import { 
  Loader2, 
  ExternalLink, 
  Globe, 
  Edit2, 
  Check, 
  X, 
  ImageIcon,
  ArrowRight,
  User,
  Shield,
  AlertCircle,
  Upload,
  Star,
  BookOpen,
  MessageSquare,
  History,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  Image as ImageIconLucide,
  Type,
  Info,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Layout,
  Table,
  Quote,
  ImagePlus,
  FileText,
  DollarSign,
  Hash,
  Grid3X3,
  Columns,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Code,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Palette,
  Clock
} from 'lucide-react';
import { 
  SiX,
  SiBluesky,
  SiYoutube, 
  SiPixiv, 
  SiDeviantart, 
  SiArtstation, 
  SiPatreon, 
  SiLinktree 
} from 'react-icons/si';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderWikiContent, WikiTableOfContents } from '@/lib/wikiParser';

interface Artist {
  _id: string;
  tagId: string;
  tagName: string;
  claimedByUserId?: string;
  claimedByUsername?: string;
  verified: boolean;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  socials: {
    twitter?: string;
    bluesky?: string;
    youtube?: string;
    pixiv?: string;
    deviantart?: string;
    artstation?: string;
    patreon?: string;
    linktree?: string;
    carrd?: string;
    website?: string;
    skeb?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Tag {
  _id: string;
  name: string;
  type: string;
  count: number;
}

interface SampleImage {
  _id: string;
  sequentialId: number;
  thumbnailUrl: string;
  url: string;
}

interface Claim {
  _id: string;
  verificationWords: string[];
  verificationMethod: string;
  status: string;
  reviewNotes?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface Review {
  _id: string;
  username: string;
  avatarUrl?: string;
  ratings: {
    trust: number;
    quality: number;
    communication: number;
    pricing?: number;
  };
  comment?: string;
  createdAt: string;
}

interface Wiki {
  content: string;
  infobox?: {
    status?: string;
    specialties?: string[];
    tools?: string[];
    commissions?: 'open' | 'closed' | 'waitlist';
    priceRange?: string;
    languages?: string[];
    customFields?: { label: string; value: string }[];
  };
  lastEditedBy: string;
  lastEditedAt: string;
  editCount: number;
}

// Simple dialog component
function SimpleDialog({ 
  open, 
  onOpenChange, 
  children, 
  trigger 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  children: React.ReactNode;
  trigger: React.ReactNode;
}) {
  if (!open) {
    return <div onClick={() => onOpenChange(true)}>{trigger}</div>;
  }

  return (
    <>
      <div onClick={() => onOpenChange(true)}>{trigger}</div>
      <div className="fixed inset-0 z-50 bg-black/80" onClick={() => onOpenChange(false)} />
      <div className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-full max-w-lg">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-lg max-h-[90vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}

// Star rating component
function StarRating({ 
  value, 
  onChange, 
  readonly = false,
  size = 'md'
}: { 
  value: number; 
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={cn(
            "transition-colors",
            readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
          )}
        >
          <Star
            className={cn(
              sizeClass,
              star <= value 
                ? "fill-yellow-400 text-yellow-400" 
                : "text-zinc-600"
            )}
          />
        </button>
      ))}
    </div>
  );
}

// Wiki Toolbar Component - Enhanced with Wikipedia-style widgets
function WikiToolbar({ 
  onAction, 
  onImageUpload,
  onInsertWidget
}: { 
  onAction: (type: string) => void;
  onImageUpload: (file: File) => void;
  onInsertWidget: (widget: string) => void;
}) {
  const [showWidgets, setShowWidgets] = useState(false);

  const widgetTemplates = [
    { name: 'Infobox', icon: Info, template: '{{Infobox|name=Title|image=|status=Active|location=|website=}}' },
    { name: 'Gallery', icon: Grid3X3, template: '{{Gallery|title=Gallery|cols=4}}\nimage1.jpg|Caption 1\nimage2.jpg|Caption 2\n{{/Gallery}}' },
    { name: 'Quote', icon: Quote, template: '{{Quote|text=Your quote here|author=Author Name}}' },
    { name: 'Notice', icon: Info, template: '{{Notice|title=Note|text=Important information here}}' },
    { name: 'Warning', icon: AlertTriangle, template: '{{Warning|text=Warning message here}}' },
    { name: 'Success', icon: CheckCircle, template: '{{Success|text=Success message here}}' },
    { name: 'Stats', icon: Hash, template: '{{Stats|Followers=10k|Posts=500|Years Active=5}}' },
    { name: 'Commissions', icon: DollarSign, template: '{{Commissions|status=open|slots=3/5|message=Currently accepting commissions!}}' },
    { name: 'Price Table', icon: Table, template: '{{Price table|title=Commission Prices}}\nSketch|$20|Quick sketch\nLineart|$50|Clean lines\nFull Color|$100|Fully rendered\n{{/Price table}}' },
    { name: 'Timeline', icon: ListOrdered, template: '{{Timeline|title=History}}\n2020|Started drawing\n2022|First commission\n2024|Reached 10k followers\n{{/Timeline}}' },
    { name: 'Columns', icon: Columns, template: '{{Columns|count=2}}\nLeft column content\n|||\nRight column content\n{{/Columns}}' },
    { name: 'Card', icon: FileText, template: '{{Card|title=Section Title}}\nCard content goes here\n{{/Card}}' },
    { name: 'Spoiler', icon: ChevronDown, template: '{{Spoiler|title=Click to expand}}\nHidden content here\n{{/Spoiler}}' },
    { name: 'YouTube', icon: SiYoutube, template: '{{YouTube|id=VIDEO_ID}}' },
    { name: 'Image', icon: ImageIconLucide, template: '{{Image|src=URL|caption=Caption|float=right|width=300}}' },
    { name: 'Divider', icon: Minus, template: '{{Divider}}' },
  ];

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-1 p-2">
        {/* Basic formatting */}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onAction('bold')} title="Bold ('''text''')">
          <Bold className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onAction('italic')} title="Italic (''text'')">
          <Italic className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-zinc-800 mx-1 self-center" />
        
        {/* Headers */}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onAction('h1')} title="Heading 1">
          <span className="font-bold text-xs">H1</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onAction('h2')} title="Heading 2">
          <span className="font-bold text-xs">H2</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onAction('h3')} title="Heading 3">
          <span className="font-bold text-xs">H3</span>
        </Button>
        <div className="w-px h-4 bg-zinc-800 mx-1 self-center" />
        
        {/* Lists and links */}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onAction('list')} title="Bullet List">
          <List className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onAction('link')} title="Link">
          <LinkIcon className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onAction('wikilink')} title="Wiki Link ([[tag]])">
          <Hash className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-zinc-800 mx-1 self-center" />
        
        {/* Image upload */}
        <label className="h-8 w-8 p-0 flex items-center justify-center hover:bg-zinc-800 rounded-md cursor-pointer transition-colors" title="Upload Image">
          <ImageIconLucide className="w-4 h-4" />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImageUpload(file);
          }} />
        </label>
        <div className="w-px h-4 bg-zinc-800 mx-1 self-center" />

        {/* Widgets dropdown */}
        <div className="relative">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-3 gap-1.5 text-xs"
            onClick={() => setShowWidgets(!showWidgets)}
          >
            <Grid3X3 className="w-4 h-4" />
            Widgets
            <ChevronDown className={cn("w-3 h-3 transition-transform", showWidgets && "rotate-180")} />
          </Button>
          
          {showWidgets && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowWidgets(false)} />
              <div className="absolute left-0 top-full mt-1 w-72 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-zinc-800 bg-zinc-800/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Insert Widget</p>
                </div>
                <div className="max-h-80 overflow-y-auto p-1">
                  {widgetTemplates.map((widget) => (
                    <button
                      key={widget.name}
                      onClick={() => {
                        onInsertWidget(widget.template);
                        setShowWidgets(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-800 rounded-md transition-colors"
                    >
                      <widget.icon className="w-4 h-4 text-muted-foreground" />
                      {widget.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Help */}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-auto" onClick={() => onAction('help')} title="Formatting Help">
          <HelpCircle className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Wiki Infobox Component
function WikiInfobox({ 
  data, 
  editing, 
  onChange 
}: { 
  data: Wiki['infobox']; 
  editing?: boolean;
  onChange?: (data: Wiki['infobox']) => void;
}) {
  if (!editing && (!data || Object.keys(data).length === 0)) return null;

  const updateField = (field: string, value: any) => {
    if (onChange) onChange({ ...data, [field]: value });
  };

  const addCustomField = () => {
    const fields = data?.customFields || [];
    updateField('customFields', [...fields, { label: '', value: '' }]);
  };

  const updateCustomField = (index: number, key: 'label' | 'value', val: string) => {
    const fields = [...(data?.customFields || [])];
    fields[index][key] = val;
    updateField('customFields', fields);
  };

  const removeCustomField = (index: number) => {
    const fields = (data?.customFields || []).filter((_, i) => i !== index);
    updateField('customFields', fields);
  };

  return (
    <div className="w-full lg:w-72 flex-shrink-0 bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden shadow-lg h-fit sticky top-6">
      <div className="bg-zinc-800/50 p-3 border-b border-zinc-800 text-center font-bold text-sm flex items-center justify-center gap-2">
        <Info className="w-4 h-4 text-primary" />
        Quick Facts
      </div>
      <div className="p-4 space-y-4">
        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</Label>
              <Input size={1} className="h-8 text-xs" value={data?.status || ''} onChange={(e) => updateField('status', e.target.value)} placeholder="Active, Hiatus..." />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Commissions</Label>
              <Select value={data?.commissions || 'closed'} onValueChange={(v) => updateField('commissions', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="waitlist">Waitlist</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Price Range</Label>
              <Input className="h-8 text-xs" value={data?.priceRange || ''} onChange={(e) => updateField('priceRange', e.target.value)} placeholder="$50 - $500" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tools (comma separated)</Label>
              <Input className="h-8 text-xs" value={data?.tools?.join(', ') || ''} onChange={(e) => updateField('tools', e.target.value.split(',').map(s => s.trim()))} placeholder="Photoshop, CSP..." />
            </div>
            
            <div className="pt-2 border-t border-zinc-800">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 block">Custom Fields</Label>
              {(data?.customFields || []).map((field, i) => (
                <div key={i} className="flex gap-1 mb-2">
                  <Input className="h-7 text-[10px] flex-1" value={field.label} onChange={(e) => updateCustomField(i, 'label', e.target.value)} placeholder="Label" />
                  <Input className="h-7 text-[10px] flex-1" value={field.value} onChange={(e) => updateCustomField(i, 'value', e.target.value)} placeholder="Value" />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeCustomField(i)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-7 text-[10px] mt-1" onClick={addCustomField}><Plus className="w-3 h-3 mr-1" />Add Field</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            {data?.status && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-right">{data.status}</span>
              </div>
            )}
            {data?.commissions && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Commissions</span>
                <Badge variant="outline" className={cn(
                  "text-[10px] h-5",
                  data.commissions === 'open' ? "border-green-500/50 text-green-400 bg-green-500/5" :
                  data.commissions === 'waitlist' ? "border-amber-500/50 text-amber-400 bg-amber-500/5" :
                  "border-red-500/50 text-red-400 bg-red-500/5"
                )}>
                  {data.commissions.toUpperCase()}
                </Badge>
              </div>
            )}
            {data?.priceRange && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Price Range</span>
                <span className="font-medium text-right">{data.priceRange}</span>
              </div>
            )}
            {data?.tools && data.tools.length > 0 && (
              <div className="space-y-1">
                <span className="text-muted-foreground block">Tools</span>
                <div className="flex flex-wrap gap-1">
                  {data.tools.map(t => <Badge key={t} variant="secondary" className="text-[9px] h-4 px-1.5">{t}</Badge>)}
                </div>
              </div>
            )}
            {(data?.customFields || []).map((field, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{field.label}</span>
                <span className="font-medium text-right">{field.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArtistPage({ params }: { params: Promise<{ tagName: string }> }) {
  const { tagName } = use(params);
  const { user } = useAuth();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tag, setTag] = useState<Tag | null>(null);
  const [sampleImages, setSampleImages] = useState<SampleImage[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('about');
  
  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRatings, setAvgRatings] = useState({ trust: 0, quality: 0, communication: 0, pricing: 0 });
  const [totalReviews, setTotalReviews] = useState(0);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [myRatings, setMyRatings] = useState({ trust: 0, quality: 0, communication: 0, pricing: 0 });
  const [myComment, setMyComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // Wiki state
  const [wiki, setWiki] = useState<Wiki | null>(null);
  const [editingWiki, setEditingWiki] = useState(false);
  const [wikiContent, setWikiContent] = useState('');
  const [editInfobox, setEditInfobox] = useState<Wiki['infobox']>({});
  const [savingWiki, setSavingWiki] = useState(false);
  const [wikiImageUploading, setWikiImageUploading] = useState(false);
  const [showWikiHelp, setShowWikiHelp] = useState(false);
  
  // Claim modal state
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimStep, setClaimStep] = useState<1 | 2 | 3>(1);
  const [claimStatus, setClaimStatus] = useState<Claim | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<string>('social');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [contactEmailOnly, setContactEmailOnly] = useState(false);
  const [psdFile, setPsdFile] = useState<File | null>(null);
  const [artworkLink, setArtworkLink] = useState('');
  
  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editSocials, setEditSocials] = useState<Artist['socials']>({});
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const decodedTagName = decodeURIComponent(tagName);

  useEffect(() => {
    fetchArtist();
    fetchReviews();
    fetchWiki();
    if (user) {
      fetchClaimStatus();
    }
  }, [tagName, user]);

  const fetchArtist = async () => {
    try {
      const res = await fetch(`/api/artists/${encodeURIComponent(tagName)}`);
      
      // Handle empty or non-JSON responses
      const text = await res.text();
      if (!text) {
        throw new Error('Artist tag not found');
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Artist tag not found');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch artist');
      }

      setArtist(data.artist);
      setTag(data.tag);
      setSampleImages(data.sampleImages || []);
      setImageCount(data.imageCount || 0);
      setEditBio(data.artist.bio || '');
      setEditSocials(data.artist.socials || {});
      setEditAvatarUrl(data.artist.avatarUrl || '');
      setEditBannerUrl(data.artist.bannerUrl || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/artists/${encodeURIComponent(tagName)}/reviews`);
      
      // Handle empty or non-JSON responses
      const text = await res.text();
      if (!text) return;
      
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }
      
      if (data.success) {
        setReviews(data.reviews);
        setAvgRatings(data.avgRatings);
        setTotalReviews(data.totalReviews);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    }
  };

  const fetchWiki = async () => {
    try {
      const res = await fetch(`/api/artists/${encodeURIComponent(tagName)}/wiki`);
      
      // Handle empty or non-JSON responses
      const text = await res.text();
      if (!text) return;
      
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }
      
      if (data.success && data.wiki) {
        setWiki(data.wiki);
        setWikiContent(data.wiki.content);
        setEditInfobox(data.wiki.infobox || {});
      }
    } catch (err) {
      console.error('Failed to fetch wiki:', err);
    }
  };

  const fetchClaimStatus = async () => {
    try {
      const res = await fetch(`/api/artists/${encodeURIComponent(tagName)}/claim`);
      
      // Handle empty or non-JSON responses
      const text = await res.text();
      if (!text) return;
      
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }
      
      if (data.success && data.claim) {
        setClaimStatus(data.claim);
      }
    } catch (err) {
      console.error('Failed to fetch claim status:', err);
    }
  };

  const handleClaim = async () => {
    if (!user) return;
    
    setClaimLoading(true);
    try {
      let psdFileUrl: string | undefined;
      
      // Upload PSD file if provided
      if (verificationMethod === 'psd' && psdFile) {
        const formData = new FormData();
        formData.append('file', psdFile);
        
        const uploadRes = await fetch('/api/upload/claim-file', {
          method: 'POST',
          body: formData,
        });
        
        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          alert(uploadData.error || 'Failed to upload project file');
          setClaimLoading(false);
          return;
        }
        psdFileUrl = uploadData.url;
      }
      
      const res = await fetch(`/api/artists/${encodeURIComponent(tagName)}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          verificationMethod, 
          additionalInfo,
          discordId: contactEmailOnly ? undefined : discordId,
          contactEmailOnly,
          artworkLink: verificationMethod === 'psd' ? artworkLink : undefined,
          psdFileUrl: verificationMethod === 'psd' ? psdFileUrl : undefined,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setClaimStatus(data.claim);
        // Keep modal open to show verification words
      } else {
        alert(data.error || 'Failed to submit claim');
        setClaimModalOpen(false);
      }
    } catch (err) {
      alert('Failed to submit claim');
      setClaimModalOpen(false);
    } finally {
      setClaimLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/artists/${encodeURIComponent(tagName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: editBio,
          socials: editSocials,
          avatarUrl: editAvatarUrl,
          bannerUrl: editBannerUrl,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setArtist(prev => prev ? {
          ...prev,
          bio: editBio,
          socials: editSocials,
          avatarUrl: editAvatarUrl,
          bannerUrl: editBannerUrl,
        } : null);
        setEditing(false);
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch (err) {
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) return;
    if (myRatings.trust === 0 || myRatings.quality === 0 || myRatings.communication === 0) {
      alert('Please rate all required categories');
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/artists/${encodeURIComponent(tagName)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratings: myRatings,
          comment: myComment,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReviewModalOpen(false);
        fetchReviews();
        setMyRatings({ trust: 0, quality: 0, communication: 0, pricing: 0 });
        setMyComment('');
      } else {
        alert(data.error || 'Failed to submit review');
      }
    } catch (err) {
      alert('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSaveWiki = async () => {
    if (!user) return;

    setSavingWiki(true);
    try {
      const res = await fetch(`/api/artists/${encodeURIComponent(tagName)}/wiki`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: wikiContent,
          infobox: editInfobox
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEditingWiki(false);
        fetchWiki();
      } else {
        alert(data.error || 'Failed to save wiki');
      }
    } catch (err) {
      alert('Failed to save wiki');
    } finally {
      setSavingWiki(false);
    }
  };

  const handleWikiAction = (type: string) => {
    if (type === 'help') {
      setShowWikiHelp(true);
      return;
    }

    const textarea = document.querySelector('textarea[name="wiki-content"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    
    let replacement = '';
    let cursorOffset = 0;

    switch (type) {
      case 'bold': 
        replacement = `'''${selected || 'bold text'}'''`; 
        cursorOffset = 3; 
        break;
      case 'italic': 
        replacement = `''${selected || 'italic text'}''`; 
        cursorOffset = 2; 
        break;
      case 'h1': 
        replacement = `\n== ${selected || 'Heading 1'} ==\n`; 
        cursorOffset = 4; 
        break;
      case 'h2': 
        replacement = `\n=== ${selected || 'Heading 2'} ===\n`; 
        cursorOffset = 5; 
        break;
      case 'h3': 
        replacement = `\n==== ${selected || 'Heading 3'} ====\n`; 
        cursorOffset = 6; 
        break;
      case 'list': 
        replacement = `\n* ${selected || 'list item'}`; 
        cursorOffset = 3; 
        break;
      case 'link': 
        replacement = `[${selected || 'link text'}](https://)`; 
        cursorOffset = 1; 
        break;
      case 'wikilink': 
        replacement = `[[${selected || 'tag_name'}]]`; 
        cursorOffset = 2; 
        break;
    }

    const newText = text.substring(0, start) + replacement + text.substring(end);
    setWikiContent(newText);
    
    // Focus back and set selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + replacement.length - cursorOffset);
    }, 0);
  };

  const handleInsertWidget = (widgetTemplate: string) => {
    const textarea = document.querySelector('textarea[name="wiki-content"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = textarea.value;
    
    const newText = text.substring(0, start) + '\n' + widgetTemplate + '\n' + text.substring(start);
    setWikiContent(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1 + widgetTemplate.length);
    }, 0);
  };

  const handleWikiImageUpload = async (file: File) => {
    setWikiImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload/wiki', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (data.success && data.url) {
        const imageMarkdown = `\n![image](${data.url})\n`;
        setWikiContent(prev => prev + imageMarkdown);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err: any) {
      alert(`Failed to upload image: ${err.message}`);
    } finally {
      setWikiImageUploading(false);
    }
  };

  const uploadImage = async (file: File, type: 'avatar' | 'banner') => {
    const setUploading = type === 'avatar' ? setAvatarUploading : setBannerUploading;
    const setUrl = type === 'avatar' ? setEditAvatarUrl : setEditBannerUrl;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      const res = await fetch('/api/upload/profile', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (data.success && data.url) {
        setUrl(data.url);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err: any) {
      alert(`Failed to upload ${type}: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const isOwner = user && artist?.claimedByUserId === user.id && artist?.verified;
  const isAdmin = user && (user.rank === 'admin' || user.rank === 'owner');
  const canEdit = isOwner || isAdmin;
  const canClaim = user && !artist?.verified;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <User className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Artist not found</h1>
        <p className="text-muted-foreground">{error || 'This artist page does not exist'}</p>
        <Link href="/tags?type=artist" className="text-primary hover:underline mt-4 inline-block">
          Browse artists
        </Link>
      </div>
    );
  }

  const formatTagName = (name: string) => name.replace(/_/g, ' ');

  const socialIcons: Record<string, { icon: any; label: string; bgColor: string }> = {
    twitter: { icon: SiX, label: 'X (Twitter)', bgColor: 'bg-black' },
    bluesky: { icon: SiBluesky, label: 'Bluesky', bgColor: 'bg-[#0085ff]' },
    youtube: { icon: SiYoutube, label: 'YouTube', bgColor: 'bg-red-600' },
    pixiv: { icon: SiPixiv, label: 'Pixiv', bgColor: 'bg-[#0096fa]' },
    deviantart: { icon: SiDeviantart, label: 'DeviantArt', bgColor: 'bg-[#05cc47]' },
    artstation: { icon: SiArtstation, label: 'ArtStation', bgColor: 'bg-[#13aff0]' },
    patreon: { icon: SiPatreon, label: 'Patreon', bgColor: 'bg-[#ff424d]' },
    linktree: { icon: SiLinktree, label: 'Linktree', bgColor: 'bg-[#43e55e]' },
    carrd: { icon: Globe, label: 'Carrd', bgColor: 'bg-pink-500' },
    website: { icon: Globe, label: 'Website', bgColor: 'bg-purple-500' },
    skeb: { icon: Palette, label: 'Skeb', bgColor: 'bg-[#00c2b8]' },
  };

  // Social patterns for bio parsing
  const socialPatterns = [
    { pattern: /https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|@)?([\w-]+)/i, type: 'youtube', extract: (m: RegExpMatchArray) => m[3] },
    { pattern: /https?:\/\/(www\.)?(twitter|x)\.com\/([\w-]+)/i, type: 'twitter', extract: (m: RegExpMatchArray) => m[3] },
    { pattern: /https?:\/\/bsky\.app\/profile\/([\w.-]+)/i, type: 'bluesky', extract: (m: RegExpMatchArray) => m[1] },
    { pattern: /https?:\/\/(www\.)?pixiv\.net\/(en\/)?users?\/(\d+)/i, type: 'pixiv', extract: (m: RegExpMatchArray) => m[3] },
    { pattern: /https?:\/\/(www\.)?deviantart\.com\/([\w-]+)/i, type: 'deviantart', extract: (m: RegExpMatchArray) => m[2] },
    { pattern: /https?:\/\/(www\.)?artstation\.com\/([\w-]+)/i, type: 'artstation', extract: (m: RegExpMatchArray) => m[2] },
    { pattern: /https?:\/\/(www\.)?patreon\.com\/([\w-]+)/i, type: 'patreon', extract: (m: RegExpMatchArray) => m[2] },
    { pattern: /https?:\/\/(www\.)?linktr\.ee\/([\w-]+)/i, type: 'linktree', extract: (m: RegExpMatchArray) => m[2] },
    { pattern: /https?:\/\/([\w-]+)\.carrd\.co\/?/i, type: 'carrd', extract: (m: RegExpMatchArray) => m[1] },
    { pattern: /https?:\/\/(www\.)?skeb\.jp\/@([\w-]+)/i, type: 'skeb', extract: (m: RegExpMatchArray) => m[2] },
  ];

  const renderBio = (bio: string) => {
    const parts: React.ReactNode[] = [];
    const combinedPattern = /(https?:\/\/[^\s]+)|#([\w_]+)/g;
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = combinedPattern.exec(bio)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${keyIndex++}`}>{bio.slice(lastIndex, match.index)}</span>);
      }

      if (match[1]) {
        const url = match[1];
        let socialType: string | null = null;
        let username = '';

        for (const { pattern, type, extract } of socialPatterns) {
          const socialMatch = url.match(pattern);
          if (socialMatch) {
            socialType = type;
            username = extract(socialMatch);
            break;
          }
        }

        if (socialType && socialIcons[socialType]) {
          const iconInfo = socialIcons[socialType];
          const Icon = iconInfo.icon;
          parts.push(
            <a
              key={`social-${keyIndex++}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-white transition hover:opacity-80 mx-0.5",
                iconInfo.bgColor
              )}
              style={{ verticalAlign: 'middle' }}
            >
              <Icon className="w-3 h-3" />
              {username}
            </a>
          );
        } else {
          parts.push(
            <a
              key={`link-${keyIndex++}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {url}
            </a>
          );
        }
      } else if (match[2]) {
        const tag = match[2];
        parts.push(
          <Link
            key={`tag-${keyIndex++}`}
            href={`/posts?tags=${encodeURIComponent(tag)}`}
            className="text-primary hover:underline"
          >
            #{tag.replace(/_/g, ' ')}
          </Link>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < bio.length) {
      parts.push(<span key={`text-${keyIndex++}`}>{bio.slice(lastIndex)}</span>);
    }

    return parts;
  };

  const getWebsiteType = (url: string): string => {
    if (/linktr\.ee/i.test(url)) return 'linktree';
    if (/\.carrd\.co/i.test(url)) return 'carrd';
    return 'website';
  };

  const overallRating = totalReviews > 0 
    ? Math.round(((avgRatings.trust + avgRatings.quality + avgRatings.communication) / 3) * 10) / 10
    : 0;

  return (
    <div className="min-h-screen">
      {/* Banner */}
      <div className="relative h-40 md:h-56 bg-gradient-to-r from-red-900/30 to-red-600/20">
        {(editing ? editBannerUrl : artist.bannerUrl) && (
          <NextImage
            src={editing ? editBannerUrl : artist.bannerUrl!}
            alt=""
            fill
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
        {editing && (
          <label className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 rounded-lg cursor-pointer hover:bg-zinc-800/80 transition border border-zinc-700 backdrop-blur-sm text-sm">
            {bannerUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Banner
            <input type="file" accept="image/*" className="hidden" disabled={bannerUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'banner'); }} />
          </label>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="relative -mt-16 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="w-28 h-28 border-4 border-zinc-950 shadow-xl">
                <AvatarImage src={editing ? (editAvatarUrl || sampleImages[0]?.thumbnailUrl) : (artist.avatarUrl || sampleImages[0]?.thumbnailUrl)} />
                <AvatarFallback className="text-2xl bg-red-600/20 text-red-300">
                  {formatTagName(artist.tagName).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {editing && (
                <label className="absolute bottom-0 right-0 p-1.5 bg-zinc-800 rounded-full cursor-pointer hover:bg-zinc-700 transition border border-zinc-700">
                  {avatarUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <input type="file" accept="image/*" className="hidden" disabled={avatarUploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'avatar'); }} />
                </label>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold capitalize truncate">
                  {formatTagName(artist.tagName)}
                </h1>
                {artist.verified && (
                  <Badge className="bg-green-600/20 text-green-400 border-green-500/40 text-xs">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
                {totalReviews > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{overallRating}</span>
                    <span className="text-muted-foreground">({totalReviews})</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {imageCount.toLocaleString()} posts
                {artist.claimedByUsername && (
                  <> • <Link href={`/user/${artist.claimedByUsername}`} className="text-primary hover:underline">@{artist.claimedByUsername}</Link></>
                )}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {canEdit && !editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit2 className="w-3.5 h-3.5 mr-1.5" />Edit
                </Button>
              )}
              {editing && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                    <X className="w-3.5 h-3.5 mr-1.5" />Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                    Save
                  </Button>
                </>
              )}
              {canClaim && !claimStatus && (
                <SimpleDialog open={claimModalOpen} onOpenChange={(open) => {
                  setClaimModalOpen(open);
                  if (!open) setClaimStep(1);
                }}
                  trigger={<Button size="sm" className="bg-red-600 hover:bg-red-700"><User className="w-3.5 h-3.5 mr-1.5" />This You?</Button>}>
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="text-center">
                      <h2 className="text-xl font-bold">Claim This Artist Page</h2>
                      <p className="text-sm text-muted-foreground mt-1">Verify you are <strong className="capitalize">{formatTagName(artist.tagName)}</strong></p>
                    </div>

                    {/* Step Indicator - 3 steps */}
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-300",
                          claimStep >= 1 ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-zinc-800 text-zinc-500"
                        )}>
                          1
                        </div>
                        <span className={cn("text-xs font-medium hidden sm:block", claimStep >= 1 ? "text-primary" : "text-zinc-500")}>Method</span>
                      </div>
                      <div className={cn(
                        "w-8 sm:w-12 h-1 rounded-full transition-all duration-300",
                        claimStep >= 2 ? "bg-primary" : "bg-zinc-800"
                      )} />
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-300",
                          claimStep >= 2 ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-zinc-800 text-zinc-500"
                        )}>
                          2
                        </div>
                        <span className={cn("text-xs font-medium hidden sm:block", claimStep >= 2 ? "text-primary" : "text-zinc-500")}>Details</span>
                      </div>
                      <div className={cn(
                        "w-8 sm:w-12 h-1 rounded-full transition-all duration-300",
                        claimStep >= 3 ? "bg-primary" : "bg-zinc-800"
                      )} />
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-300",
                          claimStep >= 3 ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-zinc-800 text-zinc-500"
                        )}>
                          3
                        </div>
                        <span className={cn("text-xs font-medium hidden sm:block", claimStep >= 3 ? "text-primary" : "text-zinc-500")}>Contact</span>
                      </div>
                    </div>

                    {/* Step 1: Verification Method */}
                    {claimStep === 1 && (
                      <div className="space-y-4">
                        {/* Info notice */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                          <div className="flex gap-2">
                            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-muted-foreground">This is to verify this artist page belongs to you. If you want to <strong>remove your tag completely</strong> from Serika.art, please visit our <Link href="/dmca" className="text-primary hover:underline">DMCA page</Link> instead.</p>
                          </div>
                        </div>

                        {/* Verification Method Selection - Beautiful Card Style */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">How would you like to verify?</Label>
                          <div className="grid gap-2">
                            {[
                              { value: 'social', icon: '📱', label: 'Social Media', desc: 'Add a verification phrase to your bio or post' },
                              { value: 'website', icon: '🌐', label: 'Website', desc: 'Add a verification phrase to your official site' },
                              { value: 'psd', icon: '🎨', label: 'Project File', desc: 'Upload the original PSD/SAI/CLIP file' },
                              { value: 'dm', icon: '✉️', label: 'Twitter DM', desc: 'Send a DM to @serikadev from your account' },
                            ].map((method) => (
                              <button
                                key={method.value}
                                onClick={() => setVerificationMethod(method.value)}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all duration-200",
                                  verificationMethod === method.value
                                    ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/50"
                                )}
                              >
                                <div className={cn(
                                  "flex items-center justify-center w-10 h-10 rounded-lg text-xl transition-all",
                                  verificationMethod === method.value ? "bg-primary/20" : "bg-zinc-800"
                                )}>
                                  {method.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">{method.label}</p>
                                  <p className="text-xs text-muted-foreground truncate">{method.desc}</p>
                                </div>
                                <div className={cn(
                                  "w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center",
                                  verificationMethod === method.value
                                    ? "border-primary bg-primary"
                                    : "border-zinc-600"
                                )}>
                                  {verificationMethod === method.value && (
                                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Navigation */}
                        <div className="flex justify-between pt-2">
                          <Button variant="ghost" onClick={() => setClaimModalOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={() => setClaimStep(2)} className="gap-2">
                            Continue
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Additional Details */}
                    {claimStep === 2 && (
                      <div className="space-y-4">
                        {/* PSD File Upload - Only show for PSD verification */}
                        {verificationMethod === 'psd' && (
                          <>
                            {/* Artwork Selection */}
                            <div className="space-y-3">
                              <Label>Select Artwork</Label>
                              <p className="text-xs text-muted-foreground">Choose the artwork you'll provide the project file for</p>
                              
                              {/* Sample images grid */}
                              {sampleImages.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                  {sampleImages.slice(0, 3).map((img) => (
                                    <button
                                      key={img._id}
                                      type="button"
                                      onClick={() => setArtworkLink(`https://serika.art/image/${img.sequentialId}`)}
                                      className={cn(
                                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                                        artworkLink === `https://serika.art/image/${img.sequentialId}`
                                          ? "border-primary ring-2 ring-primary/30"
                                          : "border-zinc-700 hover:border-zinc-500"
                                      )}
                                    >
                                      <img
                                        src={img.thumbnailUrl || img.url}
                                        alt={`Artwork ${img.sequentialId}`}
                                        className="w-full h-full object-cover"
                                      />
                                      {artworkLink === `https://serika.art/image/${img.sequentialId}` && (
                                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                            <Check className="w-4 h-4 text-primary-foreground" />
                                          </div>
                                        </div>
                                      )}
                                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                        <p className="text-xs text-white text-center">#{img.sequentialId}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Custom URL option */}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="flex-1 h-px bg-zinc-800" />
                                <span>or enter URL</span>
                                <div className="flex-1 h-px bg-zinc-800" />
                              </div>
                              
                              <Input
                                placeholder="https://serika.art/image/..."
                                value={artworkLink}
                                onChange={(e) => setArtworkLink(e.target.value)}
                                className="bg-zinc-900"
                              />
                            </div>

                            {/* File Upload */}
                            <div className="space-y-2">
                              <Label>Upload Project File</Label>
                              <div className={cn(
                                "border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer",
                                psdFile 
                                  ? "border-green-500/50 bg-green-500/5" 
                                  : "border-zinc-700 hover:border-primary/50 hover:bg-zinc-800/30"
                              )}>
                                <input
                                  type="file"
                                  id="psdUpload"
                                  accept=".psd,.sai,.clip,.kra,.xcf,.ai,.sketch"
                                  onChange={(e) => setPsdFile(e.target.files?.[0] || null)}
                                  className="hidden"
                                />
                                <label htmlFor="psdUpload" className="cursor-pointer flex flex-col items-center gap-3">
                                  {psdFile ? (
                                    <>
                                      <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <Check className="w-6 h-6 text-green-500" />
                                      </div>
                                      <div className="text-center">
                                        <p className="font-medium text-sm text-green-400">{psdFile.name}</p>
                                        <p className="text-xs text-muted-foreground">{(psdFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                      </div>
                                      <Button variant="outline" size="sm" type="button" onClick={(e) => { e.preventDefault(); setPsdFile(null); }}>
                                        Remove
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                        <Upload className="w-6 h-6 text-muted-foreground" />
                                      </div>
                                      <div className="text-center">
                                        <p className="font-medium text-sm">Click to upload project file</p>
                                        <p className="text-xs text-muted-foreground">.psd, .sai, .clip, .kra, .xcf, .ai, .sketch</p>
                                      </div>
                                    </>
                                  )}
                                </label>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Additional Info for non-PSD methods */}
                        <div className="space-y-2">
                          <Label>Additional Information {verificationMethod !== 'psd' && '(optional)'}</Label>
                          <Textarea
                            placeholder={
                              verificationMethod === 'social' ? "Link to your social media profile..." :
                              verificationMethod === 'website' ? "Link to your website..." :
                              verificationMethod === 'dm' ? "Your Twitter/X handle..." :
                              "Any additional notes for verification..."
                            }
                            value={additionalInfo}
                            onChange={(e) => setAdditionalInfo(e.target.value)}
                            className="bg-zinc-900 min-h-[100px]"
                          />
                        </div>

                        {/* Navigation */}
                        <div className="flex justify-between pt-2">
                          <Button variant="ghost" onClick={() => setClaimStep(1)} className="gap-2">
                            <ArrowRight className="w-4 h-4 rotate-180" />
                            Back
                          </Button>
                          <Button 
                            onClick={() => setClaimStep(3)} 
                            className="gap-2"
                            disabled={verificationMethod === 'psd' && (!psdFile || !artworkLink.trim())}
                          >
                            Continue
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Contact Information */}
                    {claimStep === 3 && (
                      <div className="space-y-4">
                        {/* Contact Method Selection - Card Buttons */}
                        <div className="space-y-3">
                          <Label>How should we contact you?</Label>
                          <button
                            onClick={() => setContactEmailOnly(false)}
                            className={cn(
                              "w-full p-4 rounded-xl border-2 text-left transition-all hover:border-primary/50",
                              !contactEmailOnly
                                ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                                : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
                                !contactEmailOnly ? "bg-primary/20" : "bg-zinc-800"
                              )}>
                                💬
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">Discord</p>
                                <p className="text-xs text-muted-foreground">Faster response via Discord DM</p>
                              </div>
                              <div className={cn(
                                "w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center",
                                !contactEmailOnly ? "border-primary bg-primary" : "border-zinc-600"
                              )}>
                                {!contactEmailOnly && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => setContactEmailOnly(true)}
                            className={cn(
                              "w-full p-4 rounded-xl border-2 text-left transition-all hover:border-primary/50",
                              contactEmailOnly
                                ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                                : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
                                contactEmailOnly ? "bg-primary/20" : "bg-zinc-800"
                              )}>
                                📧
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">Email Only</p>
                                <p className="text-xs text-muted-foreground">We'll use your account email</p>
                              </div>
                              <div className={cn(
                                "w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center",
                                contactEmailOnly ? "border-primary bg-primary" : "border-zinc-600"
                              )}>
                                {contactEmailOnly && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* Discord Input */}
                        {!contactEmailOnly && (
                          <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <Label htmlFor="discordId">Discord Username</Label>
                            <Input
                              id="discordId"
                              placeholder="e.g. username"
                              value={discordId}
                              onChange={(e) => setDiscordId(e.target.value)}
                              className="bg-zinc-900"
                            />
                            <p className="text-xs text-muted-foreground">pikachubolk may reach out via Discord for verification</p>
                          </div>
                        )}

                        {/* Navigation */}
                        <div className="flex justify-between pt-2">
                          <Button variant="ghost" onClick={() => setClaimStep(2)} className="gap-2">
                            <ArrowRight className="w-4 h-4 rotate-180" />
                            Back
                          </Button>
                          <Button
                            onClick={handleClaim}
                            disabled={claimLoading || (!contactEmailOnly && !discordId.trim())}
                            className="bg-green-600 hover:bg-green-700 gap-2"
                          >
                            {claimLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Submit Claim
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </SimpleDialog>
              )}
              {canClaim && claimStatus && claimStatus.status === 'pending' && (
                <SimpleDialog open={claimModalOpen} onOpenChange={setClaimModalOpen}
                  trigger={<Button size="sm" variant="outline" className="border-amber-500/50 text-amber-400"><Clock className="w-3.5 h-3.5 mr-1.5" />Claim Pending</Button>}>
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold">Your Claim is Pending</h2>
                      <p className="text-sm text-muted-foreground">We're reviewing your claim for <strong className="capitalize">{formatTagName(artist.tagName)}</strong></p>
                    </div>
                    
                    {claimStatus.verificationMethod !== 'psd' && (
                      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Shield className="w-4 h-4 text-primary" />
                          Your Verification Phrase
                        </div>
                        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 font-mono text-lg text-center text-primary tracking-wide">
                          {claimStatus.verificationWords?.join(' ')}
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          {claimStatus.verificationMethod === 'social' && 'Add this phrase to your Twitter/X bio or make a post containing it.'}
                          {claimStatus.verificationMethod === 'website' && 'Add this phrase somewhere visible on your official website.'}
                          {claimStatus.verificationMethod === 'dm' && 'Include this phrase when DMing @serikadev on Twitter.'}
                        </p>
                      </div>
                    )}

                    {claimStatus.verificationMethod === 'psd' && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-400">
                          <Check className="w-4 h-4" />
                          Project File Received
                        </div>
                        <p className="text-xs text-muted-foreground">
                          We've received your project file and are reviewing it. We'll verify the file matches the artwork you selected.
                        </p>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong>Method:</strong> {
                        claimStatus.verificationMethod === 'social' ? 'Social bio/post' :
                        claimStatus.verificationMethod === 'website' ? 'Website' :
                        claimStatus.verificationMethod === 'psd' ? 'PSD/Project file' :
                        'Twitter DM'
                      }</p>
                      <p><strong>Submitted:</strong> {new Date(claimStatus.createdAt).toLocaleDateString()}</p>
                    </div>
                    
                    <Button variant="outline" className="w-full" onClick={() => setClaimModalOpen(false)}>Close</Button>
                  </div>
                </SimpleDialog>
              )}
              <Link href={`/posts?tags=${encodeURIComponent(artist.tagName)}`}>
                <Button size="sm">View Posts<ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="pb-12">
          <TabsList className="bg-zinc-900/50 border border-zinc-800 mb-6">
            <TabsTrigger value="about" className="gap-1.5"><User className="w-4 h-4" />About</TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5"><Star className="w-4 h-4" />Reviews ({totalReviews})</TabsTrigger>
            <TabsTrigger value="wiki" className="gap-1.5"><BookOpen className="w-4 h-4" />Wiki</TabsTrigger>
          </TabsList>

          {/* About Tab */}
          <TabsContent value="about" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Bio */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3"><CardTitle className="text-base">About</CardTitle></CardHeader>
                  <CardContent>
                    {editing ? (
                      <div className="space-y-2">
                        <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)}
                          placeholder="Write a bio... Paste social links for badges, use #tag for tag links."
                          className="min-h-24 text-sm" />
                        <p className="text-xs text-muted-foreground">Paste URLs for badges. Use #tagname for links.</p>
                      </div>
                    ) : artist.bio ? (
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{renderBio(artist.bio)}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No bio yet.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Works */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="w-4 h-4" />Recent Works</CardTitle>
                    <Link href={`/posts?tags=${encodeURIComponent(artist.tagName)}`} className="text-xs text-primary hover:underline">View all →</Link>
                  </CardHeader>
                  <CardContent>
                    {sampleImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {sampleImages.slice(0, 6).map((img) => (
                          <Link key={img._id} href={`/image/${img.sequentialId}`}
                            className="relative aspect-square rounded-lg overflow-hidden bg-zinc-800 hover:opacity-80 transition">
                            <NextImage src={img.thumbnailUrl} alt="" fill className="object-cover" />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">No posts yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Links */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3"><CardTitle className="text-base">Links</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {editing ? (
                      <div className="space-y-3">
                        {Object.entries(socialIcons).map(([key, { label }]) => (
                          <div key={key}>
                            <Label className="text-xs text-muted-foreground">{label}</Label>
                            <Input placeholder={`${label} URL`} className="h-8 text-sm mt-1"
                              value={editSocials[key as keyof typeof editSocials] || ''}
                              onChange={(e) => setEditSocials(prev => ({ ...prev, [key]: e.target.value }))} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {Object.entries(artist.socials || {}).filter(([_, v]) => v).length > 0 ? (
                          Object.entries(artist.socials || {}).map(([key, value]) => {
                            if (!value) return null;
                            let socialKey = key === 'website' ? getWebsiteType(value) : key;
                            const social = socialIcons[socialKey] || socialIcons.website;
                            const Icon = social.icon;
                            let displayText = social.label;
                            try {
                              const url = new URL(value.startsWith('http') ? value : `https://${value}`);
                              const pathParts = url.pathname.split('/').filter(Boolean);
                              if (pathParts.length > 0 && pathParts[pathParts.length - 1] !== 'c') {
                                displayText = pathParts[pathParts.length - 1];
                              }
                              if (socialKey === 'carrd') displayText = url.hostname.split('.')[0];
                            } catch {}
                            return (
                              <a key={key} href={value.startsWith('http') ? value : `https://${value}`}
                                target="_blank" rel="noopener noreferrer"
                                className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white transition hover:opacity-80", social.bgColor)}>
                                <Icon className="w-4 h-4" />
                                <span className="flex-1 truncate font-medium">{displayText}</span>
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </a>
                            );
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground">No links added yet</p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                {totalReviews > 0 && (
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Ratings</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {[
                        { label: 'Trust', value: avgRatings.trust },
                        { label: 'Quality', value: avgRatings.quality },
                        { label: 'Communication', value: avgRatings.communication },
                        ...(avgRatings.pricing > 0 ? [{ label: 'Pricing', value: avgRatings.pricing }] : []),
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{label}</span>
                          <div className="flex items-center gap-1">
                            <StarRating value={Math.round(value)} readonly size="sm" />
                            <span className="text-sm font-medium ml-1">{value}</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="mt-0">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Reviews Summary Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6">
                <div className="text-center md:border-r border-zinc-800">
                  <div className="text-5xl font-bold text-white mb-1">{overallRating}</div>
                  <div className="flex justify-center mb-2">
                    <StarRating value={Math.round(overallRating)} readonly />
                  </div>
                  <div className="text-sm text-muted-foreground">Based on {totalReviews} reviews</div>
                </div>
                
                <div className="md:col-span-2 space-y-3">
                  {[
                    { label: 'Trust', value: avgRatings.trust, color: 'bg-blue-500' },
                    { label: 'Quality', value: avgRatings.quality, color: 'bg-purple-500' },
                    { label: 'Communication', value: avgRatings.communication, color: 'bg-green-500' },
                    ...(avgRatings.pricing > 0 ? [{ label: 'Pricing', value: avgRatings.pricing, color: 'bg-amber-500' }] : []),
                  ].map((rating) => (
                    <div key={rating.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>{rating.label}</span>
                        <span className="text-muted-foreground">{rating.value} / 5</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-500", rating.color)}
                          style={{ width: `${(rating.value / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Review Button */}
              {user && (
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">User Reviews</h3>
                  <SimpleDialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}
                    trigger={<Button className="bg-primary hover:bg-primary/90"><MessageSquare className="w-4 h-4 mr-2" />Write a Review</Button>}>
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold">Review {formatTagName(artist.tagName)}</h2>
                      <div className="space-y-3">
                        {[
                          { key: 'trust', label: 'Trust', desc: 'Reliability and honesty' },
                          { key: 'quality', label: 'Quality', desc: 'Art quality and skill' },
                          { key: 'communication', label: 'Communication', desc: 'Response time and clarity' },
                          { key: 'pricing', label: 'Pricing (optional)', desc: 'Value for commissions' },
                        ].map(({ key, label, desc }) => (
                          <div key={key} className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{label}</p>
                              <p className="text-xs text-muted-foreground">{desc}</p>
                            </div>
                            <StarRating value={myRatings[key as keyof typeof myRatings]}
                              onChange={(v) => setMyRatings(prev => ({ ...prev, [key]: v }))} />
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label>Comment (optional)</Label>
                        <Textarea placeholder="Share your experience..." value={myComment}
                          onChange={(e) => setMyComment(e.target.value)} className="mt-1" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setReviewModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmitReview} disabled={submittingReview}>
                          {submittingReview && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Submit
                        </Button>
                      </div>
                    </div>
                  </SimpleDialog>
                </div>
              )}

              {/* Reviews List */}
              {reviews.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviews.map((review) => (
                    <Card key={review._id} className="bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/60 transition-colors">
                      <CardContent className="pt-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 border border-zinc-800">
                              <AvatarImage src={review.avatarUrl} />
                              <AvatarFallback className="bg-zinc-800 text-zinc-400">{review.username.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <Link href={`/user/${review.username}`} className="font-bold text-sm text-white hover:text-primary transition-colors">{review.username}</Link>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{new Date(review.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 bg-zinc-800/50 px-2 py-1 rounded-lg">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="font-bold text-xs text-white">
                              {Math.round(((review.ratings.trust + review.ratings.quality + review.ratings.communication) / 3) * 10) / 10}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          {[
                            { label: 'Trust', value: review.ratings.trust },
                            { label: 'Quality', value: review.ratings.quality },
                            { label: 'Comm.', value: review.ratings.communication },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">{label}</span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <div key={s} className={cn("w-1.5 h-1.5 rounded-full", s <= value ? "bg-primary" : "bg-zinc-800")} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {review.comment && (
                          <div className="relative">
                            <MessageSquare className="w-4 h-4 text-zinc-800 absolute -top-1 -left-1 opacity-50" />
                            <p className="text-sm text-zinc-300 leading-relaxed pl-4 italic">"{review.comment}"</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="py-16 text-center">
                    <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Star className="w-8 h-8 text-zinc-700" />
                    </div>
                    <h4 className="text-lg font-medium text-white mb-1">No reviews yet</h4>
                    <p className="text-muted-foreground max-w-xs mx-auto">Be the first to share your experience with this artist!</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Wiki Tab */}
          <TabsContent value="wiki" className="mt-0">
            {/* Full-width wiki - not contained */}
            <div className="w-full">
              {/* Wiki Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Artist Wiki</h2>
                    <p className="text-xs text-muted-foreground">Community-maintained encyclopedia</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {user && !editingWiki && (
                    <Button variant="outline" size="sm" onClick={() => setEditingWiki(true)}>
                      <Edit2 className="w-4 h-4 mr-2" />Edit Wiki
                    </Button>
                  )}
                  {editingWiki && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setEditingWiki(false); setWikiContent(wiki?.content || ''); setEditInfobox(wiki?.infobox || {}); }}>
                        <X className="w-4 h-4 mr-2" />Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveWiki} disabled={savingWiki}>
                        {savingWiki ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                        Save Changes
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {editingWiki ? (
                /* Wiki Editor - Full Width */
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden">
                  <WikiToolbar 
                    onAction={handleWikiAction} 
                    onImageUpload={handleWikiImageUpload}
                    onInsertWidget={handleInsertWidget}
                  />
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
                    {/* Editor */}
                    <div className="relative">
                      <div className="p-2 bg-zinc-800/30 border-b border-zinc-800 flex items-center gap-2">
                        <Code className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Source</span>
                      </div>
                      <Textarea 
                        name="wiki-content"
                        value={wikiContent} 
                        onChange={(e) => setWikiContent(e.target.value)}
                        placeholder={`Write wiki content using Wikipedia-style markup...

== Section Title ==

Regular text with '''bold''' and ''italic'' formatting.

* Bullet list item 1
* Bullet list item 2

[[tag_name|Link to tag]]
[External Link](https://example.com)

{{Infobox|name=Artist Name|status=Active}}

{{Quote|text=A memorable quote|author=Someone}}
`}
                        className="min-h-[600px] font-mono text-sm bg-transparent border-0 focus-visible:ring-0 resize-none p-6 leading-relaxed" 
                      />
                      {wikiImageUploading && (
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-20">
                          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full flex items-center gap-2 shadow-xl">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span className="text-xs font-medium">Uploading image...</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Live Preview */}
                    <div className="bg-zinc-950/30">
                      <div className="p-2 bg-zinc-800/30 border-b border-zinc-800 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Preview</span>
                      </div>
                      <div className="p-6 max-h-[600px] overflow-y-auto">
                        {wikiContent ? (
                          <div className="wiki-content">
                            {renderWikiContent(wikiContent)}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">Start typing to see preview...</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : wiki?.content ? (
                /* Wiki Display - Full Width */
                <div className="wiki-article">
                  {/* Table of Contents */}
                  <WikiTableOfContents content={wiki.content} />
                  
                  {/* Wiki Content - Rendered */}
                  <article className="wiki-content">
                    {renderWikiContent(wiki.content)}
                  </article>
                  
                  {/* Categories */}
                  {wiki.content.includes('[[Category:') && (
                    <div className="mt-12 pt-6 border-t border-zinc-800">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Categories</p>
                      <div className="flex flex-wrap gap-2">
                        {(wiki.content.match(/\[\[Category:([^\]]+)\]\]/gi) || []).map((cat, i) => {
                          const name = cat.match(/\[\[Category:([^\]]+)\]\]/i)?.[1] || '';
                          return (
                            <Badge key={i} variant="outline" className="text-xs">
                              {name}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Wiki Footer */}
                  <div className="mt-12 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-zinc-800 text-xs">{wiki.lastEditedBy.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs text-muted-foreground">Last edited by</p>
                        <p className="text-sm font-medium">{wiki.lastEditedBy}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <History className="w-4 h-4" /> {wiki.editCount} revisions
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-4 h-4" /> {new Date(wiki.lastEditedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty Wiki State */
                <div className="text-center py-24 bg-zinc-900/20 rounded-2xl border border-zinc-800/50">
                  <div className="w-24 h-24 bg-zinc-800/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookOpen className="w-12 h-12 text-zinc-700" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">No wiki content yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    Help the community by starting a wiki for this artist. Document their history, art style, commission info, and more.
                  </p>
                  {user && (
                    <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={() => setEditingWiki(true)}>
                      <Plus className="w-5 h-5 mr-2" />Create Wiki Page
                    </Button>
                  )}
                </div>
              )}

              {/* Wiki Help Modal */}
              {showWikiHelp && (
                <>
                  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={() => setShowWikiHelp(false)} />
                  <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl max-h-[85vh] overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
                    <div className="sticky top-0 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800 border-b border-zinc-800 p-4 flex items-center justify-between">
                      <h3 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <HelpCircle className="w-5 h-5 text-primary" />
                        </div>
                        Wiki Formatting Guide
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setShowWikiHelp(false)} className="rounded-xl">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="overflow-y-auto max-h-[calc(85vh-72px)]">
                      <Tabs defaultValue="basics" className="w-full">
                        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-2">
                          <TabsList className="grid grid-cols-6 w-full bg-zinc-800/50">
                            <TabsTrigger value="basics" className="text-xs">✨ Basics</TabsTrigger>
                            <TabsTrigger value="styling" className="text-xs">🎨 Styling</TabsTrigger>
                            <TabsTrigger value="layout" className="text-xs">📐 Layout</TabsTrigger>
                            <TabsTrigger value="widgets" className="text-xs">🧩 Widgets</TabsTrigger>
                            <TabsTrigger value="media" className="text-xs">🖼️ Media</TabsTrigger>
                            <TabsTrigger value="llm" className="text-xs">🤖 AI Guide</TabsTrigger>
                          </TabsList>
                        </div>
                        
                        {/* Basics Tab */}
                        <TabsContent value="basics" className="p-6 space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Text Formatting */}
                            <div className="space-y-3">
                              <h4 className="font-bold text-primary flex items-center gap-2">
                                <Type className="w-4 h-4" />
                                Text Formatting
                              </h4>
                              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono">{`'''text'''`}</code>
                                  <span className="text-sm"><strong>Bold text</strong></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono">{`''text''`}</code>
                                  <span className="text-sm"><em>Italic text</em></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono">{`\`code\``}</code>
                                  <code className="text-xs bg-zinc-800 px-2 py-1 rounded">code</code>
                                </div>
                                <div className="flex items-center justify-between">
                                  <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono">{`----`}</code>
                                  <span className="text-xs text-muted-foreground">Horizontal line</span>
                                </div>
                              </div>
                            </div>

                            {/* Headings */}
                            <div className="space-y-3">
                              <h4 className="font-bold text-primary flex items-center gap-2">
                                <Heading1 className="w-4 h-4" />
                                Headings
                              </h4>
                              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono">{`== Title ==`}</code>
                                  <span className="text-lg font-bold">Title</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono">{`=== Subtitle ===`}</code>
                                  <span className="text-base font-bold">Subtitle</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono">{`==== Section ====`}</code>
                                  <span className="text-sm font-bold">Section</span>
                                </div>
                              </div>
                            </div>

                            {/* Links */}
                            <div className="space-y-3">
                              <h4 className="font-bold text-primary flex items-center gap-2">
                                <LinkIcon className="w-4 h-4" />
                                Links
                              </h4>
                              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                <div>
                                  <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`[[tag_name]]`}</code>
                                  <span className="text-xs text-muted-foreground">→ Link to a tag</span>
                                </div>
                                <div>
                                  <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`[[tag|Custom Text]]`}</code>
                                  <span className="text-xs text-muted-foreground">→ Link with custom text</span>
                                </div>
                                <div>
                                  <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`[Link](https://url)`}</code>
                                  <span className="text-xs text-muted-foreground">→ External link</span>
                                </div>
                              </div>
                            </div>

                            {/* Lists */}
                            <div className="space-y-3">
                              <h4 className="font-bold text-primary flex items-center gap-2">
                                <List className="w-4 h-4" />
                                Lists
                              </h4>
                              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2 font-mono text-xs">
                                <p className="text-muted-foreground"># Bullet list:</p>
                                <p>* First item</p>
                                <p>* Second item</p>
                                <p>* Third item</p>
                                <p className="text-muted-foreground mt-3"># Also works:</p>
                                <p>- Item one</p>
                                <p>- Item two</p>
                              </div>
                            </div>
                          </div>

                          {/* Categories */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              <Hash className="w-4 h-4" />
                              Categories
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <p className="text-sm text-zinc-300 mb-2">Add categories to organize artist pages:</p>
                              <div className="flex flex-wrap gap-2">
                                <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono">{`[[Category:Digital Artist]]`}</code>
                                <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono">{`[[Category:Commission Open]]`}</code>
                                <code className="text-xs bg-zinc-900 px-2 py-1 rounded font-mono">{`[[Category:VTuber Artist]]`}</code>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        {/* Styling Tab */}
                        <TabsContent value="styling" className="p-6 space-y-6">
                          {/* Colors */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              <Palette className="w-4 h-4" />
                              Colors & Highlights
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-muted-foreground mb-2">COLOR TEXT</p>
                                <div>
                                  <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`{{Color|color=#ff6b6b|text=Red text}}`}</code>
                                  <span className="text-sm" style={{color: '#ff6b6b'}}>Red text</span>
                                </div>
                                <div>
                                  <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`{{Color|color=#4ecdc4|bg=#1a1a2e|text=With BG}}`}</code>
                                  <span className="text-sm px-2 py-0.5 rounded" style={{color: '#4ecdc4', backgroundColor: '#1a1a2e'}}>With BG</span>
                                </div>
                              </div>
                              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-muted-foreground mb-2">HIGHLIGHTS</p>
                                <div>
                                  <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`{{Highlight|yellow|Important!}}`}</code>
                                  <mark className="px-1.5 py-0.5 rounded bg-yellow-500/30 text-yellow-200">Important!</mark>
                                </div>
                                <div>
                                  <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`{{Highlight|color=pink|text=Pink}}`}</code>
                                  <mark className="px-1.5 py-0.5 rounded bg-pink-500/30 text-pink-200">Pink</mark>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Colors: yellow, green, blue, pink, purple, red, orange, cyan</p>
                              </div>
                            </div>
                          </div>

                          {/* Gradients & Effects */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              ✨ Gradients & Effects
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-muted-foreground mb-2">GRADIENT TEXT</p>
                                <div>
                                  <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`{{Gradient|from=#ec4899|to=#8b5cf6|text=Gradient}}`}</code>
                                  <span className="font-bold text-lg" style={{backgroundImage: 'linear-gradient(to right, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>Gradient</span>
                                </div>
                                <div>
                                  <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`{{Gradient|from=#00d9ff|via=#00ff88|to=#ffee00|text=Rainbow}}`}</code>
                                  <span className="font-bold text-lg" style={{backgroundImage: 'linear-gradient(to right, #00d9ff, #00ff88, #ffee00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>Rainbow</span>
                                </div>
                              </div>
                              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-muted-foreground mb-2">GLOW EFFECT</p>
                                <div>
                                  <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`{{Glow|color=#ec4899|text=Glowing}}`}</code>
                                  <span className="font-bold" style={{color: '#ec4899', textShadow: '0 0 10px #ec4899, 0 0 20px #ec489940'}}>Glowing</span>
                                </div>
                                <div>
                                  <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-1">{`{{Glow|color=#00ff88|intensity=15|text=Intense}}`}</code>
                                  <span className="font-bold" style={{color: '#00ff88', textShadow: '0 0 15px #00ff88, 0 0 30px #00ff8840'}}>Intense</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              🏷️ Badges
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Badge|text=Pro Artist|variant=default}}`}</code>
                              <div className="flex flex-wrap gap-2">
                                <Badge>Default</Badge>
                                <Badge variant="secondary">Secondary</Badge>
                                <Badge variant="destructive">Destructive</Badge>
                                <Badge variant="outline">Outline</Badge>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bars */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              📊 Progress Bars
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{Progress|label=Commission Slots|value=3|max=5|color=green}}`}</code>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-zinc-300">Commission Slots</span>
                                  <span className="text-muted-foreground">3/5</span>
                                </div>
                                <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-500 rounded-full" style={{width: '60%'}} />
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-2">Colors: primary, green, blue, purple, pink, orange, red</p>
                            </div>
                          </div>
                        </TabsContent>

                        {/* Layout Tab */}
                        <TabsContent value="layout" className="p-6 space-y-6">
                          {/* Alignment */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              📐 Text Alignment
                            </h4>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono">{`{{Left|text}}`}</code>
                                <p className="text-left text-sm mt-2 text-zinc-300">Left aligned</p>
                              </div>
                              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono">{`{{Center|text}}`}</code>
                                <p className="text-center text-sm mt-2 text-zinc-300">Centered</p>
                              </div>
                              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono">{`{{Right|text}}`}</code>
                                <p className="text-right text-sm mt-2 text-zinc-300">Right aligned</p>
                              </div>
                            </div>
                          </div>

                          {/* Columns */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              <Columns className="w-4 h-4" />
                              Columns Layout
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Columns|cols=2}}`}</code>
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">Column 1 content</code>
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">|||</code>
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">Column 2 content</code>
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{/Columns}}`}</code>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-zinc-900/50 p-3 rounded-lg text-sm text-zinc-300">Column 1</div>
                                <div className="bg-zinc-900/50 p-3 rounded-lg text-sm text-zinc-300">Column 2</div>
                              </div>
                            </div>
                          </div>

                          {/* Grid */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              <Grid3X3 className="w-4 h-4" />
                              Grid Layout
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{Grid|cols=3|gap=4}}Item 1|||Item 2|||Item 3{{/Grid}}`}</code>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-zinc-900/50 p-2 rounded text-xs text-center text-zinc-300">Item 1</div>
                                <div className="bg-zinc-900/50 p-2 rounded text-xs text-center text-zinc-300">Item 2</div>
                                <div className="bg-zinc-900/50 p-2 rounded text-xs text-center text-zinc-300">Item 3</div>
                              </div>
                            </div>
                          </div>

                          {/* Box & Card */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              📦 Boxes & Cards
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-zinc-800/50 rounded-xl p-4">
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Box|bg=#1e1e2e|border=#ec4899}}`}</code>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">Content here</code>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{/Box}}`}</code>
                                <div className="p-3 rounded-lg text-sm" style={{backgroundColor: '#1e1e2e', border: '1px solid #ec4899'}}>
                                  Custom box
                                </div>
                              </div>
                              <div className="bg-zinc-800/50 rounded-xl p-4">
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Card|title=My Card}}`}</code>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`Content{{/Card}}`}</code>
                                <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-3">
                                  <p className="font-bold text-sm mb-1">My Card</p>
                                  <p className="text-xs text-zinc-400">Content</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Spacer & Divider */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              ↕️ Spacing
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Spacer|size=lg}}`}</code>
                                  <p className="text-xs text-muted-foreground">Sizes: xs, sm, md, lg, xl, 2xl</p>
                                </div>
                                <div>
                                  <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Divider}}`}</code>
                                  <hr className="border-zinc-700 my-2" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        {/* Widgets Tab */}
                        <TabsContent value="widgets" className="p-6 space-y-6">
                          {/* Infobox */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              📋 Infobox
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <pre className="text-[10px] bg-zinc-900 p-3 rounded-lg font-mono overflow-x-auto mb-3">{`{{Infobox
|name=Artist Name
|image=https://example.com/photo.jpg
|caption=Profile photo
|status=Active
|nationality=Japan
|website=https://mysite.com
|specialty=Digital Art
}}`}</pre>
                              <p className="text-xs text-muted-foreground">Creates a Wikipedia-style infobox floating on the right</p>
                            </div>
                          </div>

                          {/* Notices & Callouts */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              📢 Notices & Callouts
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4 space-y-4">
                              <div>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Notice|title=Note|text=Important info}}`}</code>
                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex gap-2">
                                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-bold text-blue-400">Note</p>
                                    <p className="text-xs text-zinc-300">Important info</p>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Warning|text=Be careful!}}`}</code>
                                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                  <p className="text-xs text-zinc-300">Be careful!</p>
                                </div>
                              </div>
                              <div>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Success|text=Completed!}}`}</code>
                                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                                  <p className="text-xs text-zinc-300">Completed!</p>
                                </div>
                              </div>
                              <div>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Callout|type=tip|emoji=💡|title=Pro Tip|text=Use this for tips}}`}</code>
                                <p className="text-xs text-muted-foreground">Types: note, tip, important, warning, caution, quote, example</p>
                              </div>
                            </div>
                          </div>

                          {/* Quote */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              <Quote className="w-4 h-4" />
                              Quotes
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{Quote|text=Art is never finished, only abandoned.|author=Leonardo da Vinci}}`}</code>
                              <blockquote className="pl-4 border-l-4 border-primary/50 bg-zinc-900/30 py-3 pr-4 rounded-r-lg">
                                <p className="text-zinc-300 italic text-sm">"Art is never finished, only abandoned."</p>
                                <cite className="block mt-1 text-xs text-muted-foreground not-italic">— Leonardo da Vinci</cite>
                              </blockquote>
                            </div>
                          </div>

                          {/* Stats & Commissions */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <h4 className="font-bold text-primary flex items-center gap-2">
                                📊 Stats
                              </h4>
                              <div className="bg-zinc-800/50 rounded-xl p-4">
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{Stats|Followers=50K|Posts=1.2K|Years=5}}`}</code>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="text-center p-2 bg-zinc-900/50 rounded-lg">
                                    <div className="text-sm font-bold">50K</div>
                                    <div className="text-[8px] text-muted-foreground uppercase">Followers</div>
                                  </div>
                                  <div className="text-center p-2 bg-zinc-900/50 rounded-lg">
                                    <div className="text-sm font-bold">1.2K</div>
                                    <div className="text-[8px] text-muted-foreground uppercase">Posts</div>
                                  </div>
                                  <div className="text-center p-2 bg-zinc-900/50 rounded-lg">
                                    <div className="text-sm font-bold">5</div>
                                    <div className="text-[8px] text-muted-foreground uppercase">Years</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <h4 className="font-bold text-primary flex items-center gap-2">
                                💼 Commissions
                              </h4>
                              <div className="bg-zinc-800/50 rounded-xl p-4">
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{Commissions|status=open|slots=3/5}}`}</code>
                                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold">Commissions</span>
                                    <Badge className="bg-green-500/20 text-green-400 text-[10px]">OPEN</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">Slots: 3/5</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Collapsible & Spoiler */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              🔽 Collapsible Sections
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{Collapsed|title=Click to expand}}Hidden content here{{/Collapsed}}`}</code>
                              <div className="border border-zinc-700 rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-zinc-900/50 flex items-center justify-between text-sm">
                                  Click to expand
                                  <ChevronDown className="w-4 h-4" />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Feature & Hero */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              🌟 Feature & Hero
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                              <div>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Feature|icon=🎨|title=Digital Art|desc=Specializing in anime style}}`}</code>
                                <div className="flex gap-3 p-3 bg-gradient-to-r from-zinc-900/80 to-zinc-900/40 border border-zinc-700 rounded-xl">
                                  <span className="text-2xl">🎨</span>
                                  <div>
                                    <p className="font-bold text-sm">Digital Art</p>
                                    <p className="text-xs text-zinc-400">Specializing in anime style</p>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-2">{`{{Hero|title=Welcome|subtitle=To my art page}}`}</code>
                                <p className="text-xs text-muted-foreground">Creates a large banner section</p>
                              </div>
                            </div>
                          </div>

                          {/* Timeline */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              📅 Timeline
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <pre className="text-[10px] bg-zinc-900 p-3 rounded-lg font-mono overflow-x-auto mb-3">{`{{Timeline|title=Career}}
2020 - Started digital art
2021 - First commission
2023 - Reached 10K followers
{{/Timeline}}`}</pre>
                              <p className="text-xs text-muted-foreground">Creates a beautiful vertical timeline</p>
                            </div>
                          </div>
                        </TabsContent>

                        {/* Media Tab */}
                        <TabsContent value="media" className="p-6 space-y-6">
                          {/* Images */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              🖼️ Images
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4 space-y-4">
                              <div>
                                <p className="text-xs font-bold text-muted-foreground mb-2">BASIC IMAGE</p>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block">{`{{Image|src=https://example.com/img.jpg|caption=My artwork}}`}</code>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-muted-foreground mb-2">WITH SIZE & POSITION</p>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block">{`{{Image|src=URL|width=300|height=200|float=right}}`}</code>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-muted-foreground mb-2">WITH ALIGNMENT</p>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block">{`{{Image|src=URL|align=center|caption=Centered image}}`}</code>
                                <p className="text-[10px] text-muted-foreground mt-1">align: left, center, right</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-muted-foreground mb-2">WITH EFFECTS</p>
                                <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block">{`{{Image|src=URL|effect=zoom|shadow=true|border=true}}`}</code>
                                <p className="text-[10px] text-muted-foreground mt-1">Effects: grayscale, sepia, blur, zoom, rotate, glow</p>
                              </div>
                            </div>
                          </div>

                          {/* Gallery */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              🖼️ Gallery
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <pre className="text-[10px] bg-zinc-900 p-3 rounded-lg font-mono overflow-x-auto mb-3">{`{{Gallery|title=My Best Works|cols=4}}
image1.jpg|First artwork
image2.jpg|Second artwork
image3.jpg|Third artwork
{{/Gallery}}`}</pre>
                              <div className="grid grid-cols-4 gap-2">
                                {[1,2,3,4].map(i => (
                                  <div key={i} className="aspect-square bg-zinc-900/50 rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                                    {i}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Avatar */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              👤 Avatar
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{Avatar|src=URL|size=lg|name=Artist|border=true}}`}</code>
                              <div className="flex gap-3 items-end">
                                <div className="w-8 h-8 rounded-full bg-zinc-700" />
                                <div className="w-12 h-12 rounded-full bg-zinc-700" />
                                <div className="w-16 h-16 rounded-full bg-zinc-700 ring-2 ring-primary" />
                                <div className="w-24 h-24 rounded-full bg-zinc-700" />
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-2">Sizes: xs, sm, md, lg, xl</p>
                            </div>
                          </div>

                          {/* YouTube */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              📺 YouTube Videos
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{YouTube|id=VIDEO_ID_HERE}}`}</code>
                              <div className="aspect-video bg-zinc-900/50 rounded-lg flex items-center justify-center">
                                <div className="text-4xl">▶️</div>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-2">Get the VIDEO_ID from the YouTube URL (e.g., dQw4w9WgXcQ)</p>
                            </div>
                          </div>

                          {/* Showcase */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              ✨ Showcase
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{Showcase|image=URL|title=Featured Work|position=left}}Description text{{/Showcase}}`}</code>
                              <div className="flex gap-4 items-center">
                                <div className="w-20 h-20 bg-zinc-900/50 rounded-lg flex-shrink-0" />
                                <div>
                                  <p className="font-bold text-sm">Featured Work</p>
                                  <p className="text-xs text-zinc-400">Description text</p>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-2">position: left, right</p>
                            </div>
                          </div>

                          {/* Socials */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              🔗 Social Links
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <code className="text-[10px] bg-zinc-900 px-2 py-1 rounded font-mono block mb-3">{`{{Socials|Twitter=@username|Pixiv=12345|YouTube=channel}}`}</code>
                              <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1.5 bg-zinc-900 rounded-full text-xs">Twitter</span>
                                <span className="px-3 py-1.5 bg-zinc-900 rounded-full text-xs">Pixiv</span>
                                <span className="px-3 py-1.5 bg-zinc-900 rounded-full text-xs">YouTube</span>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        {/* LLM Guide Tab */}
                        <TabsContent value="llm" className="p-6 space-y-6">
                          {/* Warning Notice */}
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                            <div className="flex gap-3">
                              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold text-amber-400 text-sm mb-1">Important Notice</p>
                                <p className="text-sm text-zinc-300">
                                  This guide helps AI assistants format wiki content correctly. It will <strong>not</strong> generate content for you automatically. 
                                  You still need to provide the AI with accurate information about the artist through your own research.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Instructions */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              📋 How to Use
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2 text-sm text-zinc-300">
                              <p>1. Copy the prompt below using the copy button</p>
                              <p>2. Paste it into your preferred AI assistant (ChatGPT, Claude, etc.)</p>
                              <p>3. Provide the AI with information about the artist you researched</p>
                              <p>4. The AI will format it using our wiki syntax</p>
                              <p>5. Review and paste the result into the wiki editor</p>
                            </div>
                          </div>

                          {/* Copyable Prompt */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-primary flex items-center gap-2">
                                🤖 AI Formatting Prompt
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  const prompt = `You are a wiki content formatter for Serika.art, an artist database. Format the information I provide about an artist using this wiki syntax:

## TEXT FORMATTING
- Bold: '''text'''
- Italic: ''text''
- Code: \`text\`
- Headings: == Title == (level 1), === Subtitle === (level 2), ==== Section ==== (level 3), ===== Section ===== (level 4)
- Internal links: [[tag_name]] or [[tag_name|display text]]
- External links: [Link Text](https://url)
- Lists: * item or - item (bullet points)
- Horizontal line: ----
- Images: ![alt text](image-url)

## WIDGETS
Use format: {{WidgetName|param=value|param2=value2}}
For widgets with content, use closing tag: {{WidgetName}}content{{/WidgetName}}

### INFOBOX (place at the very top, floats right)
{{Infobox
|name=Artist Name
|image=https://image-url.jpg
|caption=Photo caption
|status=Active
|nationality=Country
|years_active=2020-present
|specialty=Art style/medium
|website=https://website.com
|any_custom_field=value
}}

### NOTICES & ALERTS
{{Notice|title=Note Title|text=Information message}}
{{Warning|text=Warning message}}
{{Success|text=Success message}}
{{Error|text=Error message}}
{{Callout|type=tip|emoji=💡|title=Pro Tip|text=Helpful information}}
Callout types: note, tip, important, warning, caution, quote, example

### QUOTES
{{Quote|text=The quote text here|author=Author Name}}

### STATISTICS
{{Stats|Followers=50K|Posts=1.2K|Years=5|Any_Label=Value}}

### COMMISSIONS STATUS
{{Commissions|status=open|slots=3/5|waitlist=10|message=Optional message}}
Status options: open, closed, waitlist

### PRICE TABLE
{{Price table|title=Commission Prices}}
Sketch|$20|Quick pencil sketch
Lineart|$40|Clean line drawing
Full Color|$80|Fully rendered piece
{{/Price table}}

### FEATURE HIGHLIGHT
{{Feature|icon=🎨|title=Feature Title|description=Description text}}

### TIMELINE
{{Timeline|title=Career History}}
2020 - Started digital art
2021 - First commission
2022 - Opened Patreon
2023 - Reached 10K followers
{{/Timeline}}

### SOCIAL LINKS
{{Socials|Twitter=@handle|Pixiv=user_id|YouTube=channel_url|DeviantArt=username|ArtStation=username|Patreon=creator_name|Linktree=username}}

### IMAGES
{{Image|src=https://url|caption=Caption|width=400|height=300|align=center|float=right|effect=zoom|shadow=true|border=true}}
align: left, center, right
float: left, right (makes text wrap around)
effect: grayscale, sepia, blur, zoom, rotate, glow

### GALLERY
{{Gallery|title=My Best Works|cols=4|gap=2}}
https://image1.jpg|Caption 1
https://image2.jpg|Caption 2
https://image3.jpg|Caption 3
{{/Gallery}}

### AVATAR
{{Avatar|src=https://url|size=lg|name=Artist Name|border=true}}
Sizes: xs, sm, md, lg, xl

### YOUTUBE VIDEO
{{YouTube|id=VIDEO_ID_HERE}}

### COLLAPSED/SPOILER SECTION
{{Collapsed|title=Click to expand|open=false}}
Hidden content here that can contain any formatting
{{/Collapsed}}

### TEXT STYLING
{{Color|color=#ff6b6b|text=Colored text}}
{{Color|color=#4ecdc4|bg=#1a1a2e|text=With background}}
{{Highlight|color=yellow|text=Highlighted text}}
Colors: yellow, green, blue, pink, purple, red, orange, cyan
{{Gradient|from=#ec4899|to=#8b5cf6|text=Gradient text}}
{{Gradient|from=#00d9ff|via=#00ff88|to=#ffee00|direction=right|text=Rainbow}}
{{Glow|color=#ec4899|intensity=10|text=Glowing text}}

### BADGES
{{Badge|text=Pro Artist|variant=default}}
Variants: default, secondary, destructive, outline

### PROGRESS BARS
{{Progress|label=Commission Slots|value=3|max=5|color=green}}
Colors: primary, green, blue, purple, pink, orange, red

### LAYOUT - ALIGNMENT
{{Center|Centered content}}
{{Left|Left aligned}}
{{Right|Right aligned}}

### LAYOUT - COLUMNS
{{Columns|cols=2|gap=6}}
Column 1 content here
|||
Column 2 content here
{{/Columns}}

### LAYOUT - GRID
{{Grid|cols=3|gap=4}}
Item 1
|||
Item 2
|||
Item 3
{{/Grid}}

### BOXES & CARDS
{{Box|bg=#1e1e2e|border=#ec4899|color=#fff}}
Custom styled box content
{{/Box}}

{{Card|title=Card Title}}
Card content here
{{/Card}}

### HERO SECTION
{{Hero|title=Welcome|subtitle=To my art page|bg=https://background-image.jpg|align=center}}
Optional hero content
{{/Hero}}

### SHOWCASE (image + text side by side)
{{Showcase|image=https://url|title=Featured Work|position=left}}
Description text for the showcase
{{/Showcase}}
position: left, right

### SPACING & DIVIDERS
{{Spacer|size=lg}}
Sizes: xs, sm, md, lg, xl, 2xl
{{Divider}}
{{Clear}}

## CATEGORIES (add at the very bottom)
[[Category:Digital Artist]]
[[Category:Commission Artist]]
[[Category:VTuber Artist]]
[[Category:Anime Style]]
[[Category:NSFW Artist]]
[[Category:SFW Only]]

## STRUCTURE GUIDELINES
1. Start with an Infobox containing key artist info
2. First section should be == Biography == with artist background
3. Suggested sections:
   - == Art Style == - describe their artistic style
   - == Commission Information == - pricing, status, TOS
   - == Notable Works == - famous pieces or collaborations  
   - == Social Media == - where to find them
   - == Trivia == - fun facts (optional)
4. Add relevant categories at the very end
5. Use proper formatting for readability
6. Keep information factual and encyclopedic in tone
7. Use {{Notice}} for important announcements
8. Use {{Warning}} for content warnings if applicable

Now, please format the following artist information I provide into this wiki format. Wait for me to give you the artist details.`;
                                  navigator.clipboard.writeText(prompt);
                                  alert('Prompt copied to clipboard!');
                                }}
                              >
                                📋 Copy Prompt
                              </Button>
                            </div>
                            <div className="bg-zinc-950 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                              <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">{`You are a wiki content formatter for Serika.art. Format artist info using this syntax:

TEXT: '''bold''', ''italic'', \`code\`, == Heading ==, [[tag]], [Text](url), * list item, ----

WIDGETS ({{Name|param=value}} format, {{/Name}} to close):

INFOBOX: {{Infobox|name=Name|image=url|status=Active|nationality=Country|specialty=Style}}

NOTICES: {{Notice|title=Note|text=Message}}, {{Warning|text=...}}, {{Success|text=...}}, {{Error|text=...}}
{{Callout|type=tip|emoji=💡|title=Title|text=...}} (types: note,tip,important,warning,caution,quote,example)

QUOTE: {{Quote|text=Quote|author=Name}}

STATS: {{Stats|Followers=50K|Posts=1.2K|Years=5}}

COMMISSIONS: {{Commissions|status=open|slots=3/5}} (status: open,closed,waitlist)

PRICE TABLE: {{Price table|title=Prices}}Sketch|$20|Desc{{/Price table}}

FEATURE: {{Feature|icon=🎨|title=Title|description=Desc}}

TIMELINE: {{Timeline|title=History}}2020 - Event{{/Timeline}}

SOCIALS: {{Socials|Twitter=@handle|Pixiv=id|YouTube=url|DeviantArt=user}}

IMAGE: {{Image|src=url|caption=Cap|align=center|float=right|effect=zoom|shadow=true}}
(align: left,center,right | float: left,right | effect: grayscale,sepia,blur,zoom,rotate,glow)

GALLERY: {{Gallery|title=Works|cols=4}}url|Caption{{/Gallery}}

AVATAR: {{Avatar|src=url|size=lg|name=Name}} (sizes: xs,sm,md,lg,xl)

YOUTUBE: {{YouTube|id=VIDEO_ID}}

COLLAPSED: {{Collapsed|title=Click to expand}}Hidden content{{/Collapsed}}

STYLING: {{Color|color=#ff6b6b|bg=#000|text=Colored}}
{{Highlight|color=yellow|text=Highlighted}} (yellow,green,blue,pink,purple,red,orange,cyan)
{{Gradient|from=#ec4899|via=#fff|to=#8b5cf6|text=Gradient}}
{{Glow|color=#ec4899|intensity=10|text=Glowing}}

BADGE: {{Badge|text=Pro|variant=default}} (default,secondary,destructive,outline)

PROGRESS: {{Progress|label=Slots|value=3|max=5|color=green}} (primary,green,blue,purple,pink,orange,red)

LAYOUT: {{Center|text}}, {{Left|text}}, {{Right|text}}
{{Columns|cols=2}}Col1|||Col2{{/Columns}}
{{Grid|cols=3}}Item1|||Item2|||Item3{{/Grid}}
{{Box|bg=#1e1e2e|border=#ec4899}}Content{{/Box}}
{{Card|title=Title}}Content{{/Card}}
{{Hero|title=Welcome|subtitle=Tagline|bg=url|align=center}}Content{{/Hero}}
{{Showcase|image=url|title=Title|position=left}}Desc{{/Showcase}}

SPACING: {{Spacer|size=lg}} (xs,sm,md,lg,xl,2xl), {{Divider}}, {{Clear}}

CATEGORIES: [[Category:Digital Artist]], [[Category:Commission Artist]], [[Category:VTuber Artist]]

STRUCTURE: 1.Infobox 2.==Biography== 3.==Art Style== 4.==Commission Info== 5.==Notable Works== 6.Categories

Wait for artist details to format.`}</pre>
                            </div>
                          </div>

                          {/* Example Output */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              ✨ Example Output
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl p-4">
                              <p className="text-xs text-muted-foreground mb-3">After providing artist info, the AI will generate something like:</p>
                              <pre className="text-[10px] bg-zinc-900 p-3 rounded-lg font-mono overflow-x-auto text-zinc-300">{`{{Infobox
|name=Example Artist
|status=Active
|nationality=Japan
|specialty=Digital Illustration
}}

== Biography ==
'''Example Artist''' is a digital illustrator known for...

== Art Style ==
Their work features ''vibrant colors'' and...

== Commission Information ==
{{Commissions|status=open|slots=2/5}}

{{Notice|title=Pricing|text=Check their website for current rates}}

== Social Media ==
{{Socials|Twitter=@example|Pixiv=12345}}

[[Category:Digital Artist]]
[[Category:Commission Artist]]`}</pre>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                      
                      {/* Quick Reference Footer */}
                      <div className="border-t border-zinc-800 p-4 bg-zinc-900/50">
                        <p className="text-xs text-muted-foreground text-center">
                          💡 <strong>Tip:</strong> Use the toolbar buttons above the editor for quick formatting. All widgets use the format: <code className="px-1 py-0.5 bg-zinc-800 rounded">{`{{Widget|param=value}}`}</code>
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
