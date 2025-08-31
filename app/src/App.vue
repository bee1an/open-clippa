<template>
  <yy-config-provider theme="dark">
    <div h-screen flex="~ col" items-center justify-center>
      <router-view />
    </div>
  </yy-config-provider>
</template>

<style>
  html {
  color-scheme: dark;
  overflow: hidden;
}
</style>
