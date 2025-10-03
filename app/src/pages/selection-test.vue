<script setup lang="ts">
import type { SelectionItem } from '@clippa/selection'
import { reactive, ref } from 'vue'
// Vue组件需要直接引入.vue文件
import Selection from '../../../packages/selection/src/components/Selection.vue'

// 选框数据
const selectionItems = ref<SelectionItem[]>([
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
    width: 180,
    height: 120,
    rotation: 15,
    zIndex: 2,
    style: {
      border: '2px solid #10b981',
      background: 'rgba(16, 185, 129, 0.1)',
      handleColor: '#10b981',
      handleSize: 10,
    },
  },
  {
    id: 'selection-3',
    x: 200,
    y: 350,
    width: 250,
    height: 100,
    rotation: -10,
    zIndex: 3,
  },
])

// 当前选中的选框ID
const activeSelectionId = ref<string>('selection-1')

// 测试配置
const testConfig = reactive({
  theme: 'default' as 'default' | 'dark' | 'success' | 'warning' | 'error',
  showGrid: true,
  allowRotation: true,
})

// 处理选框更新
function handleUpdate(item: SelectionItem) {
  const index = selectionItems.value.findIndex(s => s.id === item.id)
  if (index !== -1) {
    selectionItems.value[index] = { ...item }
  }
}

// 处理选框删除
function handleDelete(id: string) {
  const index = selectionItems.value.findIndex(s => s.id === id)
  if (index !== -1) {
    selectionItems.value.splice(index, 1)
    if (activeSelectionId.value === id) {
      activeSelectionId.value = selectionItems.value[0]?.id || ''
    }
  }
}

// 处理选框选中
function handleSelect(id: string) {
  activeSelectionId.value = id
}

// 添加新选框
function addNewSelection() {
  const newSelection: SelectionItem = {
    id: `selection-${Date.now()}`,
    x: Math.random() * 400 + 50,
    y: Math.random() * 300 + 50,
    width: Math.random() * 100 + 100,
    height: Math.random() * 80 + 80,
    rotation: Math.random() * 30 - 15,
    zIndex: Math.max(...selectionItems.value.map(s => s.zIndex)) + 1,
  }

  selectionItems.value.push(newSelection)
  activeSelectionId.value = newSelection.id
}

// 清空所有选框
function clearAll() {
  selectionItems.value = []
  activeSelectionId.value = ''
}

// 批量测试选框
function createBatchSelections() {
  clearAll()

  for (let i = 0; i < 5; i++) {
    selectionItems.value.push({
      id: `batch-${i + 1}`,
      x: 50 + (i % 3) * 200,
      y: 50 + Math.floor(i / 3) * 150,
      width: 120 + Math.random() * 80,
      height: 80 + Math.random() * 60,
      rotation: (Math.random() - 0.5) * 20,
      zIndex: i + 1,
      style: i % 2 === 0
        ? {
            border: '2px dashed #f59e0b',
            background: 'rgba(245, 158, 11, 0.1)',
            handleColor: '#f59e0b',
          }
        : undefined,
    })
  }

  if (selectionItems.value.length > 0) {
    activeSelectionId.value = selectionItems.value[0].id
  }
}

// 更新当前选框的主题
function updateActiveTheme(theme: string) {
  const activeItem = selectionItems.value.find(s => s.id === activeSelectionId.value)
  if (activeItem) {
    testConfig.theme = theme as any
  }
}
</script>

<template>
  <div class="selection-test-page">
    <!-- 头部控制面板 -->
    <div class="control-panel">
      <h1 class="title">
        Selection 组件测试
      </h1>

      <div class="controls">
        <button class="btn btn-primary" @click="addNewSelection">
          添加选框
        </button>
        <button class="btn btn-danger" @click="clearAll">
          清空全部
        </button>
        <button class="btn btn-secondary" @click="createBatchSelections">
          批量生成
        </button>

        <div class="theme-selector">
          <label>主题：</label>
          <select v-model="testConfig.theme" @change="updateActiveTheme(testConfig.theme)">
            <option value="default">
              默认
            </option>
            <option value="dark">
              深色
            </option>
            <option value="success">
              成功
            </option>
            <option value="warning">
              警告
            </option>
            <option value="error">
              错误
            </option>
          </select>
        </div>

        <div class="grid-toggle">
          <label>
            <input v-model="testConfig.showGrid" type="checkbox">
            显示网格
          </label>
        </div>
      </div>
    </div>

    <!-- 测试区域 -->
    <div class="test-area" :class="{ 'show-grid': testConfig.showGrid }">
      <div class="canvas-area">
        <!-- 渲染所有选框 -->
        <Selection
          v-for="item in selectionItems"
          :key="item.id"
          :item="item"
          :theme="item.style ? undefined : testConfig.theme"
          :custom-style="item.style"
          :active="activeSelectionId === item.id"
          @update="handleUpdate"
          @delete="handleDelete"
          @select="handleSelect"
        />

        <!-- 选框信息显示 -->
        <div class="info-panel">
          <h3>选框信息</h3>
          <div v-if="selectionItems.length === 0" class="no-selections">
            暂无选框，请点击"添加选框"按钮
          </div>
          <div v-else class="selection-list">
            <div
              v-for="item in selectionItems"
              :key="item.id"
              class="selection-info" :class="[{ active: activeSelectionId === item.id }]"
              @click="activeSelectionId = item.id"
            >
              <div class="selection-id">
                {{ item.id }}
              </div>
              <div class="selection-details">
                位置: ({{ Math.round(item.x) }}, {{ Math.round(item.y) }})
              </div>
              <div class="selection-details">
                尺寸: {{ Math.round(item.width) }} × {{ Math.round(item.height) }}
              </div>
              <div class="selection-details">
                旋转: {{ Math.round(item.rotation) }}°
              </div>
              <div class="selection-details">
                层级: {{ item.zIndex }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.selection-test-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 20px;
}

.control-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.title {
  margin: 0 0 20px 0;
  color: #1f2937;
  font-size: 24px;
  font-weight: 600;
}

.controls {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.theme-selector,
.grid-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-selector select {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
}

.test-area {
  position: relative;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.canvas-area {
  position: relative;
  width: 100%;
  height: 600px;
  background: #fafafa;
}

.test-area.show-grid .canvas-area {
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
}

.info-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 280px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.info-panel h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.no-selections {
  color: #6b7280;
  font-size: 14px;
  text-align: center;
  padding: 20px 0;
}

.selection-list {
  max-height: 300px;
  overflow-y: auto;
}

.selection-info {
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.selection-info:hover {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.selection-info.active {
  border-color: #3b82f6;
  background: #dbeafe;
}

.selection-id {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}

.selection-details {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.quick-tips {
  background: white;
  border-radius: 8px;
  margin-top: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.tips-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.tips-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.tips-toggle {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tips-toggle:hover {
  background: rgba(255, 255, 255, 0.3);
}

.tips-content {
  padding: 20px;
}

.tip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s ease;
}

.tip-item:hover {
  background: #e0f2fe;
  border-left-color: #0ea5e9;
}

.tip-icon {
  font-size: 16px;
  flex-shrink: 0;
}
</style>
