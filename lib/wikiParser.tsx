'use client';

import React from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Calendar, MapPin, Palette, DollarSign, Languages, Wrench, Award, Users, Clock, Star, Heart, Eye, MessageSquare, Info, AlertCircle, CheckCircle, XCircle, Quote, ListOrdered, Hash, FileText, Image as ImageIcon, Table, Code, Minus } from 'lucide-react';

// Types for wiki content
export interface WikiWidget {
  type: string;
  props: Record<string, any>;
}

export interface ParsedWikiContent {
  widgets: WikiWidget[];
  sections: WikiSection[];
  categories: string[];
  references: WikiReference[];
}

export interface WikiSection {
  id: string;
  level: number;
  title: string;
  content: string;
}

export interface WikiReference {
  id: string;
  text: string;
  url?: string;
}

// Widget definitions
const WIDGET_TYPES = {
  'Infobox': 'infobox',
  'Infobox artist': 'infobox-artist',
  'Gallery': 'gallery',
  'Quote': 'quote',
  'Notice': 'notice',
  'Warning': 'warning',
  'Success': 'success',
  'Columns': 'columns',
  'Card': 'card',
  'Stats': 'stats',
  'Timeline': 'timeline',
  'Socials': 'socials',
  'Commissions': 'commissions',
  'Price table': 'price-table',
  'Image': 'image',
  'YouTube': 'youtube',
  'Twitter': 'twitter',
  'Ref': 'ref',
  'TOC': 'toc',
  'Clear': 'clear',
  'Divider': 'divider',
  'Spoiler': 'spoiler',
  'Collapsed': 'collapsed',
  'Grid': 'grid',
  'Flex': 'flex',
  'Badge': 'badge',
  'Color': 'color',
  'Size': 'size',
  'Align': 'align',
  'Float': 'float',
  'Box': 'box',
  'Tab': 'tab',
  'Tabs': 'tabs',
  'Center': 'center',
  'Right': 'right',
  'Left': 'left',
  'Highlight': 'highlight',
  'Gradient': 'gradient',
  'Glow': 'glow',
  'Callout': 'callout',
  'Feature': 'feature',
  'Hero': 'hero',
  'Showcase': 'showcase',
  'Progress': 'progress',
  'Avatar': 'avatar',
  'Spacer': 'spacer',
  'Tooltip': 'tooltip',
} as const;

// Parse wiki markup into structured content
export function parseWikiContent(content: string): ParsedWikiContent {
  const widgets: WikiWidget[] = [];
  const sections: WikiSection[] = [];
  const categories: string[] = [];
  const references: WikiReference[] = [];

  // Extract categories [[Category:Name]]
  const categoryRegex = /\[\[Category:([^\]]+)\]\]/gi;
  let categoryMatch;
  while ((categoryMatch = categoryRegex.exec(content)) !== null) {
    categories.push(categoryMatch[1].trim());
  }

  // Extract references
  const refRegex = /<ref(?:\s+name="([^"]+)")?>([\s\S]*?)<\/ref>/gi;
  let refMatch;
  let refIndex = 0;
  while ((refMatch = refRegex.exec(content)) !== null) {
    refIndex++;
    references.push({
      id: refMatch[1] || `ref-${refIndex}`,
      text: refMatch[2].trim(),
      url: extractUrl(refMatch[2]),
    });
  }

  // Extract sections by headers
  const lines = content.split('\n');
  let currentSection: WikiSection | null = null;
  let sectionContent: string[] = [];

  lines.forEach((line, index) => {
    const headerMatch = line.match(/^(={2,6})\s*(.+?)\s*\1$/);
    if (headerMatch) {
      // Save previous section
      if (currentSection !== null) {
        (currentSection as WikiSection).content = sectionContent.join('\n').trim();
        sections.push(currentSection as WikiSection);
      }
      
      const level = headerMatch[1].length - 1; // == is level 1, === is level 2, etc.
      const title = headerMatch[2];
      currentSection = {
        id: slugify(title),
        level,
        title,
        content: '',
      };
      sectionContent = [];
    } else {
      sectionContent.push(line);
    }
  });

  // Save last section
  if (currentSection !== null) {
    (currentSection as WikiSection).content = sectionContent.join('\n').trim();
    sections.push(currentSection as WikiSection);
  }

  return { widgets, sections, categories, references };
}

// Slugify for IDs
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

// Extract URL from text
function extractUrl(text: string): string | undefined {
  const urlMatch = text.match(/https?:\/\/[^\s\]|<]+/);
  return urlMatch ? urlMatch[0] : undefined;
}

