import { sha256Hex, stableStringify } from '../engines/security.js';
import { buildPreviewModel } from '../engines/preview-engine.js';

export const LISTING_IMAGE_WIDTH = 2400;
export const LISTING_IMAGE_HEIGHT = 1600;
export const LISTING_IMAGE_PATHS = Object.freeze([
  'listing/images/01-hero.png',
  'listing/images/02-dashboard-overview.png',
  'listing/images/03-monthly-budget.png',
  'listing/images/04-key-features.png',
  'listing/images/05-light-dark-comparison.png',
  'listing/images/06-whats-included.png',
  'listing/images/07-language-currency-options.png',
  'listing/images/08-how-it-works.png',
  'listing/images/09-workbook-previews.png',
  'listing/images/10-digital-download.png',
  'listing/images/11-excel-google-sheets.png',
  'listing/images/12-paycheck-planning.png',
  'listing/images/13-debt-payoff.png',
  'listing/images/14-savings-goals.png',
  'listing/images/15-net-worth.png',
  'listing/images/16-bill-subscriptions.png',
  'listing/images/17-privacy-no-account.png',
  'listing/images/18-support-promise.png',
  'listing/images/19-buyer-fit.png',
  'listing/images/20-value-stack.png',
]);

export const LISTING_IMAGE_BLUEPRINTS = Object.freeze([
  { id: 'hero', purpose: 'thumbnail', path: LISTING_IMAGE_PATHS[0] },
  { id: 'dashboard-overview', purpose: 'feature', path: LISTING_IMAGE_PATHS[1] },
  { id: 'monthly-budget', purpose: 'detail', path: LISTING_IMAGE_PATHS[2] },
  { id: 'key-features', purpose: 'feature', path: LISTING_IMAGE_PATHS[3] },
  { id: 'light-dark-comparison', purpose: 'comparison', path: LISTING_IMAGE_PATHS[4] },
  { id: 'whats-included', purpose: 'contents', path: LISTING_IMAGE_PATHS[5] },
  { id: 'language-currency-options', purpose: 'compatibility', path: LISTING_IMAGE_PATHS[6] },
  { id: 'how-it-works', purpose: 'instructions', path: LISTING_IMAGE_PATHS[7] },
  { id: 'workbook-previews', purpose: 'bundle', path: LISTING_IMAGE_PATHS[8] },
  { id: 'digital-download', purpose: 'trust', path: LISTING_IMAGE_PATHS[9] },
  { id: 'excel-google-sheets', purpose: 'compatibility', path: LISTING_IMAGE_PATHS[10] },
  { id: 'paycheck-planning', purpose: 'feature', path: LISTING_IMAGE_PATHS[11] },
  { id: 'debt-payoff', purpose: 'feature', path: LISTING_IMAGE_PATHS[12] },
  { id: 'savings-goals', purpose: 'feature', path: LISTING_IMAGE_PATHS[13] },
  { id: 'net-worth', purpose: 'feature', path: LISTING_IMAGE_PATHS[14] },
  { id: 'bill-subscriptions', purpose: 'feature', path: LISTING_IMAGE_PATHS[15] },
  { id: 'privacy-no-account', purpose: 'trust', path: LISTING_IMAGE_PATHS[16] },
  { id: 'support-promise', purpose: 'trust', path: LISTING_IMAGE_PATHS[17] },
  { id: 'buyer-fit', purpose: 'other', path: LISTING_IMAGE_PATHS[18] },
  { id: 'value-stack', purpose: 'bundle', path: LISTING_IMAGE_PATHS[19] },
]);

const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const FIXED_ZIP_DATE = new Date('2000-01-01T00:00:00.000Z');
const RENDER_METHOD = 'deterministic-rgb8-raster-v1';
const MIN_IMAGE_EDGE = 2_000;
const textEncoder = new TextEncoder();

const COPY_IDS = Object.freeze([
  'badge', 'dashboard', 'budget', 'features', 'comparison', 'included', 'options', 'how', 'previews', 'download',
  'ready', 'sheets', 'formulas', 'checks', 'capacity', 'selected', 'light', 'dark', 'configured', 'market',
  'language', 'currency', 'year', 'open', 'enter', 'excelDesktop', 'excelWeb', 'googleSheets', 'review',
  'workbook', 'guide', 'license', 'images', 'digital', 'noShipping', 'verified', 'actualData', 'sample', 'local', 'footer',
  'compatibility', 'paycheck', 'debt', 'savings', 'netWorth', 'bills', 'privacy', 'support', 'buyerFit', 'value',
]);

const GLYPHS = Object.freeze({
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
  A: ['01110','10001','10001','11111','10001','10001','10001'], B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'], D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01111'], H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'], J: ['00111','00010','00010','00010','10010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'], N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'], R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'], T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'], V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'], X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'], Z: ['11111','00001','00010','00100','01000','10000','11111'],
  'Ä': ['01010','01110','10001','11111','10001','10001','10001'], 'Ë': ['01010','11111','10000','11110','10000','10000','11111'],
  'Ï': ['01010','11111','00100','00100','00100','00100','11111'], 'Ö': ['01010','01110','10001','10001','10001','10001','01110'],
  'Ü': ['01010','10001','10001','10001','10001','10001','01110'], 'É': ['00100','11111','10000','11110','10000','10000','11111'],
  'È': ['01000','11111','10000','11110','10000','10000','11111'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'], '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'], '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'], '5': ['11111','10000','10000','11110','00001','00001','11110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'], '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'], '9': ['01110','10001','10001','01111','00001','00001','01110'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'], '+': ['00000','00100','00100','11111','00100','00100','00000'],
  '.': ['00000','00000','00000','00000','00000','00110','00110'], ',': ['00000','00000','00000','00000','00110','00110','00100'],
  ':': ['00000','00110','00110','00000','00110','00110','00000'], '/': ['00001','00010','00100','01000','10000','00000','00000'],
  '%': ['11001','11010','00100','01000','10110','00110','00000'], '$': ['00100','01111','10100','01110','00101','11110','00100'],
  '€': ['00111','01000','11110','01000','11110','01000','00111'], '£': ['00110','01001','01000','11110','01000','01000','11111'],
  '&': ['01100','10010','10100','01000','10101','10010','01101'], '(': ['00010','00100','01000','01000','01000','00100','00010'],
  ')': ['01000','00100','00010','00010','00010','00100','01000'], '?': ['01110','10001','00001','00010','00100','00000','00100'],
  '!': ['00100','00100','00100','00100','00100','00000','00100'], '#': ['01010','11111','01010','01010','11111','01010','00000'],
  '=': ['00000','00000','11111','00000','11111','00000','00000'], '_': ['00000','00000','00000','00000','00000','00000','11111'],
  "'": ['00100','00100','00000','00000','00000','00000','00000'],
});

function copyFor(translate) {
  if (typeof translate !== 'function') throw new Error('Localized listing-image copy resolver is required.');
  return Object.freeze(Object.fromEntries(COPY_IDS.map(id => {
    const key = `listingImages.${id}`;
    try {
      const translated = translate(key);
      if (typeof translated !== 'string' || !translated.trim() || translated === key) throw new Error(`Missing localized listing-image copy '${key}'.`);
      return [id, translated.trim()];
    } catch (error) {
      throw new Error(`Missing localized listing-image copy '${key}'.`, { cause: error });
    }
  })));
}

