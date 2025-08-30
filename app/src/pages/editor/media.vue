<script setup lang="ts">
import { Video } from 'open-clippa'
import { useEditorStore } from '@/store'

const editorStore = useEditorStore()
const { theater } = editorStore

function fileSelected([file]: FileList) {
  const video = new Video({ src: file, start: 0, duration: 5000 })
  theater.hire(video)
}
</script>

<template>
  <div p-t-2xl>
    <div flex justify-center>
      <yy-upload style="width: 80%;" @change="fileSelected">
        <yy-button style="width: 100%;" type="primary">
          导入媒体
        </yy-button>
      </yy-upload>
    </div>
  </div>
</template>
