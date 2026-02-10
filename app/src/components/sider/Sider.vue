<script setup lang="ts">
const siderCollapsed = useStorage('siderCollapsed', false)
</script>

<template>
  <div w-full h-full flex bg-background-elevated>
    <Nav :expanded="!siderCollapsed" @toggle="siderCollapsed = !siderCollapsed" />

    <div
      v-if="!siderCollapsed"
      overflow-hidden bg-background-elevated flex-1
      class="border-l border-border/50"
    >
      <div h-full overflow-y-auto>
        <RouterView />
      </div>
    </div>
  </div>
</template>