// Parse widget parameters
function parseWidgetParams(paramsStr: string): Record<string, string> {
  const params: Record<string, string> = {};
  const lines = paramsStr.split('|').filter(l => l.trim());
  
  lines.forEach((line, index) => {
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();
      params[key] = value;
    } else if (line.trim()) {
      // Positional parameter
      params[`_${index}`] = line.trim();
    }
  });
  
  return params;
}

// Render a widget
function WikiWidgetRenderer({ type, params, content }: { type: string; params: Record<string, string>; content?: string }) {
  const widgetType = type.toLowerCase();

  switch (widgetType) {
    case 'infobox':
    case 'infobox artist':
    case 'infobox-artist':
      return <InfoboxWidget params={params} />;
    
    case 'gallery':
      return <GalleryWidget params={params} content={content} />;
    
    case 'quote':
      return <QuoteWidget params={params} />;
    
    case 'notice':
    case 'info':
      return <NoticeWidget params={params} variant="info" />;
    
    case 'warning':
      return <NoticeWidget params={params} variant="warning" />;
    
    case 'success':
      return <NoticeWidget params={params} variant="success" />;
    
    case 'error':
      return <NoticeWidget params={params} variant="error" />;
    
    case 'stats':
      return <StatsWidget params={params} />;
    
    case 'commissions':
      return <CommissionsWidget params={params} />;
    
    case 'price-table':
    case 'price table':
      return <PriceTableWidget params={params} content={content} />;
    
    case 'socials':
      return <SocialsWidget params={params} />;
    
    case 'timeline':
      return <TimelineWidget params={params} content={content} />;
    
    case 'image':
      return <ImageWidget params={params} />;
    
    case 'youtube':
      return <YouTubeWidget params={params} />;
    
    case 'columns':
      return <ColumnsWidget params={params} content={content} />;
    
    case 'card':
      return <CardWidget params={params} content={content} />;
    
    case 'divider':
      return <div className="my-8 border-t border-zinc-800" />;
    
    case 'clear':
      return <div className="clear-both" />;
    
    case 'toc':
      return null; // TOC is handled separately
    
    case 'spoiler':
    case 'collapsed':
      return <CollapsedWidget params={params} content={content} />;
    
    case 'badge':
      return <BadgeWidget params={params} />;
    
    case 'grid':
      return <GridWidget params={params} content={content} />;
    
    case 'box':
      return <BoxWidget params={params} content={content} />;
    
    case 'color':
      return <ColorWidget params={params} content={content} />;
    
    case 'center':
      return <div className="text-center my-4">{content ? renderWikiContent(content) : (params.text || params._0)}</div>;
    
    case 'right':
      return <div className="text-right my-4">{content ? renderWikiContent(content) : (params.text || params._0)}</div>;
    
    case 'left':
      return <div className="text-left my-4">{content ? renderWikiContent(content) : (params.text || params._0)}</div>;
    
    case 'highlight':
      return <HighlightWidget params={params} content={content} />;
    
    case 'gradient':
      return <GradientWidget params={params} content={content} />;
    
    case 'glow':
      return <GlowWidget params={params} content={content} />;
    
    case 'callout':
      return <CalloutWidget params={params} content={content} />;
    
    case 'feature':
      return <FeatureWidget params={params} />;
    
    case 'hero':
      return <HeroWidget params={params} content={content} />;
    
    case 'showcase':
      return <ShowcaseWidget params={params} content={content} />;
    
    case 'progress':
      return <ProgressWidget params={params} />;
    
    case 'avatar':
      return <AvatarWidget params={params} />;
    
    case 'spacer':
      return <SpacerWidget params={params} />;

    default:
      return (
        <div className="p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-lg text-xs text-muted-foreground">
          Unknown widget: {type}
        </div>
      );
  }
}

