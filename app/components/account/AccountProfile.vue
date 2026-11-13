<script setup lang="ts">
const { user, refresh } = useAuth();
const toast = useToast();
const name = ref(user.value?.name ?? '');
const busy = ref(false);

async function save() {
  busy.value = true;
  const error = problem(await authClient.updateUser({ name: name.value.trim() }));
  busy.value = false;
  if (error) return toast.add({ title: 'Could not save', description: error, color: 'error' });
  await refresh();
  toast.add({ title: 'Saved', color: 'success' });
}
</script>

<template>
  <AccountSection emoji="🙂" title="You" tint="bg-candy-pink" start-open>
    <div class="flex flex-wrap items-center gap-2">
      <span class="min-w-0 font-semibold break-all text-highlighted">{{ user?.email }}</span>
      <UBadge :label="user?.emailVerified ? 'Confirmed' : 'Not confirmed'" :color="user?.emailVerified ? 'success' : 'warning'" variant="subtle" />
      <UBadge v-if="user?.role === 'admin'" label="Admin" color="primary" variant="subtle" />
    </div>
    <form class="flex flex-wrap items-end gap-2" @submit.prevent="save">
      <UFormField label="Name" name="name" class="min-w-48 flex-1">
        <UInput v-model="name" required maxlength="80" autocomplete="name" class="w-full" />
      </UFormField>
      <UButton type="submit" label="Save" :loading="busy" :disabled="name.trim() === user?.name" />
    </form>
  </AccountSection>
</template>
