<script setup lang="ts">
import { buildRouteWithProjectId, resolveRouteProjectId } from '@/utils/projectRoute'

definePage({
  redirect: (to) => {
    const projectId = resolveRouteProjectId(to.params.projectId as string | string[] | undefined)
    return buildRouteWithProjectId('/editor/media', projectId, to.query)
  },
})
</script>

<template>
  <div />
</template>