function visibleText(translate, key, fallback) {
  if (typeof translate !== 'function') return fallback;
  try {
    const translated = translate(key, fallback);
    return typeof translated === 'string' && translated.trim() && translated !== key ? translated.trim() : fallback;
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  const aliases = Object.freeze({ '‘': "'", '’': "'", '–': '-', '—': '-' });
  return Array.from(String(value ?? '').normalize('NFC').toUpperCase()).map(character => {
    const candidate = aliases[character] ?? character;
    if (GLYPHS[candidate]) return candidate;
    const ascii = candidate.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const supported = Array.from(ascii).filter(item => GLYPHS[item]).join('');
    return supported || ' ';
  }).join('').replace(/\s+/g, ' ').trim();
}

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const GLYPH_ADVANCE = 6;

export function measureListingText(value, scale = 1) {
  const text = normalizeText(value);
  if (!Number.isInteger(scale) || scale < 1) throw new RangeError('Listing text scale must be a positive integer.');
  return Object.freeze({
    text,
    width: text.length ? ((text.length - 1) * GLYPH_ADVANCE + GLYPH_WIDTH) * scale : 0,
    height: text.length ? GLYPH_HEIGHT * scale : 0,
  });
}

function splitLongWord(word, maxWidth, scale) {
  const chunks = [];
  let chunk = '';
  for (const character of word) {
    const candidate = `${chunk}${character}`;
    if (chunk && measureListingText(candidate, scale).width > maxWidth) {
      chunks.push(chunk);
      chunk = character;
    } else chunk = candidate;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapListingText(text, maxWidth, scale) {
  if (!text) return [];
  const tokens = text.split(' ').flatMap(word => (
    measureListingText(word, scale).width <= maxWidth ? [word] : splitLongWord(word, maxWidth, scale)
  ));
  const lines = [];
  let line = '';
  for (const token of tokens) {
    const candidate = line ? `${line} ${token}` : token;
    if (line && measureListingText(candidate, scale).width > maxWidth) {
      lines.push(line);
      line = token;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

export function layoutListingText(value, options = {}) {
  const text = normalizeText(value);
  const maxWidth = Math.floor(options.maxWidth);
  const maxHeight = Math.floor(options.maxHeight);
  const maxScale = Math.floor(options.maxScale ?? 1);
  const minScale = Math.floor(options.minScale ?? 1);
  const maxLines = Math.floor(options.maxLines ?? 1);
  const wrap = Boolean(options.wrap);
  if (!(maxWidth > 0) || !(maxHeight > 0)) throw new RangeError('Listing text requires positive maxWidth and maxHeight bounds.');
  if (!(maxScale >= minScale) || minScale < 1 || maxLines < 1) throw new RangeError('Listing text scale/line limits are invalid.');
  if (!text) return Object.freeze({ text, lines: Object.freeze([]), scale: maxScale, width: 0, height: 0, lineGap: 0, wrapped: false });

  for (let scale = maxScale; scale >= minScale; scale -= 1) {
    const hasOverlongWord = wrap && text.split(' ').some(word => measureListingText(word, scale).width > maxWidth);
    if (hasOverlongWord && scale > minScale) continue;
    const lines = wrap ? wrapListingText(text, maxWidth, scale) : [text];
    const lineGap = Math.max(2, Math.floor(scale * (options.lineGapRatio ?? 1.25)));
    const width = Math.max(...lines.map(line => measureListingText(line, scale).width));
    const height = lines.length * GLYPH_HEIGHT * scale + Math.max(0, lines.length - 1) * lineGap;
    if (lines.length <= maxLines && width <= maxWidth && height <= maxHeight) {
      return Object.freeze({
        text,
        lines: Object.freeze(lines),
        scale,
        width,
        height,
        lineGap,
        wrapped: lines.length > 1,
      });
    }
  }
  throw new RangeError(`Listing text cannot fit within ${maxWidth}x${maxHeight}: '${text}'.`);
}

function hexColor(value, fallback) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(value ?? ''));
  const hex = match?.[1] ?? fallback.replace('#', '');
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
}

function mix(a, b, amount) {
  return a.map((value, index) => Math.round(value * (1 - amount) + b[index] * amount));
}

function luminance(color) {
  return color.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrasting(color) {
  return luminance(color) < 145 ? [250, 252, 255] : [18, 24, 34];
}

class Raster {
  constructor(width, height, background, imageId) {
    this.width = width;
    this.height = height;
    this.imageId = imageId;
    this.layoutEvidence = [];
    this.textSequence = 0;
    this.pixels = new Uint8Array(width * height * 3);
    this.fill(background);
  }

  fill(color) {
    for (let offset = 0; offset < this.pixels.length; offset += 3) {
      this.pixels[offset] = color[0];
      this.pixels[offset + 1] = color[1];
      this.pixels[offset + 2] = color[2];
    }
  }

  rect(x, y, width, height, color) {
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(this.width, Math.ceil(x + width));
    const bottom = Math.min(this.height, Math.ceil(y + height));
    for (let row = top; row < bottom; row += 1) {
      let offset = (row * this.width + left) * 3;
      for (let column = left; column < right; column += 1) {
        this.pixels[offset] = color[0];
        this.pixels[offset + 1] = color[1];
        this.pixels[offset + 2] = color[2];
        offset += 3;
      }
    }
  }

  border(x, y, width, height, thickness, color) {
    this.rect(x, y, width, thickness, color);
    this.rect(x, y + height - thickness, width, thickness, color);
    this.rect(x, y, thickness, height, color);
    this.rect(x + width - thickness, y, thickness, height, color);
  }

  card(x, y, width, height, surface, border, shadow) {
    this.rect(x + 18, y + 20, width, height, shadow);
    this.rect(x, y, width, height, surface);
    this.border(x, y, width, height, 4, border);
  }

  textBox(value, x, y, options, color) {
    const box = {
      x: Math.floor(x), y: Math.floor(y), width: Math.floor(options.maxWidth), height: Math.floor(options.maxHeight),
    };
    if (box.x < 0 || box.y < 0 || box.x + box.width > this.width || box.y + box.height > this.height) {
      throw new RangeError(`Listing text box '${options.id ?? 'unnamed'}' exceeds the ${this.width}x${this.height} canvas.`);
    }
    const layout = layoutListingText(value, options);
    const align = options.align ?? 'left';
    const renderedLines = [];
    let minimumX = box.x + box.width;
    let maximumRight = box.x;
    for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex += 1) {
      const line = layout.lines[lineIndex];
      const measurement = measureListingText(line, layout.scale);
      const lineX = align === 'center'
        ? box.x + Math.floor((box.width - measurement.width) / 2)
        : align === 'right' ? box.x + box.width - measurement.width : box.x;
      const lineY = box.y + lineIndex * (GLYPH_HEIGHT * layout.scale + layout.lineGap);
      let cursor = lineX;
      for (const character of line) {
        const glyph = GLYPHS[character] ?? GLYPHS['?'];
        for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
          for (let column = 0; column < GLYPH_WIDTH; column += 1) {
            if (glyph[row][column] === '1') this.rect(cursor + column * layout.scale, lineY + row * layout.scale, layout.scale, layout.scale, color);
          }
        }
        cursor += GLYPH_ADVANCE * layout.scale;
      }
      minimumX = Math.min(minimumX, lineX);
      maximumRight = Math.max(maximumRight, lineX + measurement.width);
      renderedLines.push(line);
    }
    const bounds = {
      x: layout.lines.length ? minimumX : box.x,
      y: box.y,
      width: layout.lines.length ? maximumRight - minimumX : 0,
      height: layout.height,
    };
    const withinBounds = bounds.x >= box.x && bounds.y >= box.y
      && bounds.x + bounds.width <= box.x + box.width
      && bounds.y + bounds.height <= box.y + box.height;
    if (!withinBounds || renderedLines.join('').replace(/\s+/g, '') !== layout.text.replace(/\s+/g, '')) {
      throw new RangeError(`Listing text layout '${options.id ?? 'unnamed'}' failed its clip-safe bounds contract.`);
    }
    this.layoutEvidence.push(Object.freeze({
      id: options.id ?? `text-${++this.textSequence}`,
      text: layout.text,
      lines: Object.freeze(renderedLines),
      scale: layout.scale,
      wrapped: layout.wrapped,
      box: Object.freeze(box),
      bounds: Object.freeze(bounds),
      withinBounds,
    }));
    return Object.freeze({ ...layout, box: Object.freeze(box), bounds: Object.freeze(bounds) });
  }

  line(x1, y1, x2, y2, thickness, color) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let step = 0; step <= steps; step += 1) {
      const x = x1 + (dx * step) / steps;
      const y = y1 + (dy * step) / steps;
      this.rect(x - thickness / 2, y - thickness / 2, thickness, thickness, color);
    }
  }

  circle(centerX, centerY, radius, color) {
    const top = Math.max(0, Math.floor(centerY - radius));
    const bottom = Math.min(this.height - 1, Math.ceil(centerY + radius));
    for (let y = top; y <= bottom; y += 1) {
      const halfWidth = Math.floor(Math.sqrt(Math.max(0, radius * radius - (y - centerY) ** 2)));
      this.rect(centerX - halfWidth, y, halfWidth * 2 + 1, 1, color);
    }
  }
}

function paletteFor(theme, appearance) {
  const colors = theme?.colors ?? {};
  const resolvedDark = appearance === 'dark' && theme?.extensions?.appearance !== 'dark';
  const baseBackground = hexColor(resolvedDark ? '#202833' : colors.background, appearance === 'dark' ? '#202833' : '#F4F7FB');
  const baseSurface = hexColor(resolvedDark ? '#2B3642' : colors.surface, appearance === 'dark' ? '#2B3642' : '#FFFFFF');
  const text = hexColor(resolvedDark ? '#F4F7FA' : colors.text, appearance === 'dark' ? '#F4F7FA' : '#162033');
  const primary = hexColor(colors.primary, '#153A5B');
  const accent = hexColor(colors.accent, '#8A5700');
  const muted = hexColor(resolvedDark ? '#C1CBD4' : colors.muted, appearance === 'dark' ? '#C1CBD4' : '#526170');
  const border = hexColor(resolvedDark ? '#718294' : colors.border, appearance === 'dark' ? '#718294' : '#A6B5C3');
  return {
    background: baseBackground, surface: baseSurface, text, primary, accent, muted, border,
    inverse: contrasting(primary), soft: mix(baseBackground, baseSurface, 0.55), shadow: mix(baseBackground, [0, 0, 0], 0.16),
    band: hexColor(resolvedDark ? '#344250' : colors.bandFill, appearance === 'dark' ? '#344250' : '#E8EEF4'),
    input: hexColor(resolvedDark ? '#183A5A' : colors.inputFill, appearance === 'dark' ? '#183A5A' : '#FFF4D6'),
    formula: hexColor(resolvedDark ? '#10161D' : colors.formulaFill, appearance === 'dark' ? '#10161D' : '#DDE8F2'),
    success: hexColor(resolvedDark ? '#163C2B' : colors.successFill, appearance === 'dark' ? '#163C2B' : '#E6F4EA'),
    successText: hexColor(resolvedDark ? '#D7F5E4' : colors.successText, appearance === 'dark' ? '#D7F5E4' : '#164B2B'),
  };
}

function header(raster, palette, copy, title, subtitle, page) {
  raster.rect(0, 0, raster.width, 28, palette.accent);
  raster.textBox(copy.badge, 110, 80, { id: 'header-badge', maxWidth: 1_850, maxHeight: 38, maxScale: 5, minScale: 2 }, palette.accent);
  raster.textBox(title, 110, 150, { id: 'header-title', maxWidth: 1_940, maxHeight: 92, maxScale: 12, minScale: 3 }, palette.text);
  raster.textBox(subtitle, 114, 280, { id: 'header-subtitle', maxWidth: 2_000, maxHeight: 42, maxScale: 5, minScale: 2 }, palette.muted);
  raster.rect(110, 350, 130, 9, palette.accent);
  raster.textBox(String(page).padStart(2, '0'), 2_200, 82, { id: 'header-page', maxWidth: 90, maxHeight: 38, maxScale: 5, minScale: 3, align: 'right' }, palette.muted);
}

function footer(raster, palette, configuration, copy) {
  raster.textBox(`${configuration.locale} / ${configuration.currency} / ${configuration.year}`, 110, 1505, { id: 'footer-configuration', maxWidth: 850, maxHeight: 36, maxScale: 4, minScale: 2 }, palette.muted);
  raster.textBox(copy.footer, 1_100, 1505, { id: 'footer-slogan', maxWidth: 1_190, maxHeight: 36, maxScale: 4, minScale: 2, align: 'right' }, palette.muted);
}

function localizedCellValue(value, column) {
  if (value == null || value === '') return '';
  const rendered = String(value);
  const genericId = normalizeText(String(column?.id ?? '').replaceAll('-', ' '));
  return normalizeText(rendered) === genericId && column?.label ? column.label : rendered;
}

function workbookWindow(raster, palette, x, y, width, height, sheet, copy, dark = false, regionId = 'workbook') {
  const surface = dark ? [40, 49, 61] : palette.surface;
  const text = dark ? [242, 246, 250] : palette.text;
  const band = dark ? [56, 68, 82] : palette.band;
  const border = dark ? [108, 126, 145] : palette.border;
  raster.card(x, y, width, height, surface, border, palette.shadow);
  raster.rect(x, y, width, 70, dark ? [29, 37, 47] : palette.primary);
  raster.rect(x + 28, y + 25, 20, 20, [255, 100, 92]);
  raster.rect(x + 60, y + 25, 20, 20, [255, 193, 78]);
  raster.rect(x + 92, y + 25, 20, 20, [77, 201, 111]);
  raster.textBox(sheet?.name ?? copy.workbook, x + 145, y + 20, { id: `${regionId}-sheet-title`, maxWidth: width - 185, maxHeight: 32, maxScale: 4, minScale: 1 }, contrasting(dark ? [29, 37, 47] : palette.primary));
  raster.rect(x + 32, y + 105, width - 64, 62, band);
  const columns = (sheet?.columns ?? []).slice(0, 5);
  const columnWidth = Math.floor((width - 64) / Math.max(columns.length, 1));
  columns.forEach((column, index) => raster.textBox(column.label, x + 42 + index * columnWidth, y + 114, {
    id: `${regionId}-column-${index + 1}`,
    maxWidth: columnWidth - 20,
    maxHeight: 45,
    maxScale: 3,
    minScale: 1,
    maxLines: 2,
    wrap: true,
  }, text));
  for (let row = 0; row < 5; row += 1) {
    const rowY = y + 180 + row * 72;
    raster.rect(x + 32, rowY, width - 64, 58, row % 2 ? surface : mix(surface, band, 0.42));
    columns.forEach((column, index) => {
      const rawValue = sheet?.rows?.[row]?.[column.id];
      let sample = rawValue == null ? (index === 0 ? `${row + 1}` : '') : localizedCellValue(rawValue, column);
      const cellLayout = {
        id: `${regionId}-row-${row + 1}-cell-${index + 1}`,
        maxWidth: columnWidth - 20,
        maxHeight: 40,
        maxScale: 3,
        minScale: 1,
        maxLines: 2,
        wrap: true,
      };
      if (sample !== '') {
        try {
          layoutListingText(sample, cellLayout);
        } catch (error) {
          if (!column?.label || normalizeText(sample) === normalizeText(column.label)) throw error;
          sample = column.label;
        }
        raster.textBox(sample, x + 42 + index * columnWidth, rowY + 9, cellLayout, text);
      }
    });
  }
  const tabWidth = Math.min(width - 64, 380);
  raster.rect(x + 32, y + height - 78, tabWidth, 46, dark ? [76, 91, 108] : palette.band);
  raster.textBox(sheet?.name ?? copy.sheets, x + 48, y + height - 68, { id: `${regionId}-tab`, maxWidth: tabWidth - 32, maxHeight: 27, maxScale: 3, minScale: 1 }, text);
}

function metricCard(raster, palette, x, y, width, label, value, index) {
  raster.card(x, y, width, 190, palette.surface, palette.border, palette.shadow);
  raster.textBox(label, x + 32, y + 28, { id: `metric-${index}-label`, maxWidth: width - 85, maxHeight: 42, maxScale: 4, minScale: 2 }, palette.muted);
  raster.textBox(String(value), x + 32, y + 88, { id: `metric-${index}-value`, maxWidth: width - 85, maxHeight: 62, maxScale: 8, minScale: 2 }, palette.primary);
  raster.rect(x + width - 34, y + 28, 8, 132, palette.accent);
}

function chartSamples(preview, chart) {
  const values = [];
  for (const sheetId of chart.sourceSheetIds ?? []) {
    const sheet = preview.sheets.find(item => item.id === sheetId);
    for (const row of sheet?.rows ?? []) {
      for (const value of Object.values(row)) {
        const number = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
        if (Number.isFinite(number)) values.push(Math.abs(number));
      }
    }
  }
  return values.slice(0, Math.max(1, chart.seriesCount ?? 1));
}

function renderDefinitionChart(raster, palette, preview, chart, x, y, width, height) {
  raster.textBox(chart.title, x + 40, y + 25, { id: 'chart-title', maxWidth: width - 80, maxHeight: 45, maxScale: 5, minScale: 2 }, palette.text);
  const plotX = x + 80;
  const plotY = y + 125;
  const plotWidth = width - 150;
  const plotHeight = height - 205;
  raster.line(plotX, plotY + plotHeight, plotX + plotWidth, plotY + plotHeight, 4, palette.border);
  const values = chartSamples(preview, chart);
  const maximum = Math.max(1, ...values);
  if (chart.type === 'doughnut') {
    raster.circle(plotX + plotWidth / 2, plotY + plotHeight / 2, Math.min(plotWidth, plotHeight) * 0.34, palette.primary);
    raster.circle(plotX + plotWidth / 2, plotY + plotHeight / 2, Math.min(plotWidth, plotHeight) * 0.17, palette.surface);
    raster.rect(plotX + plotWidth - 280, plotY + 30, 32, 32, palette.accent);
    raster.textBox(String(chart.seriesCount), plotX + plotWidth - 220, plotY + 25, { id: 'chart-series-count', maxWidth: 120, maxHeight: 32, maxScale: 4, minScale: 2 }, palette.muted);
    return;
  }
  if (!values.length) return;
  if (chart.type === 'bar') {
    const barHeight = Math.min(78, Math.floor(plotHeight / values.length) - 18);
    values.forEach((value, index) => raster.rect(plotX, plotY + 35 + index * (barHeight + 28), Math.max(8, (value / maximum) * plotWidth), barHeight, index % 2 ? palette.accent : palette.primary));
    return;
  }
  if (chart.type === 'line') {
    let previous;
    values.forEach((value, index) => {
      const pointX = plotX + (values.length === 1 ? plotWidth / 2 : index * plotWidth / (values.length - 1));
      const pointY = plotY + plotHeight - (value / maximum) * (plotHeight - 30);
      if (previous) raster.line(previous.x, previous.y, pointX, pointY, 10, palette.primary);
      raster.circle(pointX, pointY, 18, palette.accent);
      previous = { x: pointX, y: pointY };
    });
    return;
  }
  const barWidth = Math.min(130, Math.floor(plotWidth / values.length) - 28);
  values.forEach((value, index) => {
    const barHeight = Math.max(8, (value / maximum) * (plotHeight - 30));
    raster.rect(plotX + 35 + index * (barWidth + 55), plotY + plotHeight - barHeight, barWidth, barHeight, index % 2 ? palette.accent : palette.primary);
  });
}

function iconTile(raster, palette, x, y, width, title, detail, index) {
  raster.card(x, y, width, 250, palette.surface, palette.border, palette.shadow);
  raster.rect(x + 30, y + 30, 76, 76, index % 2 ? palette.primary : palette.accent);
  raster.textBox(String(index + 1).padStart(2, '0'), x + 42, y + 45, { id: `feature-${index + 1}-number`, maxWidth: 52, maxHeight: 32, maxScale: 4, minScale: 2, align: 'center' }, contrasting(index % 2 ? palette.primary : palette.accent));
  raster.textBox(title, x + 132, y + 28, { id: `feature-${index + 1}-title`, maxWidth: width - 172, maxHeight: 82, maxScale: 5, minScale: 2, maxLines: 2, wrap: true }, palette.text);
  raster.textBox(detail, x + 132, y + 126, { id: `feature-${index + 1}-detail`, maxWidth: width - 172, maxHeight: 46, maxScale: 3, minScale: 1, maxLines: 2, wrap: true }, palette.muted);
  raster.rect(x + 132, y + 205, Math.min(230, width - 170), 8, palette.accent);
}

function renderHero(raster, context) {
  const { palette, copy, configuration, preview } = context;
  header(raster, palette, copy, configuration.title, `${copy.ready} / ${configuration.currency} / ${configuration.year}`, 1);
  raster.card(110, 470, 720, 780, palette.primary, palette.primary, palette.shadow);
  raster.textBox(copy.badge, 170, 535, { id: 'hero-badge', maxWidth: 600, maxHeight: 40, maxScale: 5, minScale: 2 }, palette.inverse);
  raster.textBox(configuration.title, 170, 650, { id: 'hero-title', maxWidth: 600, maxHeight: 225, maxScale: 10, minScale: 3, maxLines: 3, wrap: true }, palette.inverse);
  raster.rect(170, 930, 120, 9, palette.accent);
  raster.textBox(`${preview.sheets.length} ${copy.sheets}`, 170, 985, { id: 'hero-sheet-count', maxWidth: 600, maxHeight: 42, maxScale: 5, minScale: 2 }, palette.inverse);
  raster.textBox(`${preview.formulaCount} ${copy.formulas}`, 170, 1060, { id: 'hero-formula-count', maxWidth: 600, maxHeight: 42, maxScale: 5, minScale: 2 }, palette.inverse);
  raster.textBox(copy.local, 170, 1150, { id: 'hero-local', maxWidth: 600, maxHeight: 36, maxScale: 4, minScale: 2 }, palette.inverse);
  workbookWindow(raster, palette, 940, 440, 1320, 850, preview.sheets[0], copy, false, 'hero-workbook');
  raster.rect(1880, 1180, 270, 70, palette.accent);
  raster.textBox(copy.ready, 1895, 1190, { id: 'hero-cta', maxWidth: 240, maxHeight: 52, maxScale: 4, minScale: 1, maxLines: 2, wrap: true, align: 'center' }, contrasting(palette.accent));
}

function renderDashboard(raster, context) {
  const { palette, copy, preview, definition } = context;
  header(raster, palette, copy, copy.dashboard, copy.actualData, 2);
  const validationCount = preview.sheets.reduce((sum, sheet) => sum + sheet.validationCount, 0);
  const values = [[copy.sheets, preview.sheets.length], [copy.formulas, preview.formulaCount], [copy.checks, validationCount], [copy.capacity, context.configuration.inputCapacity]];
  values.forEach(([label, value], index) => metricCard(raster, palette, 110 + index * 560, 440, 500, label, value, index + 1));
  const chart = preview.sheets.flatMap(sheet => sheet.charts ?? []).at(0);
  if (chart) {
    raster.card(110, 700, 2180, 670, palette.surface, palette.border, palette.shadow);
    renderDefinitionChart(raster, palette, preview, chart, 140, 720, 2120, 620);
  } else {
    const dashboardSheet = preview.sheets.find(sheet => String(sheet.type).toLowerCase() === 'dashboard') ?? preview.sheets[0];
    workbookWindow(raster, palette, 110, 700, 2180, 670, dashboardSheet, copy, false, 'dashboard-workbook');
  }
}

function renderBudgetDetail(raster, context) {
  const { palette, copy, preview } = context;
  const inputSheet = preview.sheets.find(sheet => ['input', 'data'].includes(String(sheet.type).toLowerCase())) ?? preview.sheets[0];
  header(raster, palette, copy, copy.budget, inputSheet?.name ?? context.configuration.title, 3);
  workbookWindow(raster, palette, 110, 430, 2180, 880, inputSheet, copy, false, 'budget-workbook');
  raster.rect(110, 1350, 2180, 90, palette.primary);
  raster.textBox(`${copy.sample}: ${(inputSheet?.columns ?? []).map(column => column.label).slice(0, 4).join(' / ')}`, 150, 1370, { id: 'budget-sample-summary', maxWidth: 2_100, maxHeight: 48, maxScale: 4, minScale: 1 }, contrasting(palette.primary));
}

function renderFeatures(raster, context) {
  const { palette, copy, definition, configuration, translate, preview } = context;
  header(raster, palette, copy, copy.features, `${definition.features.length} ${copy.features}`, 4);
  const features = definition.features.length ? definition.features : definition.tags;
  const workbookLabels = preview.sheets.flatMap(sheet => [sheet.name, ...sheet.columns.map(column => column.label)]).filter(Boolean);
  for (let index = 0; index < 6; index += 1) {
    const featureId = features[index % features.length] ?? definition.productFamily;
    const feature = visibleText(translate, `features.${featureId}`, workbookLabels[index % workbookLabels.length] ?? configuration.title);
    const column = index % 2;
    const row = Math.floor(index / 2);
    iconTile(raster, palette, 110 + column * 1110, 430 + row * 300, 1040, feature, configuration.title, index);
  }
}

function renderComparison(raster, context) {
  const { palette, copy, preview, appearance, definition } = context;
  const supportedAppearances = definition.extensions?.supportedAppearances ?? [appearance];
  const supportsDark = supportedAppearances.includes('dark');
  header(raster, palette, copy, supportsDark ? copy.comparison : copy.previews, `${copy.selected}: ${appearance === 'dark' ? copy.dark : copy.light}`, 5);
  workbookWindow(raster, palette, 110, 460, 1030, 780, preview.sheets[0], copy, false, 'comparison-left');
  workbookWindow(raster, palette, 1260, 460, 1030, 780, preview.sheets[1] ?? preview.sheets[0], copy, supportsDark, 'comparison-right');
  raster.rect(390, 1280, 460, 80, palette.surface); raster.border(390, 1280, 460, 80, 4, palette.border);
  raster.textBox(copy.light, 410, 1299, { id: 'comparison-light-label', maxWidth: 420, maxHeight: 42, maxScale: 5, minScale: 2, align: 'center' }, palette.text);
  const secondSurface = supportsDark ? [40, 49, 61] : palette.surface;
  const secondText = supportsDark ? [242, 246, 250] : palette.text;
  const secondBorder = supportsDark ? [108, 126, 145] : palette.border;
  raster.rect(1540, 1280, 460, 80, secondSurface); raster.border(1540, 1280, 460, 80, 4, secondBorder);
  raster.textBox(supportsDark ? copy.dark : copy.selected, 1560, 1299, { id: 'comparison-second-label', maxWidth: 420, maxHeight: 42, maxScale: 5, minScale: 1, align: 'center' }, secondText);
}

function renderIncluded(raster, context) {
  const { palette, copy, configuration } = context;
  header(raster, palette, copy, copy.included, copy.digital, 6);
  const items = [[copy.workbook, configuration.filename], [copy.guide, copy.ready], [copy.license, copy.local], [copy.images, copy.digital]];
  items.forEach(([title, detail], index) => {
    const x = 110 + (index % 2) * 1110;
    const y = 460 + Math.floor(index / 2) * 410;
    raster.card(x, y, 1040, 330, palette.surface, palette.border, palette.shadow);
    raster.rect(x + 45, y + 45, 180, 230, index === 0 ? palette.primary : palette.band);
    raster.rect(x + 75, y + 85, 120, 10, palette.accent);
    raster.rect(x + 75, y + 125, 90, 10, palette.accent);
    raster.rect(x + 75, y + 165, 105, 10, palette.accent);
    raster.textBox(title, x + 270, y + 62, { id: `included-${index + 1}-title`, maxWidth: 700, maxHeight: 92, maxScale: 6, minScale: 2, maxLines: 2, wrap: true }, palette.text);
    raster.textBox(detail, x + 270, y + 172, { id: `included-${index + 1}-detail`, maxWidth: 700, maxHeight: 105, maxScale: 4, minScale: 1, maxLines: 3, wrap: true }, palette.muted);
  });
}

function renderOptions(raster, context) {
  const { palette, copy, configuration, preview } = context;
  header(raster, palette, copy, copy.options, copy.configured, 7);
  const rows = [[copy.language, configuration.locale], [copy.currency, `${configuration.currency} / ${preview.currencyExample}`], [copy.market, configuration.market], [copy.year, configuration.year]];
  rows.forEach(([label, value], index) => {
    const y = 460 + index * 205;
    raster.card(110, y, 2180, 150, palette.surface, palette.border, palette.shadow);
    raster.rect(110, y, 390, 150, index % 2 ? palette.primary : palette.accent);
    raster.textBox(label, 150, y + 45, { id: `option-${index + 1}-label`, maxWidth: 310, maxHeight: 50, maxScale: 5, minScale: 2 }, contrasting(index % 2 ? palette.primary : palette.accent));
    raster.textBox(String(value), 570, y + 40, { id: `option-${index + 1}-value`, maxWidth: 1_560, maxHeight: 58, maxScale: 6, minScale: 2 }, palette.text);
    raster.rect(2185, y + 55, 40, 40, palette.successText);
  });
}

function renderHow(raster, context) {
  const { palette, copy, configuration } = context;
  header(raster, palette, copy, copy.how, copy.local, 8);
  const steps = [[copy.open, configuration.filename], [copy.enter, `${copy.capacity}: ${configuration.inputCapacity}`], [copy.review, copy.dashboard]];
  steps.forEach(([title, detail], index) => {
    const x = 110 + index * 740;
    raster.card(x, 520, 650, 650, palette.surface, palette.border, palette.shadow);
    raster.rect(x + 55, 575, 130, 130, index % 2 ? palette.primary : palette.accent);
    raster.textBox(String(index + 1), x + 73, 607, { id: `step-${index + 1}-number`, maxWidth: 92, maxHeight: 62, maxScale: 8, minScale: 4, align: 'center' }, contrasting(index % 2 ? palette.primary : palette.accent));
    raster.textBox(title, x + 55, 760, { id: `step-${index + 1}-title`, maxWidth: 540, maxHeight: 100, maxScale: 6, minScale: 2, maxLines: 2, wrap: true }, palette.text);
    raster.textBox(detail, x + 55, 900, { id: `step-${index + 1}-detail`, maxWidth: 540, maxHeight: 165, maxScale: 4, minScale: 1, maxLines: 4, wrap: true }, palette.muted);
    if (index < 2) {
      raster.line(x + 655, 845, x + 735, 845, 8, palette.accent);
      raster.line(x + 710, 820, x + 735, 845, 8, palette.accent);
      raster.line(x + 710, 870, x + 735, 845, 8, palette.accent);
    }
  });
}

function renderPreviews(raster, context) {
  const { palette, copy, preview } = context;
  header(raster, palette, copy, copy.previews, `${preview.sheets.length} ${copy.sheets}`, 9);
  const sheets = preview.sheets.length ? preview.sheets : [{ name: context.configuration.title, columns: [], rows: [] }];
  for (let index = 0; index < 3; index += 1) {
    workbookWindow(raster, palette, 110 + index * 760, 490 + index * 55, 660, 720, sheets[index % sheets.length], copy, index === 2 && context.appearance === 'dark', `preview-${index + 1}`);
  }
}

function renderDownload(raster, context) {
  const { palette, copy, definition, translate } = context;
  header(raster, palette, copy, copy.download, copy.noShipping, 10);
  raster.card(110, 460, 850, 820, palette.primary, palette.primary, palette.shadow);
  raster.line(535, 610, 535, 910, 42, palette.inverse);
  raster.line(410, 790, 535, 930, 42, palette.inverse);
  raster.line(660, 790, 535, 930, 42, palette.inverse);
  raster.rect(340, 1000, 390, 36, palette.accent);
  raster.textBox(copy.digital, 190, 1095, { id: 'download-digital', maxWidth: 690, maxHeight: 88, maxScale: 5, minScale: 2, maxLines: 2, wrap: true, align: 'center' }, palette.inverse);
  raster.card(1070, 460, 1220, 820, palette.surface, palette.border, palette.shadow);
  raster.textBox(copy.verified, 1140, 525, { id: 'download-verified', maxWidth: 1_080, maxHeight: 92, maxScale: 6, minScale: 2, maxLines: 2, wrap: true }, palette.text);
  const targets = definition.compatibility.targets.length ? definition.compatibility.targets : ['EXCEL'];
  const targetKeys = { 'excel-desktop': 'excelDesktop', 'excel-web': 'excelWeb', 'google-sheets': 'googleSheets' };
  targets.slice(0, 5).forEach((target, index) => {
    const y = 680 + index * 105;
    raster.rect(1140, y, 42, 42, palette.successText);
    const copyId = targetKeys[target] ?? 'excelDesktop';
    const targetLabel = copy[copyId];
    raster.textBox(targetLabel, 1225, y - 2, { id: `download-target-${index + 1}`, maxWidth: 940, maxHeight: 48, maxScale: 5, minScale: 2 }, palette.text);
  });
  raster.textBox(copy.noShipping, 1140, 1145, { id: 'download-no-shipping', maxWidth: 1_080, maxHeight: 80, maxScale: 4, minScale: 1, maxLines: 2, wrap: true }, palette.muted);
}

function previewSheet(context, ids) {
  return ids.map(id => context.preview.sheets.find(sheet => sheet.id === id)).find(Boolean) ?? context.preview.sheets[0];
}

function renderProofPage(raster, context, { page, title, subtitle, sheetIds, labels }) {
  const { palette, copy } = context;
  const selected = previewSheet(context, sheetIds);
  header(raster, palette, copy, title, subtitle, page);
  workbookWindow(raster, palette, 110, 470, 1460, 850, selected, copy, false, `proof-${page}`);
  labels.slice(0, 3).forEach((label, index) => {
    const y = 500 + index * 275;
    raster.card(1660, y, 630, 220, palette.surface, palette.border, palette.shadow);
    raster.rect(1700, y + 42, 70, 70, index % 2 ? palette.primary : palette.accent);
    raster.textBox(String(index + 1), 1710, y + 55, { id: `proof-${page}-${index + 1}-number`, maxWidth: 50, maxHeight: 40, maxScale: 5, minScale: 2, align: 'center' }, contrasting(index % 2 ? palette.primary : palette.accent));
    raster.textBox(label, 1810, y + 40, { id: `proof-${page}-${index + 1}-label`, maxWidth: 410, maxHeight: 120, maxScale: 5, minScale: 2, maxLines: 3, wrap: true }, palette.text);
  });
}

function renderPlatforms(raster, context) {
  const { palette, copy, preview } = context;
  header(raster, palette, copy, copy.compatibility, `${copy.excelDesktop} + ${copy.googleSheets}`, 11);
  [[copy.excelDesktop, 'XLSX'], [copy.googleSheets, 'IMPORT']].forEach(([label, format], index) => {
    const x = 110 + index * 1110;
    raster.card(x, 470, 1040, 330, palette.surface, palette.border, palette.shadow);
    raster.rect(x + 45, 520, 250, 220, index ? palette.accent : palette.primary);
    raster.textBox(format, x + 70, 600, { id: `platform-${index + 1}-format`, maxWidth: 200, maxHeight: 60, maxScale: 6, minScale: 2, align: 'center' }, contrasting(index ? palette.accent : palette.primary));
    raster.textBox(label, x + 350, 540, { id: `platform-${index + 1}-label`, maxWidth: 620, maxHeight: 145, maxScale: 6, minScale: 2, maxLines: 3, wrap: true }, palette.text);
  });
  workbookWindow(raster, palette, 300, 880, 1800, 470, preview.sheets[0], copy, false, 'platform-workbook');
}

function renderPaycheck(raster, context) {
  renderProofPage(raster, context, { page: 12, title: context.copy.paycheck, subtitle: context.copy.budget, sheetIds: ['pay-period-plan', 'annual-budget'], labels: [context.copy.enter, context.copy.budget, context.copy.review] });
}

function renderDebt(raster, context) {
  renderProofPage(raster, context, { page: 13, title: context.copy.debt, subtitle: context.copy.dashboard, sheetIds: ['debts', 'payment-plan'], labels: ['SNOWBALL', 'AVALANCHE', context.copy.review] });
}

function renderSavings(raster, context) {
  renderProofPage(raster, context, { page: 14, title: context.copy.savings, subtitle: context.copy.ready, sheetIds: ['goals', 'sinking-funds', 'emergency-fund'], labels: ['GOALS', 'SINKING FUNDS', 'EMERGENCY FUND'] });
}

function renderNetWorth(raster, context) {
  renderProofPage(raster, context, { page: 15, title: context.copy.netWorth, subtitle: context.copy.dashboard, sheetIds: ['net-worth-history', 'assets', 'liabilities'], labels: ['ASSETS', 'LIABILITIES', 'TREND'] });
}

function renderBills(raster, context) {
  renderProofPage(raster, context, { page: 16, title: context.copy.bills, subtitle: context.copy.configured, sheetIds: ['bills', 'subscriptions', 'recurring-transactions'], labels: ['BILLS', 'SUBSCRIPTIONS', 'RECURRING'] });
}

function renderTrustPage(raster, context, { page, title, subtitle, labels }) {
  const { palette, copy } = context;
  header(raster, palette, copy, title, subtitle, page);
  labels.slice(0, 3).forEach((label, index) => {
    const x = 110 + index * 740;
    raster.card(x, 520, 650, 670, palette.surface, palette.border, palette.shadow);
    raster.rect(x + 70, 590, 510, 18, index % 2 ? palette.primary : palette.accent);
    raster.textBox(String(index + 1).padStart(2, '0'), x + 70, 670, { id: `trust-${page}-${index + 1}-number`, maxWidth: 150, maxHeight: 90, maxScale: 9, minScale: 3 }, palette.accent);
    raster.textBox(label, x + 70, 830, { id: `trust-${page}-${index + 1}-label`, maxWidth: 510, maxHeight: 210, maxScale: 6, minScale: 2, maxLines: 4, wrap: true }, palette.text);
  });
}

function renderPrivacy(raster, context) {
  renderTrustPage(raster, context, { page: 17, title: context.copy.privacy, subtitle: context.copy.local, labels: [context.copy.local, 'NO ACCOUNT', 'NO SUBSCRIPTION'] });
}

function renderSupport(raster, context) {
  renderTrustPage(raster, context, { page: 18, title: context.copy.support, subtitle: 'ONE BUSINESS DAY', labels: ['QUICK START', 'HUMAN REPLY', 'COMPATIBILITY TRIAGE'] });
}

function renderBuyerFit(raster, context) {
  renderTrustPage(raster, context, { page: 19, title: context.copy.buyerFit, subtitle: context.configuration.title, labels: ['HOUSEHOLDS', 'PAYCHECK BUDGETERS', 'GOAL DRIVEN PLANNERS'] });
}

function renderValue(raster, context) {
  const { palette, copy, configuration, preview } = context;
  header(raster, palette, copy, copy.value, `${preview.sheets.length} ${copy.sheets}`, 20);
  raster.card(110, 470, 2180, 780, palette.primary, palette.primary, palette.shadow);
  raster.textBox(configuration.title, 180, 545, { id: 'value-title', maxWidth: 2040, maxHeight: 140, maxScale: 8, minScale: 3, maxLines: 2, wrap: true, align: 'center' }, palette.inverse);
  const values = [`${preview.sheets.length} ${copy.sheets}`, `${preview.formulaCount} ${copy.formulas}`, `${copy.excelDesktop} + ${copy.googleSheets}`];
  values.forEach((value, index) => {
    const x = 185 + index * 680;
    raster.card(x, 790, 620, 270, palette.surface, palette.accent, palette.shadow);
    raster.textBox(value, x + 45, 865, { id: `value-${index + 1}`, maxWidth: 530, maxHeight: 110, maxScale: 6, minScale: 2, maxLines: 3, wrap: true, align: 'center' }, palette.text);
  });
  raster.textBox(copy.ready, 600, 1130, { id: 'value-cta', maxWidth: 1200, maxHeight: 65, maxScale: 7, minScale: 2, align: 'center' }, palette.inverse);
}

const RENDERERS = Object.freeze([
  renderHero, renderDashboard, renderBudgetDetail, renderFeatures, renderComparison,
  renderIncluded, renderOptions, renderHow, renderPreviews, renderDownload,
  renderPlatforms, renderPaycheck, renderDebt, renderSavings, renderNetWorth,
  renderBills, renderPrivacy, renderSupport, renderBuyerFit, renderValue,
]);

function writeUint32(output, offset, value) {
  output[offset] = (value >>> 24) & 255;
  output[offset + 1] = (value >>> 16) & 255;
  output[offset + 2] = (value >>> 8) & 255;
  output[offset + 3] = value & 255;
}

function readUint32(bytes, offset) {
  return (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32LE(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function writeUint16LE(output, offset, value) {
  output[offset] = value & 255;
  output[offset + 1] = (value >>> 8) & 255;
}

function writeUint32LE(output, offset, value) {
  output[offset] = value & 255;
  output[offset + 1] = (value >>> 8) & 255;
  output[offset + 2] = (value >>> 16) & 255;
  output[offset + 3] = (value >>> 24) & 255;
}

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let value = 0; value < 256; value += 1) {
      let crc = value;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      crcTable[value] = crc >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let offset = 0; offset < bytes.length; offset += 5_552) {
    const limit = Math.min(offset + 5_552, bytes.length);
    for (let index = offset; index < limit; index += 1) {
      a += bytes[index];
      b += a;
    }
    a %= 65_521;
    b %= 65_521;
  }
  return ((b << 16) | a) >>> 0;
}

function concatBytes(parts) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function pngChunk(type, payload) {
  const typeBytes = textEncoder.encode(type);
  const output = new Uint8Array(12 + payload.length);
  writeUint32(output, 0, payload.length);
  output.set(typeBytes, 4);
  output.set(payload, 8);
  writeUint32(output, 8 + payload.length, crc32(concatBytes([typeBytes, payload])));
  return output;
}

function textChunk(keyword, value) {
  return pngChunk('tEXt', concatBytes([textEncoder.encode(keyword), Uint8Array.of(0), textEncoder.encode(String(value))]));
}

export function embedPngTextMetadata(bytes, metadata) {
  parsePng(bytes);
  const entries = Object.entries(metadata ?? {});
  if (!entries.length) return Uint8Array.from(bytes);
  for (const [key] of entries) {
    if (!/^[\x20-\x7E]{1,79}$/u.test(key) || key.includes('\0')) throw new Error(`Invalid PNG metadata keyword '${key}'.`);
  }
  const firstChunkEnd = PNG_SIGNATURE.length + 12 + 13;
  return concatBytes([
    bytes.subarray(0, firstChunkEnd),
    ...entries.map(([key, value]) => textChunk(key, value)),
    bytes.subarray(firstChunkEnd),
  ]);
}

function rasterScanlines(raster) {
  const rowBytes = raster.width * 3;
  const output = new Uint8Array(raster.height * (rowBytes + 1));
  for (let row = 0; row < raster.height; row += 1) {
    const outputOffset = row * (rowBytes + 1);
    output[outputOffset] = 0;
    output.set(raster.pixels.subarray(row * rowBytes, (row + 1) * rowBytes), outputOffset + 1);
  }
  return output;
}

async function rawDeflate(bytes, JSZipRuntime) {
  const zip = new JSZipRuntime();
  zip.file('pixels.bin', bytes, { binary: true, createFolders: false, date: FIXED_ZIP_DATE });
  const archive = await zip.generateAsync({
    type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'DOS', streamFiles: false,
  });
  if (readUint32LE(archive, 0) !== 0x04034b50 || readUint16LE(archive, 8) !== 8) throw new Error('PNG encoder could not obtain a DEFLATE payload.');
  const compressedSize = readUint32LE(archive, 18);
  const dataOffset = 30 + readUint16LE(archive, 26) + readUint16LE(archive, 28);
  if (!compressedSize || dataOffset + compressedSize > archive.length) throw new Error('PNG encoder received a malformed compression payload.');
  return archive.slice(dataOffset, dataOffset + compressedSize);
}

async function encodePng(raster, metadata, JSZipRuntime) {
  const scanlines = rasterScanlines(raster);
  const deflated = await rawDeflate(scanlines, JSZipRuntime);
  const zlib = new Uint8Array(deflated.length + 6);
  zlib.set([0x78, 0x9c], 0);
  zlib.set(deflated, 2);
  writeUint32(zlib, zlib.length - 4, adler32(scanlines));
  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, raster.width);
  writeUint32(ihdr, 4, raster.height);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const chunks = [pngChunk('IHDR', ihdr)];
  for (const [key, value] of Object.entries(metadata)) chunks.push(textChunk(key, value));
  chunks.push(pngChunk('IDAT', zlib), pngChunk('IEND', new Uint8Array()));
  return concatBytes([PNG_SIGNATURE, ...chunks]);
}

function parsePng(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 57) throw new Error('PNG bytes are missing or empty.');
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) throw new Error('Invalid PNG signature.');
  let offset = PNG_SIGNATURE.length;
  let ihdr;
  let sawEnd = false;
  const metadata = {};
  const idat = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Truncated PNG chunk.');
    const length = readUint32(bytes, offset);
    const type = new TextDecoder('ascii').decode(bytes.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error('PNG chunk exceeds the available bytes.');
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = readUint32(bytes, offset + 8 + length);
    const actualCrc = crc32(bytes.subarray(offset + 4, offset + 8 + length));
    if (expectedCrc !== actualCrc) throw new Error(`PNG ${type} chunk checksum mismatch.`);
    if (type === 'IHDR') {
      if (ihdr || length !== 13) throw new Error('PNG must contain one valid IHDR chunk.');
      ihdr = { width: readUint32(payload, 0), height: readUint32(payload, 4), bitDepth: payload[8], colorType: payload[9], compression: payload[10], filter: payload[11], interlace: payload[12] };
    } else if (type === 'tEXt') {
      const separator = payload.indexOf(0);
      if (separator > 0) metadata[new TextDecoder('ascii').decode(payload.subarray(0, separator))] = new TextDecoder('utf-8').decode(payload.subarray(separator + 1));
    } else if (type === 'IDAT') idat.push(Uint8Array.from(payload));
    else if (type === 'IEND') {
      if (length !== 0) throw new Error('PNG IEND chunk must be empty.');
      sawEnd = true;
      offset = end;
      break;
    }
    offset = end;
  }
  if (!ihdr || !idat.length || !sawEnd || offset !== bytes.length) throw new Error('PNG structure is incomplete or contains trailing bytes.');
  return { ...ihdr, metadata, zlib: concatBytes(idat) };
}

