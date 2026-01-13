<script setup lang="ts"></script>

<template>
  <div w-full h-full flex bg-zinc-900>
    <Nav />

    <div class="flex-1 overflow-hidden">
      <div class="h-full bg-zinc-900 overflow-y-auto">
        <RouterView />
      </div>
    </div>
  </div>
</template>
