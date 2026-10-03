import type { CsvImportResult, Subscriber } from '#lib/types/newsletter';
import { normalizeEmail, validateEmail } from '#lib/utils/validators';
import { generateUuid } from '#lib/utils/uuid';

interface ParsedRecord {
	/** 1-based line number where the record started (multi-line fields count once). */
	lineNumber: number;
	fields: string[];
}

/** Header aliases accepted for each supported column. */
const HEADER_ALIASES = {
	email: ['email', 'e-mail', 'email_address', 'emailaddress', 'mail'],
	firstName: ['firstname', 'first_name', 'first name', 'given_name', 'name'],
	lastName: ['lastname', 'last_name', 'last name', 'family_name', 'surname'],
	tags: ['tags', 'tag', 'labels', 'segments'],
	tier: ['tier', 'plan', 'membership', 'subscription_tier'],
	status: ['status', 'state'],
	notes: ['notes', 'note', 'comment', 'comments']
} as const;

/** Tag applied to subscribers created from a spreadsheet export. */
const CSV_IMPORT_TAG = 'csv-import';

/**
 * Parses pasted CSV content and returns validated subscriber records plus a
 * per-row error report.
 *
 * Duplicates are rejected both against the existing database (case-insensitive)
 * and against earlier rows inside the same batch.
 *
 * @param csvContent Raw file contents, RFC 4180 compliant.
 * @param existingEmails Lower-cased emails already stored in the database.
 * @param nowIso Injectable timestamp, so imports are deterministic in tests.
 */
export function parseSubscribersCsv(
	csvContent: string,
	existingEmails: Set<string>,
	nowIso: string = new Date().toISOString()
): { imported: Subscriber[]; summary: CsvImportResult } {
	const records = parseRfc4180Csv(csvContent);
	const summary: CsvImportResult = {
		totalRows: 0,
		successfulImports: 0,
		failedImports: 0,
		errors: []
	};

	if (records.length === 0) {
		return { imported: [], summary };
	}

	const headers = records[0].fields.map((header) => normalizeHeader(header));
	const emailIdx = findHeaderIndex(headers, HEADER_ALIASES.email);
	const firstNameIdx = findHeaderIndex(headers, HEADER_ALIASES.firstName);
	const lastNameIdx = findHeaderIndex(headers, HEADER_ALIASES.lastName);
	const tagsIdx = findHeaderIndex(headers, HEADER_ALIASES.tags);
	const tierIdx = findHeaderIndex(headers, HEADER_ALIASES.tier);
	const statusIdx = findHeaderIndex(headers, HEADER_ALIASES.status);
	const notesIdx = findHeaderIndex(headers, HEADER_ALIASES.notes);

	if (emailIdx === -1) {
		summary.errors.push({
			row: records[0].lineNumber,
			email: '',
			reason: `Required header "email" is missing. Expected one of: ${HEADER_ALIASES.email.join(', ')}.`
		});
		return { imported: [], summary };
	}

	const imported: Subscriber[] = [];
	const seenInBatch = new Set<string>();

	for (let i = 1; i < records.length; i++) {
		const { lineNumber, fields } = records[i];
		const rawEmail = fields[emailIdx]?.trim() ?? '';

		if (fields.every((field) => field.trim().length === 0)) continue;

		summary.totalRows++;

		if (!rawEmail) {
			summary.failedImports++;
			summary.errors.push({ row: lineNumber, email: '', reason: 'Empty email column.' });
			continue;
		}

		const email = normalizeEmail(rawEmail);

		if (!validateEmail(email)) {
			summary.failedImports++;
			summary.errors.push({ row: lineNumber, email, reason: 'Invalid email syntax.' });
			continue;
		}

		if (existingEmails.has(email)) {
			summary.failedImports++;
			summary.errors.push({ row: lineNumber, email, reason: 'Already subscribed to this publication.' });
			continue;
		}

		if (seenInBatch.has(email)) {
			summary.failedImports++;
			summary.errors.push({ row: lineNumber, email, reason: 'Duplicate email inside this file.' });
			continue;
		}

		const firstName = firstNameIdx !== -1 ? (fields[firstNameIdx]?.trim() ?? '') : '';
		const lastName = lastNameIdx !== -1 ? (fields[lastNameIdx]?.trim() ?? '') : '';
		const tags = parseTagCell(tagsIdx !== -1 ? (fields[tagsIdx] ?? '') : '');
		const notes = notesIdx !== -1 ? (fields[notesIdx]?.trim() ?? '') : '';

		seenInBatch.add(email);
		summary.successfulImports++;

		imported.push({
			id: generateUuid(),
			email,
			firstName,
			lastName,
			status: parseStatusCell(statusIdx !== -1 ? (fields[statusIdx] ?? '') : ''),
			tier: parseTierCell(tierIdx !== -1 ? (fields[tierIdx] ?? '') : ''),
			tags,
			metrics: {
				emailsReceivedCount: 0,
				emailsOpenedCount: 0,
				linksClickedCount: 0,
				lastOpenedAt: null,
				openRatePercent: 0,
				clickRatePercent: 0
			},
			subscribedAt: nowIso,
			updatedAt: nowIso,
			notes: notes || `Imported via CSV on ${nowIso.slice(0, 10)}`
		});
	}

	return { imported, summary };
}

