// Detects AI-generator provenance embedded in an image file. Works on the raw,
// original bytes (not a re-encoded copy), in the browser and on the server.
//
// What it recognises:
//  - IPTC / C2PA "digital source type" = trainedAlgorithmicMedia (or composite
//    with it). OpenAI (ChatGPT, DALL·E, Sora), Google (Gemini, Imagen), Adobe
//    Firefly, Microsoft Designer/Bing, Midjourney and Meta AI write this into
//    the file's Content Credentials or XMP.
//  - Generator metadata left by local tools: Stable Diffusion WebUI
//    ("parameters" / "Negative prompt" + "Steps:"), ComfyUI workflows, NovelAI,
//    InvokeAI, Fooocus.
// It cannot see invisible pixel watermarks (Google SynthID) or files whose
// metadata was stripped (screenshots, re-saves).

export interface AiProvenance {
  /** Who made it, as far as the metadata says, e.g. "OpenAI". */
  source: string;
  /** What was found, e.g. "C2PA Content Credentials". */
  evidence: string;
}

const VENDORS: [RegExp, string][] = [
  [/OpenAI|ChatGPT|DALL[·.\-\s]?E|Sora/i, 'OpenAI'],
  [/Gemini|Imagen|Google LLC|Google Inc|SynthID/i, 'Google'],
  [/Adobe Firefly|Firefly/i, 'Adobe Firefly'],
  [/Microsoft Designer|Bing Image Creator|Microsoft Corporation/i, 'Microsoft'],
  [/Midjourney/i, 'Midjourney'],
  [/Meta AI|Imagine with Meta/i, 'Meta AI'],
  [/Stability AI|Stable Diffusion|DreamStudio/i, 'Stable Diffusion'],
  [/NovelAI/i, 'NovelAI'],
  [/Grok|xAI/i, 'xAI Grok'],
];

// Bytes → string, one char per byte (ASCII needles survive; windows-1252 only
// remaps 0x80–0x9F). TextDecoder is fast in both Node and browsers.
const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('latin1') : null;
const latin1 = (bytes: Uint8Array) => {
  if (decoder) return decoder.decode(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return out;
};

const utf16 = (s: string, littleEndian: boolean) =>
  [...s].map((c) => (littleEndian ? c + '\0' : '\0' + c)).join('');

function vendorNear(text: string, index: number): string | null {
  // Content Credentials keep the generator name close to the source-type
  // assertion; look around it first, then anywhere in the metadata.
  const around = text.slice(Math.max(0, index - 20000), index + 20000);
  for (const [re, name] of VENDORS) if (re.test(around)) return name;
  return null;
}

export function detectAiProvenance(bytes: Uint8Array): AiProvenance | null {
  if (!bytes || bytes.length < 16) return null;
  const text = latin1(bytes);

  // 1. Declared AI source type (IPTC / C2PA)
  for (const marker of ['trainedAlgorithmicMedia', 'compositeWithTrainedAlgorithmicMedia']) {
    const at = text.indexOf(marker);
    if (at !== -1) {
      const hasC2pa = text.includes('c2pa') || text.includes('jumb');
      return {
        source: vendorNear(text, at) ?? 'an AI generator',
        evidence: hasC2pa ? 'C2PA Content Credentials' : 'IPTC digital source type',
      };
    }
  }

  // (A C2PA manifest alone proves nothing: phone cameras sign real photos
  // too. Only the AI source type above counts.)

  // 2. Metadata written by local generators
  if (text.includes('"class_type"') && text.includes('"inputs"')) {
    return { source: 'ComfyUI', evidence: 'embedded ComfyUI workflow' };
  }
  if (/NovelAI/.test(text) && /"(?:sampler|n_samples|uc)"|Software\0?NovelAI/.test(text)) {
    return { source: 'NovelAI', evidence: 'NovelAI generation metadata' };
  }
  if (text.includes('invokeai_metadata') || text.includes('sd-metadata')) {
    return { source: 'InvokeAI', evidence: 'InvokeAI generation metadata' };
  }
  if (text.includes('fooocus_scheme') || text.includes('Fooocus')) {
    return { source: 'Fooocus', evidence: 'Fooocus generation metadata' };
  }
  const a1111 = (t: string) => t.includes('Steps: ') && (t.includes('Sampler: ') || t.includes('CFG scale: '));
  // Stable Diffusion WebUI: PNG "parameters" text chunk, or JPEG/WebP EXIF
  // UserComment (often UTF-16)
  if (
    a1111(text) ||
    text.includes(utf16('Steps: ', false)) && text.includes(utf16('Sampler: ', false)) ||
    text.includes(utf16('Steps: ', true)) && text.includes(utf16('Sampler: ', true))
  ) {
    return { source: 'Stable Diffusion', evidence: 'Stable Diffusion generation parameters' };
  }

  return null;
}

export function describeProvenance(p: AiProvenance): string {
  return `${p.evidence} say this image was made with ${p.source}`;
}
