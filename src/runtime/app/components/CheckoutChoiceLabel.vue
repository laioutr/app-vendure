<script setup lang="ts">
defineProps<{
  name: string;
  /** A line below the name: what the option is, or why it cannot be chosen. */
  note?: string;
  /** Shown at the end of the line, e.g. the price. */
  aside?: string;
}>();
</script>

<template>
  <span class="checkout-choice">
    <span>
      <span class="checkout-choice__name">{{ name }}</span>
      <span v-if="note" class="checkout-choice__note">{{ note }}</span>
    </span>
    <span v-if="aside">{{ aside }}</span>
  </span>
</template>

<style>
.checkout-choice {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-s);
  width: 100%;
}

.checkout-choice__name {
  display: block;
  font-weight: 600;
}

.checkout-choice__note {
  display: block;
  color: var(--text-grey);
  font-size: 0.875em;
}
</style>
