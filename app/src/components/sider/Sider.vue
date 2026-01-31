<script setup lang="ts"></script>

<template>
  <div w-full h-full flex bg-background-elevated>
    <Nav />

    <div flex-1 overflow-hidden bg-background-elevated class="border-l border-border/50">
      <div h-full overflow-y-auto w-220px>
        <RouterView />
      </div>
    </div>
  </div>
</template>