function syntheticZip(rawDeflateBytes, uncompressedSize) {
  const filename = textEncoder.encode('pixels.bin');
  const local = new Uint8Array(30 + filename.length + rawDeflateBytes.length);
  writeUint32LE(local, 0, 0x04034b50); writeUint16LE(local, 4, 20); writeUint16LE(local, 6, 0); writeUint16LE(local, 8, 8);
  writeUint32LE(local, 14, 0); writeUint32LE(local, 18, rawDeflateBytes.length); writeUint32LE(local, 22, uncompressedSize);
  writeUint16LE(local, 26, filename.length); writeUint16LE(local, 28, 0); local.set(filename, 30); local.set(rawDeflateBytes, 30 + filename.length);
  const central = new Uint8Array(46 + filename.length);
  writeUint32LE(central, 0, 0x02014b50); writeUint16LE(central, 4, 20); writeUint16LE(central, 6, 20); writeUint16LE(central, 10, 8);
  writeUint32LE(central, 16, 0); writeUint32LE(central, 20, rawDeflateBytes.length); writeUint32LE(central, 24, uncompressedSize);
  writeUint16LE(central, 28, filename.length); writeUint16LE(central, 30, 0); writeUint16LE(central, 32, 0); writeUint16LE(central, 34, 0);
  writeUint16LE(central, 36, 0); writeUint32LE(central, 38, 0); writeUint32LE(central, 42, 0); central.set(filename, 46);
  const eocd = new Uint8Array(22);
  writeUint32LE(eocd, 0, 0x06054b50); writeUint16LE(eocd, 8, 1); writeUint16LE(eocd, 10, 1);
  writeUint32LE(eocd, 12, central.length); writeUint32LE(eocd, 16, local.length); writeUint16LE(eocd, 20, 0);
  return concatBytes([local, central, eocd]);
}

