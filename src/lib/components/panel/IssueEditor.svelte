<script lang="ts">
	import { untrack } from 'svelte';
	import type { AudienceFilter, NewsletterIssue } from '#lib/types/newsletter';
	import type { SelectOption } from '#lib/types/ui';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import { isNonEmpty, toPlainText } from '#lib/utils/validators';

	/** Metadata fields the editor owns; stats and identity stay with the store. */
	export type IssueEditorDraft = Pick<
		NewsletterIssue,
		'title' | 'subtitle' | 'excerpt' | 'contentMarkdown' | 'audience' | 'tags' | 'authorName' | 'coverImageUrl' | 'scheduledAt'
	>;

	interface Props {
		issue: NewsletterIssue;
		/** True when the draft differs from the persisted issue. */
		isDirty?: boolean;
		isSaving?: boolean;
		/** Last save timestamp, rendered as reassurance feedback. */
		savedAt?: string | null;
		/** When set, saving is blocked with this message. */
		validationError?: string | null;
		onchange: (patch: Partial<IssueEditorDraft>) => void;
		onsave: () => void;
		ondelete: () => void;
	}

	let {
		issue,
		isDirty = false,
		isSaving = false,
		savedAt = null,
		validationError = null,
		onchange,
		onsave,
		ondelete
	}: Props = $props();

	interface IssueEditorState {
		title: string;
		subtitle: string;
		excerpt: string;
		contentMarkdown: string;
		audience: AudienceFilter;
		tagsInput: string;
		authorName: string;
		coverImageUrl: string;
		scheduledAtLocal: string;
	}

	/** Builds a fresh editor state from an issue. */
	function createEditorState(record: NewsletterIssue): IssueEditorState {
		return {
			title: record.title,
			subtitle: record.subtitle,
			excerpt: record.excerpt,
			contentMarkdown: record.contentMarkdown,
			audience: record.audience,
			tagsInput: record.tags.join(', '),
			authorName: record.authorName,
			coverImageUrl: record.coverImageUrl ?? '',
			scheduledAtLocal: record.scheduledAt ? record.scheduledAt.slice(0, 16) : ''
		};
	}

	/**
	 * `untrack` documents the intent: this captures the *initial* prop value so the
	 * editor server-renders the persisted issue instead of an empty form. Switching
	 * to a different issue is handled by the effect below.
	 */
	let form = $state<IssueEditorState>(untrack(() => createEditorState(issue)));

	/** Identity of the issue currently loaded into the editor. */
	let loadedIssueId = $state<string | null>(untrack(() => issue.id));

	/** Re-seed the editor when it is pointed at a different issue. */
	$effect(() => {
		if (issue.id === loadedIssueId) return;
		loadedIssueId = issue.id;
		form = createEditorState(issue);
	});

	const wordCount = $derived(
		toPlainText(form.contentMarkdown.replace(/[#*>`\-]/g, ' '))
			.split(/\s+/)
			.filter(Boolean).length
	);

	const estimatedReadMinutes = $derived(Math.max(1, Math.ceil(wordCount / 220)));

	const localTitleError = $derived(
		isNonEmpty(form.title) || !validationError ? undefined : (validationError ?? undefined)
	);

	const audienceOptions: SelectOption[] = [
		{ value: 'all', label: 'All subscribers' },
		{ value: 'free_only', label: 'Free tier only' },
		{ value: 'paid_only', label: 'Paid tier only' },
		{ value: 'founding_only', label: 'Founding members only' }
	];

	function update(patch: Partial<IssueEditorDraft>): void {
		onchange(patch);
	}

	function handleTags(): void {
		update({ tags: form.tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean) });
	}
</script>

<div class="space-y-5">
	<div class="flex items-center justify-between gap-3 flex-wrap">
		<div class="flex items-center gap-2 text-xs font-mono">
			{#if isDirty}
				<span class="text-amber-700" data-state="dirty">Unsaved changes</span>
			{:else if savedAt}
				<span class="text-emerald-700" data-state="saved">Saved</span>
			{:else}
				<span class="text-stone-500" data-state="clean">No changes yet</span>
			{/if}
			<span class="text-stone-400">{wordCount} words · ~{estimatedReadMinutes} min read</span>
		</div>

		<div class="flex items-center gap-2">
			<Button variant="ghost" size="sm" class="text-rose-700" onclick={ondelete}>Delete issue</Button>
			<Button
				variant="primary"
				size="sm"
				onclick={onsave}
				loading={isSaving}
				disabled={!isDirty || Boolean(validationError)}
			>
				Save Changes
			</Button>
		</div>
	</div>

	{#if validationError}
		<p class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2" role="alert">
			{validationError}
		</p>
	{/if}

	<Input
		label="Title"
		required
		bind:value={form.title}
		error={localTitleError}
		oninput={() => update({ title: form.title })}
		placeholder="The Art of Minimal State in Modern Web Clients"
	/>

	<Input
		label="Subtitle"
		bind:value={form.subtitle}
		oninput={() => update({ subtitle: form.subtitle })}
		placeholder="One sentence that earns the click."
	/>

	<Textarea
		label="Excerpt"
		bind:value={form.excerpt}
		rows={2}
		maxlength={280}
		oninput={() => update({ excerpt: form.excerpt })}
		hint="Shown in the public archive and in list previews."
	/>

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		<Select
			label="Audience"
			bind:value={form.audience}
			options={audienceOptions}
			onchange={(event) => update({ audience: event.currentTarget.value as AudienceFilter })}
		/>

		<Input
			label="Author"
			bind:value={form.authorName}
			oninput={() => update({ authorName: form.authorName })}
			autocomplete="name"
		/>
	</div>

	<Input
		label="Tags"
		bind:value={form.tagsInput}
		onblur={handleTags}
		oninput={handleTags}
		placeholder="architecture, javascript"
		hint="Comma separated."
	/>

	<Input
		label="Cover image URL"
		type="url"
		bind:value={form.coverImageUrl}
		oninput={() => update({ coverImageUrl: form.coverImageUrl })}
		placeholder="https://…"
		hint="Optional. Leave empty for a text-only issue."
	/>

	<div>
		<label
			for="issue-scheduled-at"
			class="block text-xs font-mono uppercase tracking-wider text-stone-600 mb-1.5"
		>
			Schedule for
		</label>
		<input
			id="issue-scheduled-at"
			type="datetime-local"
			value={form.scheduledAtLocal}
			oninput={(event) => update({ scheduledAt: event.currentTarget.value })}
			class="w-full min-h-[44px] rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
		/>
		<p class="text-xs text-stone-500 mt-1.5">
			Scheduling records the intended send time. Dispatching still happens manually from the issues list.
		</p>
	</div>

	<label for="issue-markdown" class="block text-xs font-mono uppercase tracking-wider text-stone-600 mb-1.5">
		Body (Markdown)
	</label>
	<textarea
		id="issue-markdown"
		bind:value={form.contentMarkdown}
		oninput={() => update({ contentMarkdown: form.contentMarkdown })}
		rows="20"
		spellcheck="true"
		class="w-full rounded-md border border-stone-300 bg-white p-4 font-mono text-sm leading-relaxed text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 resize-y"
	></textarea>
	<p class="text-xs text-stone-500 mt-1.5">
		Supports <code class="font-mono">#</code> to <code class="font-mono">###</code> headings, blockquotes,
		lists, emphasis, inline code and links. HTML is escaped before rendering.
	</p>
</div>