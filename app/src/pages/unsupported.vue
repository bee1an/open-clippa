<script setup lang="ts">
</script>

<template>
  <div class="h-full w-full flex items-center justify-center bg-background text-foreground px-6">
    <div class="max-w-xl w-full rounded-xl border border-border bg-background-elevated p-6 space-y-4 shadow-sm">
      <h1 class="text-lg font-semibold">
        Browser Is Not Supported
      </h1>
      <p class="text-sm text-foreground-muted leading-6">
        This app requires File System Access API, IndexedDB, and secure context support.
        Please open it with a compatible Chromium-based browser in a secure origin (HTTPS or localhost).
      </p>
    </div>
  </div>
</template>
