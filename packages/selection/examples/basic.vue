<script setup>
import { ref } from 'vue'
import Selection from '../components/Selection.vue'

const canvasRef = ref(null)
const selections = ref([
  {
    id: 'selection-1',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    rotation: 0,
    zIndex: 1,
  },
  {
    id: 'selection-2',
    x: 350,
    y: 200,
    width: 150,
    height: 100,
    rotation: 15,
    zIndex: 2,
  },
])

const themes = ['default', 'dark', 'success', 'warning', 'error']
const currentThemeIndex = ref(0)
const currentTheme = ref(themes[0])

let nextId = 3

function addSelection() {
  const newSelection = {
    id: `selection-${nextId++}`,
    x: Math.random() * 400 + 50,
    y: Math.random() * 300 + 50,
    width: Math.random() * 100 + 100,
    height: Math.random() * 80 + 80,
    rotation: Math.random() * 45 - 22.5,
    zIndex: nextId,
  }
  selections.value.push(newSelection)
}

function clearSelections() {
  selections.value = []
  nextId = 1
}

function toggleTheme() {
  currentThemeIndex.value = (currentThemeIndex.value + 1) % themes.length
  currentTheme.value = themes[currentThemeIndex.value]
}

function handleUpdate(updatedItem) {
  const index = selections.value.findIndex(item => item.id === updatedItem.id)
  if (index > -1) {
    selections.value[index] = { ...updatedItem }
  }
}

function handleDelete(id) {
  const index = selections.value.findIndex(item => item.id === id)
  if (index > -1) {
    selections.value.splice(index, 1)
  }
}
</script>

<template>
  <div class="demo-container">
    <h2>基础选择框示例</h2>

    <div class="controls">
      <button @click="addSelection">
        添加选择框
      </button>
      <button @click="clearSelections">
        清空
      </button>
      <button @click="toggleTheme">
        切换主题
      </button>
    </div>

    <div ref="canvasRef" class="canvas">
      <Selection
        v-for="item in selections"
        :key="item.id"
        :item="item"
        :theme="currentTheme"
        @update="handleUpdate"
        @delete="handleDelete"
      />
    </div>

    <div class="info">
      <h3>当前选择框:</h3>
      <pre>{{ JSON.stringify(selections, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
.demo-container {
  padding: 20px;
  font-family: Arial, sans-serif;
}

.controls {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.controls button {
  padding: 8px 16px;
  border: 1px solid #ccc;
  background: #fff;
  cursor: pointer;
  border-radius: 4px;
}

.controls button:hover {
  background: #f0f0f0;
}

.canvas {
  position: relative;
  width: 600px;
  height: 400px;
  border: 2px solid #ddd;
  background: #f9f9f9;
  margin-bottom: 20px;
}

.info {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}

.info h3 {
  margin: 0 0 10px 0;
  font-family: Arial, sans-serif;
}

pre {
  margin: 0;
  white-space: pre-wrap;
}
</style>