// Infobox Widget - Wikipedia style
function InfoboxWidget({ params }: { params: Record<string, string> }) {
  const title = params.name || params.title || 'Info';
  const image = params.image || params.photo;
  const caption = params.caption || params.photo_caption;
  
  // Get all other params as fields
  const skipKeys = ['name', 'title', 'image', 'photo', 'caption', 'photo_caption', 'style', 'class'];
  const fields = Object.entries(params)
    .filter(([key]) => !skipKeys.includes(key) && !key.startsWith('_'))
    .map(([key, value]) => ({
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value,
    }));

  return (
    <div className={cn(
      "float-right ml-6 mb-6 w-72 bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden shadow-xl",
      params.class
    )} style={params.style ? JSON.parse(params.style) : undefined}>
      <div className="bg-gradient-to-r from-primary/20 to-primary/10 px-4 py-3 text-center border-b border-zinc-800">
        <h3 className="font-bold text-white text-sm">{title}</h3>
      </div>
      
      {image && (
        <div className="relative aspect-square bg-zinc-950">
          <NextImage src={image} alt={title} fill className="object-cover" />
          {caption && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <p className="text-[10px] text-zinc-300 text-center">{caption}</p>
            </div>
          )}
        </div>
      )}
      
      <div className="divide-y divide-zinc-800/50">
        {fields.map((field, i) => (
          <div key={i} className="px-3 py-2 flex">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-24 flex-shrink-0">{field.label}</span>
            <span className="text-xs text-zinc-300 flex-1">{renderInlineMarkup(field.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Gallery Widget
function GalleryWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const columns = parseInt(params.columns || params.cols || '4');
  const gap = params.gap || '2';
  
  // Parse images from content - each line is an image
  const images = (content || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .map(line => {
      // Format: image.jpg|Caption
      const [src, caption] = line.split('|').map(s => s.trim());
      return { src, caption };
    });

  return (
    <div className="my-6">
      {params.title && (
        <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" />
          {params.title}
        </h4>
      )}
      <div className={`grid gap-${gap}`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {images.map((img, i) => (
          <div key={i} className="group relative aspect-square bg-zinc-900 rounded-lg overflow-hidden">
            <NextImage src={img.src} alt={img.caption || ''} fill className="object-cover transition-transform group-hover:scale-105" />
            {img.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white text-center">{img.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Quote Widget
function QuoteWidget({ params }: { params: Record<string, string> }) {
  const text = params.text || params._0 || params.quote;
  const author = params.author || params.by || params.source;
  
  return (
    <blockquote className="my-6 pl-4 border-l-4 border-primary/50 bg-zinc-900/30 py-4 pr-4 rounded-r-lg">
      <Quote className="w-6 h-6 text-primary/30 mb-2" />
      <p className="text-zinc-300 italic text-sm leading-relaxed">{text}</p>
      {author && (
        <cite className="block mt-2 text-xs text-muted-foreground not-italic">— {author}</cite>
      )}
    </blockquote>
  );
}

// Notice Widget
function NoticeWidget({ params, variant }: { params: Record<string, string>; variant: 'info' | 'warning' | 'success' | 'error' }) {
  const text = params.text || params._0 || params.message;
  const title = params.title;
  
  const variants = {
    info: { icon: Info, bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    warning: { icon: AlertCircle, bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    success: { icon: CheckCircle, bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
    error: { icon: XCircle, bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  };
  
  const v = variants[variant];
  const Icon = v.icon;
  
  return (
    <div className={cn("my-4 p-4 rounded-lg border", v.bg, v.border)}>
      <div className="flex gap-3">
        <Icon className={cn("w-5 h-5 flex-shrink-0", v.text)} />
        <div>
          {title && <p className={cn("font-bold text-sm mb-1", v.text)}>{title}</p>}
          <p className="text-sm text-zinc-300">{text}</p>
        </div>
      </div>
    </div>
  );
}

// Stats Widget
function StatsWidget({ params }: { params: Record<string, string> }) {
  const stats = Object.entries(params)
    .filter(([key]) => !key.startsWith('_') && key !== 'title')
    .map(([label, value]) => ({ label: label.replace(/_/g, ' '), value }));

  return (
    <div className="my-6 grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div key={i} className="text-center p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
          <div className="text-2xl font-bold text-white">{stat.value}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

// Commissions Widget
function CommissionsWidget({ params }: { params: Record<string, string> }) {
  const status = (params.status || 'closed').toLowerCase();
  const slots = params.slots;
  const waitlist = params.waitlist;
  
  const statusColors = {
    open: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', label: 'OPEN' },
    closed: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'CLOSED' },
    waitlist: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: 'WAITLIST' },
  };
  
  const s = statusColors[status as keyof typeof statusColors] || statusColors.closed;
  
  return (
    <div className={cn("my-6 p-6 rounded-xl border-2", s.bg, s.border)}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-lg">Commissions</h4>
        <Badge className={cn("text-xs font-bold", s.bg, s.text, s.border)}>{s.label}</Badge>
      </div>
      {params.message && <p className="text-sm text-zinc-300 mb-4">{params.message}</p>}
      <div className="flex gap-6 text-sm">
        {slots && (
          <div>
            <span className="text-muted-foreground">Slots:</span>
            <span className="ml-2 font-bold text-white">{slots}</span>
          </div>
        )}
        {waitlist && (
          <div>
            <span className="text-muted-foreground">Waitlist:</span>
            <span className="ml-2 font-bold text-white">{waitlist}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Price Table Widget
function PriceTableWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  // Parse rows from content
  const rows = (content || '')
    .split('\n')
    .filter(l => l.trim())
    .map(line => {
      const parts = line.split('|').map(s => s.trim());
      return { name: parts[0], price: parts[1], description: parts[2] };
    });

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-zinc-800">
      {params.title && (
        <div className="bg-zinc-800/50 px-4 py-3 border-b border-zinc-800">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            {params.title}
          </h4>
        </div>
      )}
      <div className="divide-y divide-zinc-800/50">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors">
            <div>
              <p className="font-medium text-white text-sm">{row.name}</p>
              {row.description && <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>}
            </div>
            <div className="text-primary font-bold">{row.price}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Socials Widget
function SocialsWidget({ params }: { params: Record<string, string> }) {
  const socials = Object.entries(params)
    .filter(([key]) => !key.startsWith('_'))
    .map(([platform, url]) => ({ platform, url }));

  return (
    <div className="my-4 flex flex-wrap gap-2">
      {socials.map((s, i) => (
        <a
          key={i}
          href={s.url.startsWith('http') ? s.url : `https://${s.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs font-medium transition-colors"
        >
          {s.platform}
          <ExternalLink className="w-3 h-3 opacity-50" />
        </a>
      ))}
    </div>
  );
}

// Timeline Widget
function TimelineWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const items = (content || '')
    .split('\n')
    .filter(l => l.trim())
    .map(line => {
      const match = line.match(/^(\d{4}(?:-\d{2})?(?:-\d{2})?)\s*[-|:]\s*(.+)$/);
      if (match) {
        return { date: match[1], text: match[2] };
      }
      return null;
    })
    .filter(Boolean) as { date: string; text: string }[];

  return (
    <div className="my-6">
      {params.title && <h4 className="font-bold text-sm mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />{params.title}</h4>}
      <div className="space-y-4 relative before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4 pl-6 relative">
            <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-zinc-950" />
            <div className="text-xs text-muted-foreground w-20 flex-shrink-0 font-mono">{item.date}</div>
            <div className="text-sm text-zinc-300 flex-1">{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Image Widget - Enhanced with more options
function ImageWidget({ params }: { params: Record<string, string> }) {
  const src = params.src || params.url || params._0;
  const alt = params.alt || params.caption || '';
  const width = params.width;
  const height = params.height;
  const float = params.float;
  const align = params.align || 'left';
  const rounded = params.rounded !== 'false';
  const shadow = params.shadow !== 'false';
  const border = params.border;
  const effect = params.effect;

  // Validate src - must be a valid URL or start with /
  if (!src) return null;
  
  const isValidUrl = src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://');
  if (!isValidUrl) return null;

  const floatClass = float === 'left' ? 'float-left mr-4 mb-4' 
    : float === 'right' ? 'float-right ml-4 mb-4' 
    : '';
  
  const alignClass = !float && align === 'center' ? 'mx-auto' 
    : !float && align === 'right' ? 'ml-auto' 
    : '';
  
  const effectClasses: Record<string, string> = {
    'grayscale': 'grayscale hover:grayscale-0 transition-all duration-300',
    'sepia': 'sepia hover:sepia-0 transition-all duration-300',
    'blur': 'blur-sm hover:blur-0 transition-all duration-300',
    'zoom': 'hover:scale-110 transition-transform duration-300',
    'rotate': 'hover:rotate-3 transition-transform duration-300',
    'glow': 'hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] transition-shadow duration-300',
  };

  return (
    <figure className={cn("my-4", floatClass, alignClass)} style={{ width: width || 'auto', maxWidth: '100%' }}>
      <div className={cn(
        "relative overflow-hidden bg-zinc-900",
        rounded && "rounded-xl",
        shadow && "shadow-xl",
        border && "ring-2 ring-zinc-700",
        effect && effectClasses[effect]
      )}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          width={width ? parseInt(width) : undefined}
          height={height ? parseInt(height) : undefined}
          className="object-cover max-w-full h-auto"
          style={{ maxHeight: '500px' }}
        />
      </div>
      {params.caption && (
        <figcaption className={cn(
          "mt-2 text-xs text-muted-foreground",
          align === 'center' && "text-center",
          align === 'right' && "text-right"
        )}>
          {params.caption}
        </figcaption>
      )}
    </figure>
  );
}

// YouTube Widget
function YouTubeWidget({ params }: { params: Record<string, string> }) {
  const id = params.id || params.v || params._0;
  if (!id) return null;

  // Extract ID from full URL if provided
  const trimmed = id.trim();
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  const finalId = (match && match[2].length === 11) ? match[2] : trimmed;

  return (
    <div className="my-6 aspect-video rounded-xl overflow-hidden bg-zinc-900">
      <iframe
        src={`https://www.youtube.com/embed/${finalId}`}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}


// Columns Widget
function ColumnsWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const count = parseInt(params.count || params.cols || '2');
  const gap = params.gap || '6';
  
  // Split content by ||| delimiter
  const columns = (content || '').split('|||').map(c => c.trim());

  return (
    <div className={`my-6 grid gap-${gap}`} style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {columns.map((col, i) => (
        <div key={i} className="prose prose-invert prose-sm max-w-none">
          {renderWikiContent(col)}
        </div>
      ))}
    </div>
  );
}

// Card Widget
function CardWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  return (
    <div className={cn(
      "my-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl",
      params.class
    )}>
      {params.title && <h4 className="font-bold text-sm mb-2">{params.title}</h4>}
      <div className="text-sm text-zinc-300">{content ? renderWikiContent(content) : null}</div>
    </div>
  );
}

// Collapsed Widget
function CollapsedWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const [open, setOpen] = React.useState(params.open === 'true');
  const title = params.title || 'Click to expand';

  return (
    <div className="my-4 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800/50 flex items-center justify-between text-sm font-medium transition-colors"
      >
        {title}
        <span className={cn("transition-transform", open && "rotate-180")}>▼</span>
      </button>
      {open && (
        <div className="p-4 border-t border-zinc-800">
          {content ? renderWikiContent(content) : null}
        </div>
      )}
    </div>
  );
}

// Badge Widget
function BadgeWidget({ params }: { params: Record<string, string> }) {
  const text = params.text || params._0;
  const variant = params.variant || 'default';
  const color = params.color;

  return (
    <Badge
      variant={variant as any}
      className={cn("mx-0.5", color && `bg-[${color}]`)}
    >
      {text}
    </Badge>
  );
}

// Grid Widget
function GridWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const cols = params.cols || '3';
  const gap = params.gap || '4';
  const items = (content || '').split('|||').map(c => c.trim());

  return (
    <div className={`my-6 grid gap-${gap}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {items.map((item, i) => (
        <div key={i}>{renderWikiContent(item)}</div>
      ))}
    </div>
  );
}

// Box Widget
function BoxWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  return (
    <div
      className={cn("my-4 p-4 rounded-lg", params.class)}
      style={{
        backgroundColor: params.bg || params.background,
        borderColor: params.border,
        borderWidth: params.border ? '1px' : undefined,
        color: params.color,
      }}
    >
      {content ? renderWikiContent(content) : null}
    </div>
  );
}

// Color Widget - Enhanced with more options
function ColorWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const color = params.color || params._0 || '#fff';
  const bg = params.bg || params.background;
  const size = params.size;
  const weight = params.weight || params.bold === 'true' ? 'bold' : undefined;
  
  return (
    <span 
      style={{ 
        color, 
        backgroundColor: bg,
        fontSize: size,
        fontWeight: weight,
        padding: bg ? '0.125rem 0.375rem' : undefined,
        borderRadius: bg ? '0.25rem' : undefined,
      }}
    >
      {params.text || params._1 || content}
    </span>
  );
}

// Highlight Widget
function HighlightWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const color = params.color || 'yellow';
  const colors: Record<string, string> = {
    yellow: 'bg-yellow-500/30 text-yellow-200',
    green: 'bg-green-500/30 text-green-200',
    blue: 'bg-blue-500/30 text-blue-200',
    pink: 'bg-pink-500/30 text-pink-200',
    purple: 'bg-purple-500/30 text-purple-200',
    red: 'bg-red-500/30 text-red-200',
    orange: 'bg-orange-500/30 text-orange-200',
    cyan: 'bg-cyan-500/30 text-cyan-200',
  };
  
  return (
    <mark className={cn("px-1.5 py-0.5 rounded", colors[color] || colors.yellow)}>
      {params.text || params._0 || content}
    </mark>
  );
}

// Gradient Widget
function GradientWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const from = params.from || '#ec4899';
  const to = params.to || '#8b5cf6';
  const via = params.via;
  const direction = params.direction || 'right';
  
  const gradientStyle = {
    backgroundImage: via 
      ? `linear-gradient(to ${direction}, ${from}, ${via}, ${to})`
      : `linear-gradient(to ${direction}, ${from}, ${to})`,
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  };
  
  return (
    <span className="font-bold text-lg" style={gradientStyle}>
      {params.text || params._0 || content}
    </span>
  );
}

// Glow Widget
function GlowWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const color = params.color || '#ec4899';
  const intensity = params.intensity || '10';
  
  return (
    <span 
      className="font-bold"
      style={{ 
        color,
        textShadow: `0 0 ${intensity}px ${color}, 0 0 ${parseInt(intensity) * 2}px ${color}40`,
      }}
    >
      {params.text || params._0 || content}
    </span>
  );
}

// Callout Widget - Enhanced notice with icon customization
function CalloutWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const type = params.type || 'note';
  const title = params.title;
  const emoji = params.emoji || params.icon;
  
  const types: Record<string, { bg: string; border: string; icon: string; title: string }> = {
    note: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: '📝', title: 'Note' },
    tip: { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: '💡', title: 'Tip' },
    important: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: '⭐', title: 'Important' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: '⚠️', title: 'Warning' },
    caution: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: '🚨', title: 'Caution' },
    quote: { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', icon: '💬', title: 'Quote' },
    example: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: '📌', title: 'Example' },
  };
  
  const t = types[type] || types.note;
  
  return (
    <div className={cn("my-4 p-4 rounded-xl border-l-4", t.bg, t.border)}>
      <div className="flex gap-3">
        <span className="text-xl">{emoji || t.icon}</span>
        <div className="flex-1">
          <p className="font-bold text-sm mb-1">{title || t.title}</p>
          <div className="text-sm text-zinc-300">{content ? renderWikiContent(content) : (params.text || params._0)}</div>
        </div>
      </div>
    </div>
  );
}

// Feature Widget - Highlight a feature with icon
function FeatureWidget({ params }: { params: Record<string, string> }) {
  const icon = params.icon || params.emoji || '✨';
  const title = params.title || params._0;
  const description = params.description || params.desc || params._1;
  
  return (
    <div className="flex gap-4 p-4 bg-gradient-to-r from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-xl my-3">
      <div className="text-3xl">{icon}</div>
      <div>
        <h4 className="font-bold text-white">{title}</h4>
        {description && <p className="text-sm text-zinc-400 mt-1">{description}</p>}
      </div>
    </div>
  );
}

// Hero Widget - Big banner-style section
function HeroWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const title = params.title;
  const subtitle = params.subtitle;
  const bg = params.bg || params.background;
  const align = params.align || 'center';
  
  return (
    <div 
      className={cn(
        "my-8 py-12 px-8 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-800 border border-zinc-700/50 relative overflow-hidden",
        align === 'center' && "text-center",
        align === 'right' && "text-right"
      )}
      style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {bg && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />}
      <div className="relative z-10">
        {title && <h2 className="text-3xl font-bold text-white mb-2">{title}</h2>}
        {subtitle && <p className="text-lg text-zinc-300 mb-4">{subtitle}</p>}
        {content && <div className="text-zinc-300">{renderWikiContent(content)}</div>}
      </div>
    </div>
  );
}

// Showcase Widget - Image showcase with text
function ShowcaseWidget({ params, content }: { params: Record<string, string>; content?: string }) {
  const image = params.image || params.src;
  const title = params.title;
  const position = params.position || 'left';
  
  return (
    <div className={cn(
      "my-6 flex gap-6 items-center",
      position === 'right' && "flex-row-reverse"
    )}>
      {image && (
        <div className="w-48 h-48 relative flex-shrink-0 rounded-xl overflow-hidden">
          <NextImage src={image} alt={title || ''} fill className="object-cover" />
        </div>
      )}
      <div className="flex-1">
        {title && <h4 className="text-lg font-bold text-white mb-2">{title}</h4>}
        <div className="text-sm text-zinc-300">{content ? renderWikiContent(content) : (params.text || params._0)}</div>
      </div>
    </div>
  );
}

// Progress Widget - Progress bar
function ProgressWidget({ params }: { params: Record<string, string> }) {
  const value = parseInt(params.value || params._0 || '50');
  const max = parseInt(params.max || '100');
  const label = params.label || params.title;
  const color = params.color || 'primary';
  
  const colors: Record<string, string> = {
    primary: 'bg-primary',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  };
  
  const percentage = Math.min(100, (value / max) * 100);
  
  return (
    <div className="my-4">
      {label && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-zinc-300">{label}</span>
          <span className="text-muted-foreground">{value}/{max}</span>
        </div>
      )}
      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all", colors[color] || colors.primary)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Avatar Widget - Circular avatar display
function AvatarWidget({ params }: { params: Record<string, string> }) {
  const src = params.src || params.url || params._0;
  const size = params.size || 'md';
  const name = params.name || params.alt || '';
  const border = params.border;
  
  const sizes: Record<string, string> = {
    xs: 'w-8 h-8',
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };
  
  return (
    <div className={cn(
      "relative rounded-full overflow-hidden bg-zinc-800 inline-block",
      sizes[size] || sizes.md,
      border && "ring-2 ring-primary"
    )}>
      {src ? (
        <NextImage src={src} alt={name} fill className="object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-lg font-bold">
          {name.charAt(0).toUpperCase() || '?'}
        </div>
      )}
    </div>
  );
}

// Spacer Widget - Add vertical space
function SpacerWidget({ params }: { params: Record<string, string> }) {
  const size = params.size || params._0 || 'md';
  const sizes: Record<string, string> = {
    xs: 'h-2',
    sm: 'h-4',
    md: 'h-8',
    lg: 'h-12',
    xl: 'h-16',
    '2xl': 'h-24',
  };
  
  return <div className={sizes[size] || sizes.md} />;
}

// Render inline markup (bold, italic, links, etc.)
function renderInlineMarkup(text: string): React.ReactNode {
  if (!text) return null;

  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Process text with multiple patterns
  const processText = (str: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let current = str;
    let idx = 0;

    while (current.length > 0) {
      // Markdown images: ![alt](url)
      let match = current.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (match) {
        const alt = match[1] || 'image';
        const src = match[2];
        result.push(
          <span key={`img-${idx++}`} className="inline-block my-2">
            <img 
              src={src} 
              alt={alt} 
              className="max-w-full h-auto rounded-lg"
              style={{ maxHeight: '400px' }}
            />
          </span>
        );
        current = current.substring(match[0].length);
        continue;
      }

      // Wiki links with display text: [[tag|display]]
      match = current.match(/^\[\[([^\]|]+)\|([^\]]+)\]\]/);
      if (match) {
        result.push(
          <Link key={`link-${idx++}`} href={`/posts?tags=${encodeURIComponent(match[1].replace(/ /g, '_'))}`} className="text-primary hover:underline">
            {match[2]}
          </Link>
        );
        current = current.substring(match[0].length);
        continue;
      }

      // Wiki links: [[tag]]
      match = current.match(/^\[\[([^\]]+)\]\]/);
      if (match) {
        result.push(
          <Link key={`link-${idx++}`} href={`/posts?tags=${encodeURIComponent(match[1].replace(/ /g, '_'))}`} className="text-primary hover:underline">
            {match[1].replace(/_/g, ' ')}
          </Link>
        );
        current = current.substring(match[0].length);
        continue;
      }

      // Markdown links: [text](url)
      match = current.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        result.push(
          <a key={`ext-${idx++}`} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {match[1]}
          </a>
        );
        current = current.substring(match[0].length);
        continue;
      }

      // Bold: '''text'''
      match = current.match(/^'''([^']+)'''/);
      if (match) {
        result.push(<strong key={`bold-${idx++}`} className="font-bold text-white">{match[1]}</strong>);
        current = current.substring(match[0].length);
        continue;
      }

      // Italic: ''text''
      match = current.match(/^''([^']+)''/);
      if (match) {
        result.push(<em key={`italic-${idx++}`} className="italic">{match[1]}</em>);
        current = current.substring(match[0].length);
        continue;
      }

      // Code: `text`
      match = current.match(/^`([^`]+)`/);
      if (match) {
        result.push(<code key={`code-${idx++}`} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs font-mono">{match[1]}</code>);
        current = current.substring(match[0].length);
        continue;
      }

      // Plain URL - check if it's an image
      match = current.match(/^(https?:\/\/[^\s<]+)/);
      if (match) {
        const url = match[1];
        // Check if URL is an image (common extensions)
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(url);
        
        if (isImage) {
          result.push(
            <span key={`imgurl-${idx++}`} className="block my-2">
              <img 
                src={url} 
                alt="image" 
                className="max-w-full h-auto rounded-lg"
                style={{ maxHeight: '400px' }}
              />
            </span>
          );
        } else {
          result.push(
            <a key={`url-${idx++}`} href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
              {url}
            </a>
          );
        }
        current = current.substring(match[0].length);
        continue;
      }

      // Regular character - accumulate until special pattern
      let nextSpecial = current.search(/!\[|^\[\[|\[.*?\]\(|'''|''|`|https?:\/\//);
      if (nextSpecial === -1) {
        result.push(current);
        break;
      } else if (nextSpecial === 0) {
        // Pattern didn't match fully, take one character
        result.push(current[0]);
        current = current.substring(1);
      } else {
        result.push(current.substring(0, nextSpecial));
        current = current.substring(nextSpecial);
      }
    }

    return result;
  };

  return <>{processText(text)}</>;
}

// Main wiki content renderer
export function renderWikiContent(content: string): React.ReactNode {
  if (!content) return null;

  const elements: React.ReactNode[] = [];
  let key = 0;
  
  // Remove categories from display
  let processedContent = content.replace(/\[\[Category:[^\]]+\]\]/gi, '');
  
  // Process widget templates {{WidgetName|param=value}}
  const widgetRegex = /\{\{([^|}]+)(?:\|([^}]*))?\}\}(?:\n([\s\S]*?)\n\{\{\/\1\}\})?/g;
  let lastIndex = 0;
  let match;

  while ((match = widgetRegex.exec(processedContent)) !== null) {
    // Add text before widget
    if (match.index > lastIndex) {
      const textBefore = processedContent.substring(lastIndex, match.index);
      elements.push(<WikiTextRenderer key={key++} content={textBefore} />);
    }

    const widgetType = match[1].trim();
    const paramsStr = match[2] || '';
    const innerContent = match[3];
    const params = parseWidgetParams(paramsStr);

    elements.push(
      <WikiWidgetRenderer key={key++} type={widgetType} params={params} content={innerContent} />
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < processedContent.length) {
    elements.push(<WikiTextRenderer key={key++} content={processedContent.substring(lastIndex)} />);
  }

  return <>{elements}</>;
}

// Render plain wiki text with basic formatting
function WikiTextRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;
  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-1 my-4 text-zinc-300">
          {listItems.map((item, i) => <li key={i} className="text-sm">{renderInlineMarkup(item)}</li>)}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, lineIndex) => {
    // Headers
    const headerMatch = line.match(/^(={2,6})\s*(.+?)\s*\1$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length - 1;
      const text = headerMatch[2];
      const id = slugify(text);
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm'];
      const headingLevel = Math.min(level + 1, 6);
      
      // Use createElement for dynamic heading levels
      const headingElement = React.createElement(
        `h${headingLevel}`,
        {
          key: key++,
          id: id,
          className: cn("font-bold text-white mt-8 mb-4 pb-2 border-b border-zinc-800", sizes[level - 1])
        },
        text
      );
      elements.push(headingElement);
      return;
    }

    // List items
    if (line.match(/^\s*[\*\-]\s+/)) {
      inList = true;
      listItems.push(line.replace(/^\s*[\*\-]\s+/, ''));
      return;
    } else {
      flushList();
    }

    // Horizontal rule
    if (line.match(/^-{4,}$/)) {
      elements.push(<hr key={key++} className="my-6 border-zinc-800" />);
      return;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={key++} className="h-4" />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="text-sm text-zinc-300 leading-relaxed my-2">
        {renderInlineMarkup(line)}
      </p>
    );
  });

  flushList();

  return <>{elements}</>;
}

// Table of Contents Generator
export function WikiTableOfContents({ content }: { content: string }) {
  const headers: { level: number; title: string; id: string }[] = [];
  
  const headerRegex = /^(={2,6})\s*(.+?)\s*\1$/gm;
  let match;
  
  while ((match = headerRegex.exec(content)) !== null) {
    const level = match[1].length - 1;
    const title = match[2];
    headers.push({
      level,
      title,
      id: slugify(title),
    });
  }

  if (headers.length < 3) return null;

  return (
    <nav className="mb-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl w-fit min-w-[250px]">
      <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <ListOrdered className="w-4 h-4" />
        Contents
      </div>
      <ol className="space-y-1 text-sm">
        {headers.map((h, i) => (
          <li key={i} style={{ marginLeft: `${(h.level - 1) * 12}px` }}>
            <a href={`#${h.id}`} className="text-primary hover:underline">
              {h.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Export all for use in the page
export { WikiWidgetRenderer, InfoboxWidget, GalleryWidget };
