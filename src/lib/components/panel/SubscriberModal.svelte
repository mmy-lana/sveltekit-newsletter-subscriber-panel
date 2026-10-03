<script lang="ts">
	import { untrack } from 'svelte';
	import type { Subscriber, SubscriberStatus, SubscriberTier } from '#lib/types/newsletter';
	import type { SelectOption } from '#lib/types/ui';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import { isNonEmpty, normalizeEmail, validateEmail } from '#lib/utils/validators';

	interface Props {
		isOpen?: boolean;
		/** The subscriber being edited, or null when creating a new record. */
		subscriber?: Subscriber | null;
		/** Emails already in the audience, used for inline duplicate detection. */
		existingEmails?: string[];
		/** Prevents concurrent saves while a request is in flight. */
		isSaving?: boolean;
		onsave: (draft: {
			id?: string;
			email: string;
			firstName: string;
			lastName: string;
			status: SubscriberStatus;
			tier: SubscriberTier;
			tags: string[];
			notes: string;
		}) => void;
		onclose: () => void;
	}

	let {
		isOpen = $bindable(false),
		subscriber = null,
		existingEmails = [],
		isSaving = false,
		onsave,
		onclose
	}: Props = $props();

	const isEditing = $derived(subscriber !== null);

	interface SubscriberFormState {
		email: string;
		firstName: string;
		lastName: string;
		status: SubscriberStatus;
		tier: SubscriberTier;
		tagsInput: string;
		notes: string;
	}

	/** Builds a fresh form state from a subscriber record (or an empty one). */
	function createFormState(record: Subscriber | null): SubscriberFormState {
		return {
			email: record?.email ?? '',
			firstName: record?.firstName ?? '',
			lastName: record?.lastName ?? '',
			status: record?.status ?? 'active',
			tier: record?.tier ?? 'free',
			tagsInput: record?.tags.join(', ') ?? '',
			notes: record?.notes ?? ''
		};
	}

	/**
	 * `untrack` documents the intent: this captures the *initial* prop value so the
	 * first render — including the server render — already shows the edited record.
	 * Subsequent record switches are handled by the effect below.
	 */
	let form = $state<SubscriberFormState>(untrack(() => createFormState(subscriber)));
	let errors = $state<{ email?: string; name?: string }>({});
	let isTouched = $state(false);

	/** Identity of the record currently loaded into the form. */
	let loadedRecordKey = $state<string | null>(untrack(() => subscriber?.id ?? 'new'));

	/** Re-seed the form when the dialog is opened for a different record. */
	$effect(() => {
		if (!isOpen) return;

		const nextKey = subscriber?.id ?? 'new';
		if (nextKey === loadedRecordKey) return;
		loadedRecordKey = nextKey;

		form = createFormState(subscriber);
		errors = {};
		isTouched = false;
	});

	/**
	 * [MED-04] Duplicate detection is case-insensitive on both sides.
	 *
	 * The previous filter compared the stored address against the record being edited
	 * verbatim, so an editor whose address differed only in case was treated as a
	 * collision with itself and the form refused to save its own record. Both the
	 * exclusion and the lookup now go through `normalizeEmail`, which also matches
	 * the identity rule enforced by the store on write.
	 */
	const duplicateEmail = $derived(
		existingEmails
			.map((existing) => normalizeEmail(existing))
			.filter((existing) => existing !== normalizeEmail(subscriber?.email ?? ''))
			.includes(normalizeEmail(form.email))
	);

	function validate(): boolean {
		const nextErrors: { email?: string; name?: string } = {};
		const candidate = form.email.trim();

		if (!isNonEmpty(candidate)) {
			nextErrors.email = 'Email address is required.';
		} else if (!validateEmail(candidate)) {
			nextErrors.email = 'Enter a valid email address.';
		} else if (duplicateEmail) {
			nextErrors.email = 'This address is already in the audience.';
		}

		errors = nextErrors;
		return Object.keys(nextErrors).length === 0;
	}

	function handleSubmit(): void {
		isTouched = true;
		if (!validate()) return;

		onsave({
			id: subscriber?.id,
			email: normalizeEmail(form.email),
			firstName: form.firstName.trim(),
			lastName: form.lastName.trim(),
			status: form.status,
			tier: form.tier,
			tags: form.tagsInput
				.split(',')
				.map((tag) => tag.trim())
				.filter(Boolean),
			notes: form.notes.trim()
		});
	}

	const statusOptions: SelectOption[] = [
		{ value: 'active', label: 'Active' },
		{ value: 'pending', label: 'Pending (double opt-in)' },
		{ value: 'unsubscribed', label: 'Unsubscribed' },
		{ value: 'bounced', label: 'Bounced' }
	];

	const tierOptions: SelectOption[] = [
		{ value: 'free', label: 'Free' },
		{ value: 'paid', label: 'Paid' },
		{ value: 'founding', label: 'Founding' }
	];

	const metrics = $derived(
		subscriber
			? [
					{ label: 'Received', value: subscriber.metrics.emailsReceivedCount.toString() },
					{ label: 'Opened', value: subscriber.metrics.emailsOpenedCount.toString() },
					{ label: 'Clicked', value: subscriber.metrics.linksClickedCount.toString() },
					{ label: 'Open rate', value: `${subscriber.metrics.openRatePercent.toFixed(1)}%` }
				]
			: []
	);
