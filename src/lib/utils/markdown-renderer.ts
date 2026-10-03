/**
 * Minimal, dependency-free editorial markdown renderer with XSS hardening.
 *
 * Security model: the source is HTML-escaped *before* any markup is produced,
 * so no author input can ever emit a raw tag, attribute or entity. Links are the
 * only place where a URL is re-inserted as markup, and it passes through a strict
 * protocol allow-list that rejects `javascript:`, `data:` and other scriptable
 * schemes.
 */

/** Schemes permitted inside rendered anchors. */
const SAFE_URL_PATTERN = /^(?:https?:|mailto:|\/|#)/i;

/** Characters that must never survive into an attribute value. */
const UNSAFE_ATTRIBUTE_CHARS = /["'<>`]/g;

/**
 * Returns a safe `href` value.
 * Anything that is not an http(s), mailto, relative or fragment URL is replaced
 * with `#blocked-uri`, and quote characters are entity-encoded.
 */
export function sanitizeHref(url: string): string {
	const clean = url.trim().replace(UNSAFE_ATTRIBUTE_CHARS, '');

	if (!clean || !SAFE_URL_PATTERN.test(clean)) {
		return '#blocked-uri';
	}

	// Reject protocol-relative URLs pointing at foreign origins with a script scheme.
	if (clean.toLowerCase().startsWith('//')) {
		return '#blocked-uri';
	}

	return clean.replace(/"/g, '&quot;');
}

interface MarkdownBlock {
	html: string;
}

/**
 * Renders a restricted markdown dialect to sanitised HTML.
 *
 * Supported syntax: ATX headings (`#`, `##`, `###`), blockquotes, horizontal
 * rules, unordered lists, inline emphasis (`*`/`**`/`***`), inline code, and
 * links with optional titles.
 */
export function renderEditorialMarkdown(raw: string): string {
	if (!raw) return '';

	const escaped = raw
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

	const lines = escaped.split('\n');
	const blocks: MarkdownBlock[] = [];
	let paragraph: string[] = [];
	let listItems: string[] = [];

	const flushParagraph = (): void => {
		if (paragraph.length > 0) {
			const text = paragraph.join(' ').trim();
			if (text.length > 0) {
				blocks.push({
					html: `<p class="font-serif text-lg leading-relaxed text-stone-800 my-4 text-left">${renderInline(text)}</p>`
				});
			}
			paragraph = [];
		}
	};

	const flushList = (): void => {
		if (listItems.length > 0) {
			blocks.push({
				html: `<ul class="my-5 pl-6 space-y-1.5">${listItems
					.map(
						(item) =>
							`<li class="list-disc list-outside font-serif text-lg leading-relaxed text-stone-800">${renderInline(item)}</li>`
					)
					.join('')}</ul>`
			});
			listItems = [];
		}
	};

	const flushAll = (): void => {
		flushParagraph();
		flushList();
	};

	for (const line of lines) {
		const trimmedEnd = line.replace(/\s+$/, '');

		if (trimmedEnd.trim().length === 0) {
			flushAll();
			continue;
		}

		const heading = /^(#{1,3})\s+(.*)$/.exec(trimmedEnd);
		if (heading) {
			flushAll();
			const level = heading[1].length;
			const content = heading[2].trim();
			const headingClasses = {
				1: 'text-3xl font-serif font-bold text-stone-900 mt-12 mb-5 tracking-tight',
				2: 'text-2xl font-serif font-bold text-stone-900 mt-10 mb-4 tracking-tight',
				3: 'text-xl font-serif font-bold text-stone-900 mt-8 mb-3 tracking-tight'
			} as const;
			blocks.push({
				html: `<h${level} class="${headingClasses[level as 1 | 2 | 3]}">${renderInline(content)}</h${level}>`
			});
			continue;
		}

		if (/^---+$/.test(trimmedEnd.trim())) {
			flushAll();
			blocks.push({ html: '<hr class="my-10 border-stone-200" />' });
			continue;
		}

		const quote = /^&gt;\s?(.*)$/.exec(trimmedEnd);
		if (quote) {
			flushAll();
			blocks.push({
				html: `<blockquote class="border-l-2 border-stone-900 pl-4 py-1 italic my-6 text-stone-700 font-serif">${renderInline(quote[1].trim())}</blockquote>`
			});
			continue;
		}

		const listItem = /^\s*[-*]\s+(.*)$/.exec(trimmedEnd);
		if (listItem) {
			flushParagraph();
			listItems.push(listItem[1].trim());
			continue;
		}

		flushList();
		paragraph.push(trimmedEnd.trim());
	}

	flushAll();

	return blocks.map((block) => block.html).join('\n');
}

/** Strips markup to produce the plain-text excerpt used in list views. */
export function toExcerpt(raw: string, maxLength = 180): string {
	const plain = raw
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/^\s*>\s?/gm, '')
		.replace(/^\s*[-*]\s+/gm, '')
		.replace(/(\*\*\*|\*\*|\*)/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	if (plain.length <= maxLength) return plain;
	return `${plain.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** Escapes text for safe interpolation into HTML. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Applies inline markdown transforms. Input must already be HTML-escaped.
 */
function renderInline(text: string): string {
	return text
		.replace(/`([^`]+)`/g, '<code class="font-mono text-[0.85em] bg-stone-100 px-1.5 py-0.5 rounded">$1</code>')
		.replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_match, label, href, title) => {
			const safeHref = sanitizeHref(href);
			const titleAttribute = title ? ` title="${title}"` : '';
			return `<a href="${safeHref}"${titleAttribute} class="underline underline-offset-4 text-stone-900 decoration-stone-400 hover:decoration-stone-900 transition-colors" target="_blank" rel="noopener noreferrer">${label}</a>`;
		})
		.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}