/** Builds a downloadable RFC 4180 export from the current subscriber list. */
export function toSubscribersCsv(subscribers: Subscriber[]): string {
	const header = ['email', 'firstname', 'lastname', 'status', 'tier', 'tags'];
	const rows = subscribers.map((subscriber) => [
		subscriber.email,
		subscriber.firstName,
		subscriber.lastName,
		subscriber.status,
		subscriber.tier,
		subscriber.tags.join(';')
	]);
	return [header, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

function escapeCsvField(value: string): string {
	if (/[",\r\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function normalizeHeader(header: string): string {
	return header.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, ' ');
}

function findHeaderIndex(headers: string[], aliases: readonly string[]): number {
	return headers.findIndex((header) => (aliases as readonly string[]).includes(header));
}

function parseTagCell(rawTags: string): string[] {
	const trimmed = rawTags.trim();
	if (!trimmed) return [CSV_IMPORT_TAG];

	const separators = trimmed.includes(';') ? ';' : ',';
	const tags = trimmed
		.split(separators)
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);

	return tags.length > 0 ? tags : [CSV_IMPORT_TAG];
}

function parseTierCell(rawTier: string): Subscriber['tier'] {
	const value = rawTier.trim().toLowerCase();
	if (value === 'paid' || value === 'founding') return value;
	return 'free';
}

function parseStatusCell(rawStatus: string): Subscriber['status'] {
	const value = rawStatus.trim().toLowerCase();
	if (value === 'active' || value === 'unsubscribed' || value === 'bounced' || value === 'pending') {
		return value;
	}
	return 'active';
}

/**
 * Character-level state machine implementing RFC 4180 parsing.
 *
 * Handles quoted fields containing commas, escaped quotes (`""`), and embedded
 * newlines, and accepts LF, CRLF and bare CR line terminators.
 */
function parseRfc4180Csv(input: string): ParsedRecord[] {
	const records: ParsedRecord[] = [];
	let currentFields: string[] = [];
	let currentField = '';
	let inQuotes = false;
	let currentLine = 1;
	let recordStartLine = 1;

	const flushRecord = (): void => {
		currentFields.push(currentField);
		if (currentFields.some((field) => field.trim().length > 0)) {
			records.push({ lineNumber: recordStartLine, fields: currentFields });
		}
		currentFields = [];
		currentField = '';
	};

	for (let i = 0; i < input.length; i++) {
		const char = input[i];
		const nextChar = input[i + 1];

		if (inQuotes) {
			if (char === '"' && nextChar === '"') {
				currentField += '"';
				i++;
			} else if (char === '"') {
				inQuotes = false;
			} else {
				if (char === '\n') currentLine++;
				currentField += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === ',') {
			currentFields.push(currentField);
			currentField = '';
		} else if (char === '\r' && nextChar === '\n') {
			flushRecord();
			currentLine++;
			recordStartLine = currentLine + 1;
			i++;
		} else if (char === '\n' || char === '\r') {
			flushRecord();
			currentLine++;
			recordStartLine = currentLine;
		} else {
			currentField += char;
		}
	}

	// Trailing field/record without a terminating line break.
	if (currentField.length > 0 || currentFields.length > 0) {
		flushRecord();
	}

	return records;
}