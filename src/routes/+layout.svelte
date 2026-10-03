<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';

  interface LayoutProps {
    children?: Snippet;
  }

  let { children }: LayoutProps = $props();
</script>

<svelte:head>
  <title>Newsletter Distribution & Subscriber Panel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
</svelte:head>

<div class="min-h-screen bg-[#fcfbf9] text-stone-900 selection:bg-stone-900 selection:text-white flex flex-col font-sans antialiased">
  {#if children}
    {@render children()}
  {/if}
</div>
