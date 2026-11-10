<script setup lang="ts">
import Badge from '#ui-kit/components/Badge/Badge.vue';
import Media from '#ui-kit/components/Media/Media.vue';
import Separator from '#ui-kit/components/Separator/Separator.vue';
import Text from '#ui-kit/components/Text/Text.vue';
import { $money, computed, toMedia } from '#imports';
import type { CheckoutMessages } from '../i18n/messages';
import type { CheckoutOrder } from '../utils/checkoutForms';
import { fill } from '../i18n/messages';

const props = defineProps<{
  order: CheckoutOrder;
  messages: CheckoutMessages;
  heading: string;
  /** Whether a shipping method is set, so the shipping line shows its price rather than "at the delivery step". */
  hasShipping: boolean;
}>();

const PLACEHOLDER = '/placeholders/1x1.svg';
const IMAGE_SIZE = 64;

// The image is decorative: the line's title is right beside it, and a screen reader would read it twice.
const lines = computed(() =>
  props.order.lines.map((line) => ({ ...line, media: toMedia(line.imageUrl ?? PLACEHOLDER, IMAGE_SIZE, IMAGE_SIZE, '') }))
);
</script>

<template>
  <div class="checkout-summary">
    <Text as="h2" type="heading" size="m" weight="semi-bold" class="checkout-summary__heading">{{ heading }}</Text>
    <ul class="checkout-summary__lines">
      <li v-for="line in lines" :key="line.id" class="checkout-summary__line">
        <div class="checkout-summary__image">
          <Media :media="line.media" :aspect-ratio="false" :width="IMAGE_SIZE" :height="IMAGE_SIZE" alt="" />
        </div>
        <div class="checkout-summary__line-text">
          <Text size="s" weight="semi-bold">{{ line.title }}</Text>
          <Text v-if="line.subtitle" size="xs" class="checkout-summary__muted">{{ line.subtitle }}</Text>
          <Text size="xs" class="checkout-summary__muted">{{ fill(messages.quantity, { quantity: line.quantity }) }}</Text>
        </div>
        <Text size="s" weight="semi-bold">{{ $money(line.subtotal) }}</Text>
      </li>
    </ul>
    <div v-if="order.couponCodes.length" class="checkout-summary__coupons">
      <Badge v-for="code in order.couponCodes" :key="code" icon-left="shopping/discount-1" :text="fill(messages.coupon, { code })" />
    </div>
    <Separator />
    <dl class="checkout-summary__totals">
      <div class="checkout-summary__row">
        <dt>{{ messages.subtotal }}</dt>
        <dd>{{ $money(order.subtotal) }}</dd>
      </div>
      <div class="checkout-summary__row">
        <dt>{{ messages.shipping }}</dt>
        <dd v-if="!hasShipping" class="checkout-summary__muted">{{ messages.shippingLater }}</dd>
        <dd v-else-if="order.shipping.amount === 0">{{ messages.shippingFree }}</dd>
        <dd v-else>{{ $money(order.shipping) }}</dd>
      </div>
      <div v-for="(discount, index) in order.discounts" :key="index" class="checkout-summary__row checkout-summary__row--discount">
        <dt>{{ discount.name || messages.discount }}</dt>
        <dd>−{{ $money(discount.amount) }}</dd>
      </div>
      <div class="checkout-summary__row checkout-summary__row--total">
        <dt>{{ messages.total }}</dt>
        <dd>{{ $money(order.total) }}</dd>
      </div>
    </dl>
    <Text size="xs" class="checkout-summary__muted">{{ fill(messages.taxIncluded, { amount: $money(order.tax) }) }}</Text>
  </div>
</template>

<style>
.checkout-summary {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-m);
  padding: var(--spacing-l);
  border-radius: var(--forms-border-radius);
  background: var(--grey-3);
}

.checkout-summary__heading {
  margin: 0;
}

.checkout-summary__lines {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.checkout-summary__line {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-s);
}

.checkout-summary__image {
  flex: none;
  width: 64px;
  height: 64px;
  overflow: hidden;
  border-radius: var(--forms-border-radius-small);
  background: var(--background-default);

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.checkout-summary__line-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
}

.checkout-summary__muted {
  color: var(--text-grey);
}

.checkout-summary__coupons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.checkout-summary__totals {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin: 0;
}

.checkout-summary__row {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-s);

  dd {
    margin: 0;
  }
}

.checkout-summary__row--discount dd {
  color: var(--success-11);
}

.checkout-summary__row--total {
  font-weight: 600;
  font-size: 1.125em;
}
</style>
