import { createHash } from "node:crypto";

import { createGoogleApiClient } from "./google-api-client.mjs";

export const GOOGLE_DRIVE_FILE_SCOPE =
  "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_SHEETS_MIME =
  "application/vnd.google-apps.spreadsheet";
export const GOOGLE_DRIVE_FOLDER_MIME =
  "application/vnd.google-apps.folder";
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD_API =
  "https://www.googleapis.com/upload/drive/v3";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4";
const ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const PRODUCT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
const CHUNK_ALIGNMENT = 256 * 1024;
const MAX_WORKBOOK_BYTES = 100 * 1024 * 1024;

function expectId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new TypeError(`${label} has an invalid format.`);
  }
  return value;
}

function expectProductId(value) {
  if (typeof value !== "string" || !PRODUCT_ID_PATTERN.test(value)) {
    throw new TypeError("productId has an invalid format.");
  }
  return value;
}

function expectName(value) {
  if (
    typeof value !== "string" ||
    value.trim().length < 3 ||
    value.trim().length > 180 ||
    /[\u0000-\u001f]/.test(value)
  ) {
    throw new TypeError("Google Sheets file name has an invalid format.");
  }
  return value.trim();
}

function expectWorkbookBytes(value) {
  if (!(value instanceof Uint8Array) || value.byteLength === 0) {
    throw new TypeError("workbookBytes must be a non-empty Uint8Array.");
  }
  if (value.byteLength > MAX_WORKBOOK_BYTES) {
    throw new RangeError("Workbook exceeds the 100 MiB factory safety limit.");
  }
  return value;
}

function expectSheetTitles(value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (title) =>
        typeof title !== "string" ||
        title.trim() === "" ||
        title.length > 100
    ) ||
    new Set(value).size !== value.length
  ) {
    throw new TypeError("expectedSheetTitles must contain unique sheet names.");
  }
  return [...value];
}

function normalizeChunkSize(value) {
  if (
    !Number.isInteger(value) ||
    value < CHUNK_ALIGNMENT ||
    value % CHUNK_ALIGNMENT !== 0
  ) {
    throw new RangeError(
      "chunkSize must be a positive multiple of 256 KiB."
    );
  }
  return value;
}

