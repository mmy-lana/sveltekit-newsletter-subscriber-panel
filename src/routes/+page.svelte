<script lang="ts">
  import { loadSettings, loadIssues } from '#lib/storage/local-storage-client';

  const settings = loadSettings();
  const issues = loadIssues().filter((i) => i.status === 'sent');
</script>

<div class="min-h-screen flex flex-col justify-between">
  <header class="border-b border-stone-200 bg-white">
    <div class="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
      <span class="font-serif font-bold text-xl tracking-tight text-stone-900">
        {settings.publicationName}
      </span>
      <nav class="flex items-center gap-4">
        <a
          href="/admin"
          class="text-xs font-mono uppercase tracking-wider px-3 py-1.5 border border-stone-300 rounded hover:bg-stone-100 transition-colors"
        >
          Publisher Panel
        </a>
      </nav>
    </div>
  </header>

  <main class="max-w-3xl mx-auto px-6 py-12 flex-1 w-full space-y-12">
    <section class="text-center space-y-4 py-8 border-b border-stone-200">
      <h1 class="text-3xl md:text-5xl font-serif font-bold text-stone-900 tracking-tight">
        {settings.publicationName}
      </h1>
      <p class="text-stone-600 text-lg max-w-xl mx-auto font-serif">
        {settings.description}
      </p>
    </section>

    <section class="space-y-6">
      <h2 class="text-xs font-mono uppercase tracking-wider text-stone-500">Recent Dispatches</h2>
      <div class="divide-y divide-stone-200">
        {#each issues as issue (issue.id)}
          <article class="py-6 space-y-2">
            <h3 class="text-xl font-serif font-bold text-stone-900">
              {issue.title}
            </h3>
            <p class="text-stone-600 text-sm leading-relaxed">
              {issue.excerpt}
            </p>
            <div class="text-xs font-mono text-stone-500 pt-2">
              Published {new Date(issue.publishedAt || issue.createdAt).toLocaleDateString()}
            </div>
          </article>
        {/each}
      </div>
    </section>
  </main>

  <footer class="border-t border-stone-200 py-6 text-center text-xs font-mono text-stone-500">
    Substack Minimalist Architecture
  </footer>
</div>
