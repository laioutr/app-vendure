<script setup lang="ts">
import Button from '#ui-kit/components/Button/Button.vue';
import Icon from '#ui-kit/components/Icon/Icon.vue';
import Text from '#ui-kit/components/Text/Text.vue';
import { useId } from '#imports';

defineProps<{
  number: number;
  title: string;
  /** Open shows the step's form; done shows what it holds; waiting shows only its title. */
  state: 'open' | 'done' | 'waiting';
  /** What the step holds, a line each; shown while it is done. */
  summary?: string[];
  changeLabel: string;
}>();

const emit = defineEmits<{ change: [] }>();

const titleId = useId();
</script>

<template>
  <section class="checkout-step" :class="`checkout-step--${state}`" :aria-labelledby="titleId">
    <header class="checkout-step__header">
      <span class="checkout-step__marker" aria-hidden="true">
        <Icon v-if="state === 'done'" name="essentials/check" size="s" />
        <template v-else>{{ number }}</template>
      </span>
      <!-- Focusable from code only: the section moves the focus here when the step opens. -->
      <Text :id="titleId" as="h2" type="heading" size="m" weight="semi-bold" class="checkout-step__title" tabindex="-1">{{ title }}</Text>
      <Button v-if="state === 'done'" variant="ghost-black" size="s" @click="emit('change')">{{ changeLabel }}</Button>
    </header>
    <div v-if="state === 'done' && summary?.length" class="checkout-step__summary">
      <Text v-for="(line, index) in summary" :key="index" size="s">{{ line }}</Text>
    </div>
    <div v-if="state === 'open'" class="checkout-step__body">
      <slot />
    </div>
  </section>
</template>

<style>
.checkout-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-m);
  padding: var(--spacing-l);
  border: 1px solid var(--grey-6);
  border-radius: var(--forms-border-radius);
  background: var(--background-default);
}

.checkout-step--waiting {
  color: var(--text-grey);
}

.checkout-step__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-s);
}

.checkout-step__title {
  flex: 1;
  margin: 0;

  &:focus {
    outline: none;
  }
}

.checkout-step__marker {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--grey-3);
  font-weight: 600;
}

.checkout-step--open .checkout-step__marker,
.checkout-step--done .checkout-step__marker {
  background: var(--primary-9);
  color: var(--text-white);
}

.checkout-step__summary {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding-inline-start: calc(28px + var(--spacing-s));
}

.checkout-step__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-m);
}
</style>