async function readJson(response, label) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${label} returned an invalid object.`);
  }
  return payload;
}

function uploadedByteOffset(response, totalBytes) {
  if (response.status === 200 || response.status === 201) return totalBytes;
  const range = response.headers.get("range");
  if (!range) return 0;
  const match = /^bytes=0-(\d+)$/.exec(range);
  if (!match) throw new Error("Google upload session returned an invalid range.");
  return Number(match[1]) + 1;
}

function assertSpreadsheetMetadata(payload, expectedSheetTitles) {
  expectId(payload.spreadsheetId, "spreadsheetId");
  if (!Array.isArray(payload.sheets)) {
    throw new Error("Google Sheets metadata is missing sheets.");
  }
  const actualTitles = payload.sheets.map(
    (sheet) => sheet?.properties?.title
  );
  if (
    actualTitles.length !== expectedSheetTitles.length ||
    actualTitles.some((title, index) => title !== expectedSheetTitles[index])
  ) {
    throw new Error(
      `Google Sheets tab mismatch; expected ${expectedSheetTitles.join(
        ", "
      )}, received ${actualTitles.join(", ")}.`
    );
  }
  return {
    spreadsheetId: payload.spreadsheetId,
    title: payload.properties?.title ?? null,
    locale: payload.properties?.locale ?? null,
    timeZone: payload.properties?.timeZone ?? null,
    sheets: payload.sheets.map((sheet) => ({
      id: sheet.properties.sheetId,
      title: sheet.properties.title,
      index: sheet.properties.index,
      hidden: sheet.properties.hidden === true,
      rows: sheet.properties.gridProperties?.rowCount ?? null,
      columns: sheet.properties.gridProperties?.columnCount ?? null
    }))
  };
}

export function createGoogleSheetsFactoryAdapter({
  accessTokenProvider,
  fetchImpl,
  sleep,
  random,
  timeoutMs,
  maxAttempts,
  chunkSize = DEFAULT_CHUNK_SIZE
} = {}) {
  const api = createGoogleApiClient({
    accessTokenProvider,
    fetchImpl,
    sleep,
    random,
    timeoutMs,
    maxAttempts
  });
  const normalizedChunkSize = normalizeChunkSize(chunkSize);

  async function testConnection({ folderId }) {
    const id = expectId(folderId, "folderId");
    const fields = "id,mimeType,trashed,capabilities(canAddChildren)";
    const response = await api.request({
      url: `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(
        id
      )}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`,
      label: "Google Drive connection check"
    });
    const folder = await readJson(response, "Google Drive connection check");
    if (
      folder.id !== id ||
      folder.mimeType !== GOOGLE_DRIVE_FOLDER_MIME ||
      folder.trashed === true ||
      folder.capabilities?.canAddChildren !== true
    ) {
      throw new Error(
        "Configured Google Drive target is not a writable active folder."
      );
    }
    return Object.freeze({
      connected: true,
      provider: "google-drive",
      folderId: id,
      writable: true
    });
  }

  async function findExisting({ folderId, productId, sourceSha256 }) {
    const query = [
      `'${folderId}' in parents`,
      "trashed = false",
      `mimeType = '${GOOGLE_SHEETS_MIME}'`,
      `appProperties has { key='nndProductId' and value='${productId}' }`,
      `appProperties has { key='nndSourceSha256' and value='${sourceSha256}' }`
    ].join(" and ");
    const fields = "files(id,name,mimeType,modifiedTime)";
    const response = await api.request({
      url: `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(
        query
      )}&spaces=drive&pageSize=2&fields=${encodeURIComponent(
        fields
      )}&corpora=user&includeItemsFromAllDrives=true&supportsAllDrives=true`,
      label: "Google Drive idempotency check"
    });
    const payload = await readJson(response, "Google Drive idempotency check");
    if (!Array.isArray(payload.files)) {
      throw new Error("Google Drive idempotency response is invalid.");
    }
    if (payload.files.length > 1) {
      throw new Error(
        "Google Drive contains duplicate factory files for the same source hash."
      );
    }
    return payload.files[0] ?? null;
  }

  async function getSpreadsheetMetadata({
    spreadsheetId,
    expectedSheetTitles
  }) {
    const id = expectId(spreadsheetId, "spreadsheetId");
    const expected = expectSheetTitles(expectedSheetTitles);
    const fields =
      "spreadsheetId,properties(title,locale,timeZone)," +
      "sheets(properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount)))";
    const response = await api.request({
      url: `${GOOGLE_SHEETS_API}/spreadsheets/${encodeURIComponent(
        id
      )}?includeGridData=false&fields=${encodeURIComponent(fields)}`,
      label: "Google Sheets structural verification"
    });
    return assertSpreadsheetMetadata(
      await readJson(response, "Google Sheets structural verification"),
      expected
    );
  }

  async function queryUploadStatus(sessionUrl, totalBytes) {
    const response = await api.request({
      url: sessionUrl,
      label: "Google Drive upload status check",
      method: "PUT",
      headers: {
        "Content-Length": "0",
        "Content-Range": `bytes */${totalBytes}`
      },
      body: new Uint8Array(),
      acceptedStatuses: [200, 201, 308],
      idempotent: true
    });
    return {
      response,
      offset: uploadedByteOffset(response, totalBytes)
    };
  }

  async function uploadWorkbook({
    workbookBytes,
    folderId,
    name,
    productId,
    sourceSha256
  }) {
    const metadata = {
      name,
      mimeType: GOOGLE_SHEETS_MIME,
      parents: [folderId],
      appProperties: {
        nndProductId: productId,
        nndSourceSha256: sourceSha256,
        nndFactorySchema: "1.0.0"
      }
    };
    const fields = "id,name,mimeType,createdTime,modifiedTime";
    const initiation = await api.request({
      url: `${GOOGLE_DRIVE_UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true&fields=${encodeURIComponent(
        fields
      )}`,
      label: "Google Drive resumable upload initialization",
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": XLSX_MIME,
        "X-Upload-Content-Length": String(workbookBytes.byteLength)
      },
      body: JSON.stringify(metadata),
      acceptedStatuses: [200, 201],
      idempotent: true
    });
    const sessionUrl = initiation.headers.get("location");
    if (!sessionUrl) {
      throw new Error("Google Drive did not return a resumable upload session.");
    }

    let offset = 0;
    let stalledResponses = 0;
    while (offset < workbookBytes.byteLength) {
      const endExclusive = Math.min(
        offset + normalizedChunkSize,
        workbookBytes.byteLength
      );
      let response;
      try {
        response = await api.request({
          url: sessionUrl,
          label: "Google Drive workbook upload",
          method: "PUT",
          headers: {
            "Content-Type": XLSX_MIME,
            "Content-Length": String(endExclusive - offset),
            "Content-Range": `bytes ${offset}-${endExclusive - 1}/${
              workbookBytes.byteLength
            }`
          },
          body: workbookBytes.subarray(offset, endExclusive),
          acceptedStatuses: [200, 201, 308],
          idempotent: false
        });
      } catch (error) {
        if (!error?.retryable) throw error;
        const status = await queryUploadStatus(
          sessionUrl,
          workbookBytes.byteLength
        );
        response = status.response;
      }

      const nextOffset = uploadedByteOffset(
        response,
        workbookBytes.byteLength
      );
      if (nextOffset <= offset && response.status === 308) {
        stalledResponses += 1;
        if (stalledResponses >= 4) {
          throw new Error("Google Drive upload session stopped progressing.");
        }
      } else {
        stalledResponses = 0;
      }
      offset = nextOffset;

      if (response.status === 200 || response.status === 201) {
        const uploaded = await readJson(response, "Google Drive upload");
        expectId(uploaded.id, "uploaded file id");
        return uploaded;
      }
    }

    const finalStatus = await queryUploadStatus(
      sessionUrl,
      workbookBytes.byteLength
    );
    if (![200, 201].includes(finalStatus.response.status)) {
      throw new Error("Google Drive upload did not reach a completed state.");
    }
    const uploaded = await readJson(
      finalStatus.response,
      "Google Drive upload completion"
    );
    expectId(uploaded.id, "uploaded file id");
    return uploaded;
  }

  async function importWorkbook({
    folderId,
    productId,
    name,
    workbookBytes,
    expectedSheetTitles
  }) {
    const id = expectId(folderId, "folderId");
    const canonicalProductId = expectProductId(productId);
    const fileName = expectName(name);
    const bytes = expectWorkbookBytes(workbookBytes);
    const expected = expectSheetTitles(expectedSheetTitles);
    const sourceSha256 = createHash("sha256").update(bytes).digest("hex");

    const existing = await findExisting({
      folderId: id,
      productId: canonicalProductId,
      sourceSha256
    });
    const uploaded =
      existing ??
      (await uploadWorkbook({
        workbookBytes: bytes,
        folderId: id,
        name: fileName,
        productId: canonicalProductId,
        sourceSha256
      }));
    const spreadsheet = await getSpreadsheetMetadata({
      spreadsheetId: uploaded.id,
      expectedSheetTitles: expected
    });

    return Object.freeze({
      schemaVersion: "1.0.0",
      provider: "google-drive-and-sheets",
      scope: GOOGLE_DRIVE_FILE_SCOPE,
      productId: canonicalProductId,
      sourceSha256,
      sourceBytes: bytes.byteLength,
      spreadsheetId: uploaded.id,
      reused: Boolean(existing),
      structuralValidation: "passed",
      formulaCompatibilityValidation: "not-performed",
      compatibilityClaimAllowed: false,
      spreadsheet
    });
  }

  return Object.freeze({
    testConnection,
    importWorkbook,
    getSpreadsheetMetadata
  });
}
