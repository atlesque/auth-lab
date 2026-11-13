<script setup lang="ts">
// Floating shapes behind the page. Decoration only: hidden from assistive tech and from the pointer.
// On a phone only the two top ones show, so nothing sits behind the text.
</script>

<template>
  <div class="pointer-events-none fixed inset-0 overflow-hidden text-ink" aria-hidden="true">
    <svg viewBox="0 0 56 56" class="absolute top-[9%] left-[5%] size-10 animate-bob [--tilt:-12deg] sm:left-[9%] sm:size-14">
      <path d="M28 4l7.4 15 16.6 2.4-12 11.7 2.8 16.5L28 41.8l-14.8 7.8L16 33.1 4 21.4 20.6 19z" fill="#ffe066" stroke="currentColor" stroke-width="3" stroke-linejoin="round" />
    </svg>
    <svg viewBox="0 0 48 48" class="absolute top-[6%] right-[6%] size-8 animate-bob [animation-delay:-1.3s] sm:right-[11%] sm:size-12">
      <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="12" />
      <circle cx="24" cy="24" r="17" fill="none" stroke="#ffa3d1" stroke-width="6" />
    </svg>
    <svg viewBox="0 0 88 40" class="absolute top-[44%] left-[4%] hidden w-24 animate-bob [--tilt:8deg] [animation-delay:-2.1s] md:block">
      <path d="M8 22c9-18 18-18 27 0s18 18 27 0 9-9 18-9" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" />
      <path d="M8 22c9-18 18-18 27 0s18 18 27 0 9-9 18-9" fill="none" stroke="#93d5ff" stroke-width="6" stroke-linecap="round" />
    </svg>
    <svg viewBox="0 0 52 52" class="absolute top-[36%] right-[7%] hidden size-12 animate-bob [--tilt:14deg] [animation-delay:-0.6s] md:block">
      <path d="M26 6l21 38H5z" fill="#8fe8bf" stroke="currentColor" stroke-width="3" stroke-linejoin="round" />
    </svg>
    <svg viewBox="0 0 52 52" class="absolute bottom-[12%] left-[12%] hidden size-11 animate-bob [--tilt:-8deg] [animation-delay:-2.8s] md:block">
      <path d="M26 46S5 33 5 18a10.5 10.5 0 0 1 21-3 10.5 10.5 0 0 1 21 3c0 15-21 28-21 28z" fill="#ff4f9a" stroke="currentColor" stroke-width="3" stroke-linejoin="round" />
    </svg>
    <svg viewBox="0 0 52 52" class="absolute right-[13%] bottom-[9%] hidden size-11 animate-bob [--tilt:18deg] [animation-delay:-1.7s] md:block">
      <path d="M20 5h12v15h15v12H32v15H20V32H5V20h15z" fill="#ffbd80" stroke="currentColor" stroke-width="3" stroke-linejoin="round" />
    </svg>
  </div>
</template>
