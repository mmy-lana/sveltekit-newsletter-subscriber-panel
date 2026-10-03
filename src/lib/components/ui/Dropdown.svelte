<script lang="ts">
	import type { DropdownItem } from '#lib/types/ui';

	interface DropdownProps {
		items: DropdownItem[];
		/** Text rendered inside the trigger button. */
		label: string;
		/** Currently selected value, rendered inside the trigger. */
		value?: string;
		align?: 'left' | 'right';
		disabled?: boolean;
		ariaLabel?: string;
		onselect: (value: string) => void;
		class?: string;
	}

	let {
		items,
		label,
		value = $bindable(''),
		align = 'left',
		disabled = false,
		ariaLabel,
		onselect,
		class: customClass = ''
	}: DropdownProps = $props();

	let isOpen = $state(false);
	let activeIndex = $state(0);
	let root = $state<HTMLDivElement | null>(null);
	let trigger = $state<HTMLButtonElement | null>(null);
	let menu = $state<HTMLDivElement | null>(null);

	const selectedLabel = $derived(items.find((item) => item.value === value)?.label ?? label);

	function enabledItems(): DropdownItem[] {
		return items.filter((item) => !item.disabled);
	}

	function open(): void {
		if (disabled) return;
		activeIndex = Math.max(
			0,
			items.findIndex((item) => item.value === value)
		);
		isOpen = true;
	}

	function close(restoreFocus = true): void {
		isOpen = false;
		if (restoreFocus) trigger?.focus();
	}

	function toggle(): void {
		if (isOpen) {
			close();
		} else {
			open();
		}
	}

	function select(item: DropdownItem): void {
		if (item.disabled) return;
		value = item.value;
		onselect(item.value);
		close();
	}

	function handleTriggerKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			open();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			open();
		}
	}

	function handleMenuKeydown(event: KeyboardEvent): void {
		const selectable = enabledItems();

		switch (event.key) {
			case 'Escape':
				event.preventDefault();
				close();
				break;
			case 'ArrowDown':
				event.preventDefault();
				activeIndex = (activeIndex + 1) % Math.max(1, items.length);
				break;
			case 'ArrowUp':
				event.preventDefault();
				activeIndex = (activeIndex - 1 + items.length) % Math.max(1, items.length);
				break;
			case 'Home':
				event.preventDefault();
				activeIndex = 0;
				break;
			case 'End':
				event.preventDefault();
				activeIndex = items.length - 1;
				break;
			case 'Enter':
			case ' ': {
				event.preventDefault();
				const item = items[activeIndex];
				if (item) select(item);
				break;
			}
			case 'Tab':
				close(false);
				break;
			default:
				break;
		}

		// Keep the highlighted row scrolled into view inside a long menu.
		void selectable;
	}

	// Dismiss the menu when focus or a pointer moves outside of it.
	$effect(() => {
		if (!isOpen || typeof document === 'undefined') return;

		const handlePointerDown = (event: MouseEvent | TouchEvent): void => {
			if (root && !root.contains(event.target as Node)) {
				close(false);
			}
		};

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('touchstart', handlePointerDown);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('touchstart', handlePointerDown);
		};
	});

	$effect(() => {
		if (!isOpen || !menu) return;
		const active = menu.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
		active?.scrollIntoView({ block: 'nearest' });
	});
</script>

<div bind:this={root} class="relative {customClass}">
	<button
		bind:this={trigger}
		type="button"
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={isOpen}
		aria-label={ariaLabel ?? label}
		onclick={toggle}
		onkeydown={handleTriggerKeydown}
		class="inline-flex items-center justify-between gap-2 min-h-[44px] px-3 py-2 rounded-md border border-stone-300 bg-white text-sm text-stone-900 transition-colors hover:bg-stone-50 active:bg-stone-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
	>
		<span class="truncate">{isOpen ? label : selectedLabel}</span>
		<svg
			class="w-4 h-4 text-stone-500 shrink-0"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
			focusable="false"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
			></path>
		</svg>
	</button>

	{#if isOpen}
		<div
			bind:this={menu}
			role="listbox"
			tabindex="-1"
			onkeydown={handleMenuKeydown}
			class="absolute z-30 mt-1 min-w-[12rem] max-h-72 overflow-y-auto rounded-md border border-stone-200 bg-white py-1 shadow-float animate-fade-in {align ===
			'right'
				? 'right-0'
				: 'left-0'}"
		>
			{#each items as item, index (item.value)}
				<button
					type="button"
					role="option"
					data-index={index}
					aria-selected={item.value === value}
					disabled={item.disabled}
					onclick={() => select(item)}
					onmouseenter={() => (activeIndex = index)}
					class="w-full flex items-center justify-between gap-3 min-h-[40px] px-3 py-2 text-left text-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed {item.danger
						? 'text-rose-700 hover:bg-rose-50'
						: 'text-stone-800 hover:bg-stone-100'} {activeIndex === index
						? item.danger
							? 'bg-rose-50'
							: 'bg-stone-100'
						: ''}"
				>
					<span>{item.label}</span>
					{#if item.value === value}
						<svg
							class="w-4 h-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
							focusable="false"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"
							></path>
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>