async function decodePng(parsed, JSZipRuntime) {
  if (parsed.bitDepth !== 8 || parsed.colorType !== 2 || parsed.compression !== 0 || parsed.filter !== 0 || parsed.interlace !== 0) {
    throw new Error('Listing PNG must be non-interlaced RGB8.');
  }
  const zlib = parsed.zlib;
  if (zlib.length < 8 || (zlib[0] & 15) !== 8 || (((zlib[0] << 8) | zlib[1]) % 31) !== 0 || (zlib[1] & 32)) throw new Error('PNG IDAT has an invalid zlib wrapper.');
  const expectedLength = parsed.height * (1 + parsed.width * 3);
  const archive = await JSZipRuntime.loadAsync(syntheticZip(zlib.subarray(2, -4), expectedLength));
  const scanlines = await archive.file('pixels.bin')?.async('uint8array');
  if (!(scanlines instanceof Uint8Array) || scanlines.length !== expectedLength) throw new Error('PNG pixel payload could not be decoded.');
  if (adler32(scanlines) !== readUint32(zlib, zlib.length - 4)) throw new Error('PNG pixel payload checksum mismatch.');
  const rowBytes = parsed.width * 3 + 1;
  for (let row = 0; row < parsed.height; row += 1) {
    if (scanlines[row * rowBytes] !== 0) throw new Error('PNG uses an unsupported scanline filter.');
  }
  return { decodedBytes: scanlines.length, rowBytes, filter: 0 };
}

