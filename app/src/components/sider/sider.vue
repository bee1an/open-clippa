<script setup lang="ts"></script>

<template>
  <div wfull hfull flex>
    <Nav />

    <div p-r-2 flex-1>
      <div bg="#13131b" hfull border-rd-xl>
        <RouterView />
      </div>
    </div>
  </div>
</template>