</script>

<Modal
	bind:isOpen
	title={isEditing ? 'Edit Subscriber' : 'Add New Subscriber'}
	description={isEditing
		? 'Update reader details and engagement state.'
		: 'Create a reader record in the audience.'}
	{onclose}
>
	<form
		class="space-y-4"
		onsubmit={(event) => {
			event.preventDefault();
			handleSubmit();
		}}
	>
		<Input
			label="Email"
			type="email"
			required
			bind:value={form.email}
			placeholder="reader@example.com"
			hint="Used as the unique identity for delivery and suppression."
			error={isTouched ? errors.email : undefined}
			oninput={() => {
				// Re-validate as the operator types so the submit button recovers
				// as soon as the address becomes valid again.
				if (isTouched) validate();
			}}
			onblur={() => {
				isTouched = true;
				validate();
			}}
		/>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<Input label="First name" bind:value={form.firstName} autocomplete="given-name" />
			<Input label="Last name" bind:value={form.lastName} autocomplete="family-name" />
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<Select label="Status" bind:value={form.status} options={statusOptions} />
			<Select label="Tier" bind:value={form.tier} options={tierOptions} />
		</div>

		<Input
			label="Tags"
			bind:value={form.tagsInput}
			placeholder="architect, systems"
			hint="Comma separated. Tags drive audience segmentation."
		/>

		<Textarea
			label="Notes"
			bind:value={form.notes}
			rows={3}
			placeholder="Context for the editorial team…"
		/>

		{#if metrics.length > 0}
			<div class="rounded-md border border-stone-200 bg-stone-50 p-3">
				<p class="text-xs font-mono uppercase tracking-wider text-stone-500 mb-2">Engagement</p>
				<dl class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					{#each metrics as metric (metric.label)}
						<div>
							<dt class="text-[11px] text-stone-500">{metric.label}</dt>
							<dd class="text-sm font-mono tabular-nums text-stone-900">{metric.value}</dd>
						</div>
					{/each}
				</dl>
			</div>
		{/if}

		<!-- Keeps the native submit handler reachable for Enter-key submission. -->
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>

	{#snippet footer()}
		<Button variant="outline" size="sm" onclick={onclose} disabled={isSaving}>Cancel</Button>
		<Button variant="primary" size="sm" onclick={handleSubmit} loading={isSaving}>
			{isEditing ? 'Save Changes' : 'Add Subscriber'}
		</Button>
	{/snippet}
</Modal>