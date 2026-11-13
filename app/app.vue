<template>
  <UApp :toaster="{ position: 'bottom-right' }" :tooltip="{ delayDuration: 300 }">
    <NuxtRouteAnnouncer />
    <NuxtLayout><NuxtPage /></NuxtLayout>
  </UApp>
</template>