function tierFor(definition, configuration) {
  const explicit = configuration.extensions?.tier ?? definition.extensions?.tier;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim().toLowerCase();
  return ({ beginner: 'starter', intermediate: 'professional', advanced: 'ultimate' })[definition.difficulty] ?? 'professional';
}

function appearanceFor(configuration, theme) {
  const appearance = configuration.extensions?.productAppearance ?? theme.extensions?.appearance ?? 'light';
  if (!['light', 'dark'].includes(appearance)) throw new Error(`Unsupported product appearance '${appearance}'.`);
  return appearance;
}

export function definitionChartEvidence(definition) {
  const charts = [];
  for (const sheet of definition.sheets ?? []) {
    for (const chart of sheet.extensions?.charts ?? []) {
      charts.push({
        chartId: chart.id,
        chartType: chart.type,
        hostSheetId: sheet.id,
        sourceSheetIds: [...new Set([
          chart.categories?.sheetId,
          ...(chart.series ?? []).map(series => series.values?.sheetId),
        ].filter(Boolean))],
      });
    }
  }
  return charts;
}

export function listingPngMetadata(definition, configuration, theme, tier, appearance, workbookSha256, imageId, renderMethod = RENDER_METHOD) {
  return {
    ProductId: definition.id,
    ProductVersion: definition.version,
    Locale: configuration.locale,
    Theme: theme.id,
    Tier: tier,
    Appearance: appearance,
    SourceWorkbookSHA256: workbookSha256,
    RenderMethod: renderMethod,
    ImageId: imageId,
  };
}

