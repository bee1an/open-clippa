<script setup lang="ts">
const { active = true } = defineProps<{
  active?: boolean
}>()
</script>

<template>
  <div
    w58px h58px border-rd-2xl center cursor-pointer
    hover:bg="#13131B"
    :style="active ? {
      border: '1px solid #ffffff0d',
      backgroundColor: '#13131B',
    } : null"
  >
    <div flex flex-col items-center>
      <div i-material-symbols-service-directory text-size-2xl />
      <span text-size-2.5>你的媒体</span>
    </div>
  </div>
</template>

<style scoped></style>
