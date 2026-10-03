<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	interface NavItem {
		name: string;
		href: string;
		description: string;
	}

	interface Props {
		isMobileOpen?: boolean;
		/** Optional count rendered next to the Subscribers entry. */
		subscriberCount?: number;
		onclose: () => void;
	}

	let { isMobileOpen = false, subscriberCount, onclose }: Props = $props();

	const navigation: NavItem[] = [
		{ name: 'Dashboard', href: '/admin', description: 'Publication metrics' },
		{ name: 'Subscribers', href: '/admin/subscribers', description: 'Audience directory' },
		{ name: 'Issues', href: '/admin/issues', description: 'Dispatches and archives' }
	];

	/** Single source of truth for the drawer position. */
	const drawerTransform = $derived(isMobileOpen ? 'translate-x-0' : '-translate-x-full');

	function isActive(href: string): boolean {
		const pathname = page.url.pathname;
		if (href === '/admin') return pathname === '/admin';
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	// Lock background scrolling while the drawer covers the viewport.
	$effect(() => {
		if (typeof document === 'undefined' || !isMobileOpen) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});
</script>

{#if isMobileOpen}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm animate-fade-in lg:hidden w-full cursor-default"
		onclick={onclose}
		aria-label="Close navigation"
	></button>
{/if}

<!--
	Exactly one translate utility is applied at a time: emitting both
	`-translate-x-full` and `translate-x-0` leaves the outcome to CSS source order.
-->
<aside
	data-mobile-open={isMobileOpen}
	aria-label="Publisher navigation"
	class="fixed top-0 bottom-0 left-0 z-50 w-64 overscroll-contain bg-stone-50 border-r border-stone-200 transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto flex flex-col justify-between shrink-0 {drawerTransform}"
>
	<div class="flex flex-col min-h-0 flex-1">
		<div class="h-16 flex items-center justify-between px-6 border-b border-stone-200 shrink-0">
			<a
				href="/admin"
				class="inline-flex items-center min-h-[44px] font-serif font-bold text-stone-900 text-lg tracking-tight"
			>
				Publisher Studio
			</a>
			<button
				type="button"
				class="lg:hidden p-2 -mr-2 text-stone-500 hover:text-stone-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md cursor-pointer"
				onclick={onclose}
				aria-label="Close navigation"
			>
				<svg
					class="w-5 h-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
					focusable="false"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		</div>

		<nav class="p-4 space-y-1 overflow-y-auto overscroll-contain">
			{#each navigation as item (item.href)}
				{@const active = isActive(item.href)}
				<a
					href={item.href}
					onclick={onclose}
					aria-current={active ? 'page' : undefined}
					class="flex flex-col justify-center px-3 py-2 min-h-[44px] rounded-md transition-colors {active
						? 'bg-stone-200 text-stone-900 font-semibold'
						: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}"
				>
					<span class="text-sm font-medium flex items-center gap-2">
						{item.name}
						{#if item.name === 'Subscribers' && typeof subscriberCount === 'number'}
							<span
								class="ml-auto font-mono text-[11px] px-1.5 py-0.5 rounded-full bg-stone-900 text-stone-50 tabular-nums"
							>
								{subscriberCount}
							</span>
						{/if}
					</span>
					<span class="text-[11px] text-stone-500 mt-0.5">{item.description}</span>
				</a>
			{/each}
		</nav>
	</div>

	<div class="p-4 border-t border-stone-200 shrink-0">
		<a
			href="/"
			class="flex items-center justify-center w-full px-4 py-2 text-xs font-mono border border-stone-300 rounded text-stone-700 hover:bg-stone-100 transition-colors min-h-[44px]"
		>
			View Public Archive
		</a>
	</div>
</aside>