function validateTextLayoutEvidence(layouts, imageId) {
  if (!Array.isArray(layouts) || layouts.length < 1) throw new Error(`Listing image typography evidence is missing for '${imageId}'.`);
  const ids = new Set();
  for (const entry of layouts) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)) throw new Error(`Listing image typography id is missing or duplicated for '${imageId}'.`);
    ids.add(entry.id);
    if (entry.withinBounds !== true || !Number.isInteger(entry.scale) || entry.scale < 1) throw new Error(`Listing image typography bounds failed for '${imageId}/${entry.id}'.`);
    const box = entry.box;
    const bounds = entry.bounds;
    if (!box || !bounds || box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0
      || box.x + box.width > LISTING_IMAGE_WIDTH || box.y + box.height > LISTING_IMAGE_HEIGHT
      || bounds.x < box.x || bounds.y < box.y || bounds.x + bounds.width > box.x + box.width || bounds.y + bounds.height > box.y + box.height) {
      throw new Error(`Listing image typography clip-safe contract failed for '${imageId}/${entry.id}'.`);
    }
    if (!Array.isArray(entry.lines) || entry.lines.join('').replace(/\s+/g, '') !== entry.text.replace(/\s+/g, '')) throw new Error(`Listing image typography lost visible copy for '${imageId}/${entry.id}'.`);
  }
  return Object.freeze({
    status: 'PASS',
    textCount: layouts.length,
    minimumScale: Math.min(...layouts.map(entry => entry.scale)),
    wrappedTextCount: layouts.filter(entry => entry.wrapped).length,
  });
}

