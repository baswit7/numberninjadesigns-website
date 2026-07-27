import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function concat(chunks) {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function parsePng(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 57) throw new Error('PNG is missing or empty.');
  if (!PNG_SIGNATURE.every((value, index) => bytes[index] === value)) throw new Error('PNG magic bytes are invalid.');
  let offset = PNG_SIGNATURE.length;
  let header;
  const imageData = [];
  let ended = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('PNG contains a truncated chunk.');
    const length = readUint32(bytes, offset);
    const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString('ascii');
    const next = offset + length + 12;
    if (next > bytes.length) throw new Error(`PNG ${type} chunk exceeds file length.`);
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      if (header || length !== 13) throw new Error('PNG must contain one valid IHDR chunk.');
      header = {
        width: readUint32(payload, 0),
        height: readUint32(payload, 4),
        bitDepth: payload[8],
        colorType: payload[9],
        compression: payload[10],
        filter: payload[11],
        interlace: payload[12],
      };
    } else if (type === 'IDAT') imageData.push(Uint8Array.from(payload));
    else if (type === 'IEND') {
      if (length !== 0) throw new Error('PNG IEND must be empty.');
      ended = true;
      offset = next;
      break;
    }
    offset = next;
  }
  if (!header || !imageData.length || !ended || offset !== bytes.length) throw new Error('PNG structure is incomplete or has trailing bytes.');
  return { ...header, compressed: concat(imageData) };
}

function decodeRows(parsed) {
  if (parsed.bitDepth !== 8 || ![2, 6].includes(parsed.colorType) || parsed.compression !== 0 || parsed.filter !== 0 || parsed.interlace !== 0) {
    throw new Error('PNG must be non-interlaced RGB8 or RGBA8.');
  }
  const channels = parsed.colorType === 6 ? 4 : 3;
  const rowLength = parsed.width * channels;
  const inflated = new Uint8Array(inflateSync(parsed.compressed));
  if (inflated.length !== parsed.height * (rowLength + 1)) throw new Error('PNG pixel payload length is invalid.');
  const pixels = new Uint8Array(parsed.height * rowLength);
  for (let row = 0; row < parsed.height; row += 1) {
    const sourceOffset = row * (rowLength + 1);
    const targetOffset = row * rowLength;
    const filter = inflated[sourceOffset];
    if (filter > 4) throw new Error(`PNG uses unsupported filter ${filter}.`);
    for (let column = 0; column < rowLength; column += 1) {
      const raw = inflated[sourceOffset + column + 1];
      const left = column >= channels ? pixels[targetOffset + column - channels] : 0;
      const above = row > 0 ? pixels[targetOffset - rowLength + column] : 0;
      const upperLeft = row > 0 && column >= channels ? pixels[targetOffset - rowLength + column - channels] : 0;
      const value = filter === 0 ? raw
        : filter === 1 ? raw + left
          : filter === 2 ? raw + above
            : filter === 3 ? raw + Math.floor((left + above) / 2)
              : raw + paeth(left, above, upperLeft);
      pixels[targetOffset + column] = value & 0xff;
    }
  }
  return { channels, pixels };
}

export function inspectPhysicalPng(bytes, { expectedWidth = 2400, expectedHeight = 1600 } = {}) {
  const parsed = parsePng(bytes);
  if (parsed.width !== expectedWidth || parsed.height !== expectedHeight) {
    throw new Error(`PNG dimensions ${parsed.width}x${parsed.height} do not match ${expectedWidth}x${expectedHeight}.`);
  }
  const { channels, pixels } = decodeRows(parsed);
  const colors = new Set();
  const pixelCount = parsed.width * parsed.height;
  const stride = Math.max(1, Math.floor(pixelCount / 4096));
  for (let pixel = 0; pixel < pixelCount; pixel += stride) {
    const offset = pixel * channels;
    colors.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`);
    if (colors.size >= 32) break;
  }
  if (colors.size < 4) throw new Error('PNG is empty or nearly uniform.');
  return Object.freeze({
    status: 'PASS',
    format: 'png',
    magic: '89 50 4E 47 0D 0A 1A 0A',
    width: parsed.width,
    height: parsed.height,
    bitDepth: parsed.bitDepth,
    colorType: parsed.colorType,
    decodeable: true,
    sampledColors: colors.size,
  });
}
