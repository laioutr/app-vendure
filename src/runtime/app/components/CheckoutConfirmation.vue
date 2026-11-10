<script setup lang="ts">
import Button from '#ui-kit/components/Button/Button.vue';
import StatusMessage from '#ui-kit/components/StatusMessage/StatusMessage.vue';
import Text from '#ui-kit/components/Text/Text.vue';
import CheckoutSummary from './CheckoutSummary.vue';
import type { CheckoutMessages } from '../i18n/messages';
import type { CheckoutOrder } from '../utils/checkoutForms';

defineProps<{
  order: CheckoutOrder;
  messages: CheckoutMessages;
  heading: string;
  text: string;
  deliveryLines: string[];
  shopHref: string;
}>();
</script>

<template>
  <!-- Focusable from code only: the section moves the focus here once the order is placed. -->
  <div class="checkout-confirmation" tabindex="-1">
    <StatusMessage icon="essentials/check-circle-filled" status="success" :heading="heading" :description="text" />
    <div class="checkout-confirmation__details">
      <CheckoutSummary :order="order" :messages="messages" :heading="`${messages.orderNumber} ${order.code}`" has-shipping />
      <div v-if="deliveryLines.length" class="checkout-confirmation__address">
        <Text as="h2" type="heading" size="s" weight="semi-bold">{{ messages.deliveryTo }}</Text>
        <Text v-for="(line, index) in deliveryLines" :key="index" size="s">{{ line }}</Text>
      </div>
    </div>
    <div>
      <Button :href="shopHref" variant="secondary">{{ messages.continueShopping }}</Button>
    </div>
  </div>
</template>

<style>
.checkout-confirmation {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-l);
  max-width: 720px;

  &:focus {
    outline: none;
  }
}

.checkout-confirmation__details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-l);
}

.checkout-confirmation__address {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
}
</style>