function packTextLayoutEvidence(layouts) {
  return layouts.map(entry => [
    entry.id,
    entry.text,
    [...entry.lines],
    entry.scale,
    entry.wrapped,
    [entry.box.x, entry.box.y, entry.box.width, entry.box.height],
    [entry.bounds.x, entry.bounds.y, entry.bounds.width, entry.bounds.height],
    entry.withinBounds,
  ]);
}

function unpackTextLayoutEvidence(packed, imageId) {
  if (!Array.isArray(packed) || packed.length < 1) throw new Error(`Listing image typography evidence is missing for '${imageId}'.`);
  return packed.map((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 8 || !Array.isArray(entry[2])
      || !Array.isArray(entry[5]) || entry[5].length !== 4 || !Array.isArray(entry[6]) || entry[6].length !== 4) {
      throw new Error(`Listing image typography tuple is invalid for '${imageId}/${index}'.`);
    }
    return {
      id: entry[0],
      text: entry[1],
      lines: entry[2],
      scale: entry[3],
      wrapped: entry[4],
      box: { x: entry[5][0], y: entry[5][1], width: entry[5][2], height: entry[5][3] },
      bounds: { x: entry[6][0], y: entry[6][1], width: entry[6][2], height: entry[6][3] },
      withinBounds: entry[7],
    };
  });
}

export async function inspectListingPng(bytes, { JSZip: JSZipRuntime = globalThis.JSZip, decode = true } = {}) {
  if (typeof JSZipRuntime !== 'function') throw new Error('Local JSZip runtime is unavailable for PNG validation.');
  const parsed = parsePng(bytes);
  const decoded = decode ? await decodePng(parsed, JSZipRuntime) : null;
  return {
    width: parsed.width, height: parsed.height, bitDepth: parsed.bitDepth, colorType: parsed.colorType,
    metadata: Object.freeze({ ...parsed.metadata }), decoded,
  };
}

export async function validateListingImageSet({ images, manifest, definition, configuration, theme, JSZip: JSZipRuntime = globalThis.JSZip }) {
  if (typeof JSZipRuntime !== 'function') throw new Error('Local JSZip runtime is unavailable for PNG validation.');
  if (configuration.productId !== definition.id || configuration.productVersion !== definition.version) throw new Error('Listing image configuration/product identity mismatch.');
  if (manifest?.productId !== definition.id || manifest?.productVersion !== definition.version) throw new Error('Listing image manifest/product identity mismatch.');
  if (manifest?.locale !== configuration.locale || manifest?.theme !== theme.id || configuration.themeId !== theme.id) throw new Error('Listing image manifest locale/theme mismatch.');
  if (!Array.isArray(images) || images.length !== LISTING_IMAGE_PATHS.length) throw new Error(`Exactly ${LISTING_IMAGE_PATHS.length} listing PNG assets are required.`);
  if (!manifest || !Array.isArray(manifest.assets) || manifest.assets.length !== LISTING_IMAGE_PATHS.length) throw new Error(`Image manifest must cover exactly ${LISTING_IMAGE_PATHS.length} listing PNG assets.`);
  const tier = tierFor(definition, configuration);
  const appearance = appearanceFor(configuration, theme);
  const workbookSha256 = manifest.extensions?.workbookSha256;
  if (!/^[a-f0-9]{64}$/.test(String(workbookSha256))) throw new Error('Image manifest workbook checksum is missing or invalid.');
  const paths = new Set();
  const hashes = new Set();
  const evidence = [];
  const requiredIds = LISTING_IMAGE_BLUEPRINTS.map(item => item.id);
  if (JSON.stringify(manifest.extensions?.requiredImages) !== JSON.stringify(requiredIds)) throw new Error('Image manifest requiredImages does not match the final asset set.');
  if (JSON.stringify(manifest.extensions?.filenames) !== JSON.stringify(LISTING_IMAGE_PATHS.map(path => path.split('/').at(-1)))) throw new Error('Image manifest filenames do not match the final asset set.');
  if (JSON.stringify(manifest.extensions?.assetPaths) !== JSON.stringify(LISTING_IMAGE_PATHS)) throw new Error('Image manifest assetPaths do not match the final package paths.');
  const expectedCharts = definitionChartEvidence(definition);
  if (JSON.stringify(manifest.extensions?.renderEvidence?.charts ?? []) !== JSON.stringify(expectedCharts)) throw new Error('Image manifest chart/source-sheet evidence does not match the product definition.');
  for (let index = 0; index < LISTING_IMAGE_PATHS.length; index += 1) {
    const expectedPath = LISTING_IMAGE_PATHS[index];
    const blueprint = LISTING_IMAGE_BLUEPRINTS[index];
    const image = images[index];
    const asset = manifest.assets[index];
    if (!image || image.path !== expectedPath || asset?.packagePath !== expectedPath) throw new Error(`Listing image path mismatch at position ${index + 1}: expected ${expectedPath}.`);
    if (paths.has(expectedPath)) throw new Error(`Duplicate listing image path: ${expectedPath}.`);
    paths.add(expectedPath);
    if (!(image.bytes instanceof Uint8Array) || image.bytes.byteLength === 0) throw new Error(`Listing image bytes are missing for ${expectedPath}.`);
    const hash = await sha256Hex(image.bytes);
    if (hash !== image.sha256 || hash !== asset.sha256) throw new Error(`Listing image checksum mismatch for ${expectedPath}.`);
    if (hashes.has(hash)) throw new Error(`Duplicate PNG bytes are not allowed: ${expectedPath}.`);
    hashes.add(hash);
    if (asset.status !== 'validated' || asset.format !== 'png' || asset.mediaType !== 'image/png' || asset.bytes !== image.bytes.byteLength) throw new Error(`Manifest asset is not validated for ${expectedPath}.`);
    if (typeof asset.altText !== 'string' || !asset.altText.trim() || asset.altText.length > 250) throw new Error(`Localized alt text is missing or invalid for ${expectedPath}.`);
    if (asset.locale !== configuration.locale || asset.theme !== theme.id || asset.tier !== tier || asset.appearance !== appearance) throw new Error(`Manifest locale/theme/tier/appearance mismatch for ${expectedPath}.`);
    const dimensions = manifest.extensions?.dimensions?.[asset.id];
    if (dimensions?.width !== asset.width || dimensions?.height !== asset.height) throw new Error(`Image manifest dimensions map is inconsistent for ${expectedPath}.`);
    if (!manifest.extensions?.briefs?.[asset.id] || manifest.extensions.briefs[asset.id].altText !== asset.altText) throw new Error(`Image manifest brief/alt-text mapping is inconsistent for ${expectedPath}.`);
    const inspection = await inspectListingPng(image.bytes, { JSZip: JSZipRuntime, decode: true });
    if (inspection.width < MIN_IMAGE_EDGE || inspection.height < 1_000 || inspection.width <= inspection.height) throw new Error(`Listing image dimensions are below the minimum landscape size for ${expectedPath}.`);
    if (inspection.width !== asset.width || inspection.height !== asset.height) throw new Error(`PNG dimensions do not match the manifest for ${expectedPath}.`);
    const expected = listingPngMetadata(definition, configuration, theme, tier, appearance, workbookSha256, blueprint.id, manifest.extensions?.renderMethod ?? RENDER_METHOD);
    for (const [key, value] of Object.entries(expected)) {
      if (inspection.metadata[key] !== String(value)) throw new Error(`PNG ${key} metadata mismatch for ${expectedPath}.`);
    }
    const layouts = unpackTextLayoutEvidence(manifest.extensions?.renderEvidence?.textLayouts?.[blueprint.id], blueprint.id);
    const typography = validateTextLayoutEvidence(layouts, blueprint.id);
    evidence.push({ path: expectedPath, sha256: hash, bytes: image.bytes.byteLength, width: inspection.width, height: inspection.height, decodedBytes: inspection.decoded.decodedBytes, typography });
  }
  if (manifest.extensions?.productionPolicy?.executionClaim !== 'GENERATED_AND_VALIDATED_IMAGE_ASSETS') throw new Error('Image manifest does not claim generated and validated assets.');
  return Object.freeze({ status: 'PASS', imageCount: images.length, uniqueHashes: hashes.size, paths: Object.freeze([...paths]), evidence: Object.freeze(evidence) });
}

export async function generateListingImages({ plannedManifest, definition, configuration, theme, translate, workbookBytes, validationReport, previewModel, JSZip: JSZipRuntime = globalThis.JSZip, onProgress }) {
  if (typeof JSZipRuntime !== 'function') throw new Error('Local JSZip runtime is unavailable for listing image generation.');
  if (!(workbookBytes instanceof Uint8Array) || workbookBytes.length < 1_000) throw new Error('Workbook bytes are required to generate listing images.');
  if (!plannedManifest || plannedManifest.productId !== definition.id || plannedManifest.locale !== configuration.locale || plannedManifest.theme !== theme.id) throw new Error('Planned image manifest does not match the product configuration.');
  if (validationReport?.status !== 'PASS') throw new Error('Listing images require a passing workbook validation report.');
  const workbookSha256 = await sha256Hex(workbookBytes);
  const tier = tierFor(definition, configuration);
  const appearance = appearanceFor(configuration, theme);
  const preview = previewModel ?? buildPreviewModel(definition, configuration, { translate, theme });
  if (preview.productId !== definition.id || preview.locale !== configuration.locale || preview.themeId !== configuration.themeId) throw new Error('Preview model does not match the generated product.');
  const copy = copyFor(translate);
  const palette = paletteFor(theme, appearance);
  const images = [];
  const assets = [];
  const textLayouts = {};
  for (let index = 0; index < LISTING_IMAGE_BLUEPRINTS.length; index += 1) {
    const blueprint = LISTING_IMAGE_BLUEPRINTS[index];
    const raster = new Raster(LISTING_IMAGE_WIDTH, LISTING_IMAGE_HEIGHT, palette.background, blueprint.id);
    RENDERERS[index](raster, { palette, copy, definition, configuration, theme, preview, tier, appearance, validationReport, translate });
    footer(raster, palette, configuration, copy);
    const layoutValidation = validateTextLayoutEvidence(raster.layoutEvidence, blueprint.id);
    textLayouts[blueprint.id] = packTextLayoutEvidence(raster.layoutEvidence);
    const metadata = listingPngMetadata(definition, configuration, theme, tier, appearance, workbookSha256, blueprint.id);
    const bytes = await encodePng(raster, metadata, JSZipRuntime);
    const sha256 = await sha256Hex(bytes);
    const filename = blueprint.path.split('/').at(-1);
    const planned = plannedManifest.assets?.[index] ?? {};
    const altText = plannedManifest.extensions?.briefs?.[blueprint.id]?.altText;
    if (typeof altText !== 'string' || !altText.trim()) throw new Error(`Localized alt text is missing for ${blueprint.path}.`);
    images.push(Object.freeze({ id: blueprint.id, path: blueprint.path, filename, bytes, width: LISTING_IMAGE_WIDTH, height: LISTING_IMAGE_HEIGHT, mediaType: 'image/png', sha256, layoutEvidence: Object.freeze([...raster.layoutEvidence]), layoutValidation }));
    assets.push({
      id: blueprint.id, order: index + 1, purpose: blueprint.purpose, width: LISTING_IMAGE_WIDTH, height: LISTING_IMAGE_HEIGHT,
      format: 'png', filename, packagePath: blueprint.path, status: 'validated', mediaType: 'image/png', bytes: bytes.byteLength,
      locale: configuration.locale, theme: theme.id, tier, appearance, renderSource: RENDER_METHOD,
      altText: altText.trim().slice(0, 250), ...(planned.altTextKey ? { altTextKey: planned.altTextKey } : {}), sha256,
    });
    if (typeof onProgress === 'function') onProgress(Object.freeze({ completed: index + 1, total: LISTING_IMAGE_BLUEPRINTS.length, path: blueprint.path }));
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const manifest = {
    ...JSON.parse(stableStringify(plannedManifest)),
    assets,
    extensions: {
      ...JSON.parse(stableStringify(plannedManifest.extensions ?? {})),
      tier, appearance, workbookSha256, renderMethod: RENDER_METHOD,
      assetPaths: [...LISTING_IMAGE_PATHS],
      requiredImages: assets.map(asset => asset.id),
      dimensions: Object.fromEntries(assets.map(asset => [asset.id, { width: asset.width, height: asset.height }])),
      filenames: assets.map(asset => asset.filename),
      renderEvidence: { charts: definitionChartEvidence(definition), previewSheetIds: preview.sheets.map(sheet => sheet.id), formulaCount: preview.formulaCount, textLayouts },
      productionPolicy: { reviewRequired: true, executionClaim: 'GENERATED_AND_VALIDATED_IMAGE_ASSETS' },
      validation: { status: 'PENDING_FINAL_VALIDATION', imageCount: assets.length, minimumWidth: MIN_IMAGE_EDGE, requiredFormat: 'png', duplicateBytesAllowed: false },
    },
  };
  manifest.extensions.validation = await validateListingImageSet({ images, manifest, definition, configuration, theme, JSZip: JSZipRuntime });
  return Object.freeze({ images: Object.freeze(images), manifest: Object.freeze(manifest), validation: manifest.extensions.validation });
}
