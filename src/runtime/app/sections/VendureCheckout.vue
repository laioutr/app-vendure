<script lang="ts">
import Button from '#ui-kit/components/Button/Button.vue';
import EmptyState from '#ui-kit/components/EmptyState/EmptyState.vue';
import Field from '#ui-kit/components/Field/Field.vue';
import Input from '#ui-kit/components/Input/Input.vue';
import InputCheckbox from '#ui-kit/components/InputCheckbox/InputCheckbox.vue';
import InputRadio from '#ui-kit/components/InputRadio/InputRadio.vue';
import InputRadioItem from '#ui-kit/components/InputRadio/InputRadioItem.vue';
import LoadingSpinner from '#ui-kit/components/LoadingSpinner/LoadingSpinner.vue';
import StatusMessage from '#ui-kit/components/StatusMessage/StatusMessage.vue';
import Text from '#ui-kit/components/Text/Text.vue';
import { $money, computed, defineSection, definitionToProps, linkResolver, navigateTo, nextTick, ref, useId, watch } from '#imports';
import type { AddressForm, ContactForm, FieldProblems } from '../utils/checkoutForms';
import CheckoutAddressFields from '../components/CheckoutAddressFields.vue';
import CheckoutChoiceLabel from '../components/CheckoutChoiceLabel.vue';
import CheckoutConfirmation from '../components/CheckoutConfirmation.vue';
import CheckoutStepPanel from '../components/CheckoutStepPanel.vue';
import CheckoutSummary from '../components/CheckoutSummary.vue';
import { useVendureCheckout } from '../composables/useVendureCheckout';
import { fill } from '../i18n/messages';
import {
  ADDRESS_FIELDS,
  addressFormOf,
  addressLines,
  addressProblems,
  CONTACT_FIELDS,
  contactOf,
  contactProblems,
  countryNameOf,
  firstProblemField,
  isSameAddress,
} from '../utils/checkoutForms';
import { paymentChoiceAfter, paymentChoicesOf, paymentNoticeOf } from '../utils/checkoutPayment';
import { CHECKOUT_STEPS, type CheckoutStep, STEP_TITLES, stepIndexOf } from '../utils/checkoutSteps';

export const definition = defineSection({
  component: 'VendureCheckout',
  studio: {
    label: 'Vendure Checkout',
    description:
      'Checkout of the visitor’s Vendure cart: contact, addresses, delivery, payment and the order confirmation. Place it on the page the Vendure app’s "Checkout page" setting names.',
    package: 'Vendure',
    kit: 'Checkout',
    tags: ['Checkout & Cart'],
  },
  slots: [],
  schema: [
    {
      label: 'Checkout',
      fields: [
        {
          label: 'Heading',
          name: 'heading',
          type: 'text',
          description: 'Shown above the steps. Empty shows "Checkout" in the page language.',
        },
      ],
    },
    {
      label: 'Empty cart',
      fields: [
        {
          label: 'Heading',
          name: 'emptyHeading',
          type: 'text',
          description: 'Shown when the cart is empty. Empty shows "Your cart is empty" in the page language.',
        },
        {
          label: 'Text',
          name: 'emptyText',
          type: 'textarea',
          description: 'Empty shows "Add products to your cart to check out." in the page language.',
        },
        {
          label: 'Continue shopping link',
          name: 'shopLink',
          type: 'link',
          description: 'Where "Continue shopping" leads, on the empty cart and after an order. Empty leads to the home page.',
        },
      ],
    },
    {
      label: 'Confirmation',
      fields: [
        {
          label: 'Heading',
          name: 'confirmationHeading',
          type: 'text',
          description: 'Shown once the order is placed. Empty shows "Thank you for your order" in the page language.',
        },
        {
          label: 'Text',
          name: 'confirmationText',
          type: 'textarea',
          description:
            'Below the heading; {code} is replaced by the order number and {email} by the customer’s email. Empty shows a sentence with both in the page language.',
        },
      ],
    },
  ],
});
</script>

<script setup lang="ts">
const props = defineProps(definitionToProps(definition));

const checkout = useVendureCheckout();
const { messages, state, order, status, step, furthest, busy, problem, placed, isEmpty, customer } = checkout;

const text = (value: string | undefined, fallback: string) => value?.trim() || fallback;
const heading = computed(() => text(props.heading, messages.value.heading));
const shopHref = computed(() => (props.shopLink ? linkResolver.resolve(props.shopLink) : '/'));

const countryCodes = computed(() => state.value?.countries.map((country) => country.code) ?? []);
const countryItems = computed(() => state.value?.countries.map((country) => ({ value: country.code, label: country.name })) ?? []);
const countryName = (code: string) => countryNameOf(code, state.value?.countries ?? [], checkout.languageTag.value);

const contact = ref<ContactForm>(contactOf(null));
const contactFieldProblems = ref<FieldProblems<ContactForm>>({});
const shipping = ref<AddressForm>(addressFormOf(undefined, contact.value, []));
const billing = ref<AddressForm>(addressFormOf(undefined, contact.value, []));
const billingSame = ref(true);
const shippingProblems = ref<FieldProblems<AddressForm>>({});
const billingProblems = ref<FieldProblems<AddressForm>>({});
const shippingMethodId = ref<string | undefined>();
const paymentCode = ref<string | undefined>();

// Each step's form opens with what the order holds, so changing a step starts from its last answer.
watch(step, (open) => {
  const current = order.value;
  if (!current) return;
  if (open === 'contact') contact.value = contactOf(current);
  if (open === 'address') {
    const name = current.customer ?? contact.value;
    shipping.value = addressFormOf(current.shippingAddress, name, countryCodes.value);
    billing.value = addressFormOf(current.billingAddress ?? current.shippingAddress, name, countryCodes.value);
    billingSame.value = !current.billingAddress?.address1 || isSameAddress(current.shippingAddress, current.billingAddress);
  }
  if (open === 'delivery') shippingMethodId.value = current.shippingMethodIds[0] ?? state.value?.shippingMethods[0]?.id;
});

const paymentChoices = computed(() => paymentChoicesOf(state.value?.paymentMethods ?? [], messages.value));
watch(paymentChoices, (choices) => (paymentCode.value = paymentChoiceAfter(choices, paymentCode.value)), { immediate: true });
const paymentNotice = computed(() => paymentNoticeOf(paymentChoices.value));

const stepState = (each: CheckoutStep) => {
  if (each === step.value) return 'open';
  return stepIndexOf(each) < stepIndexOf(furthest.value) ? 'done' : 'waiting';
};

const shippingMethod = computed(() => state.value?.shippingMethods.find((method) => order.value?.shippingMethodIds.includes(method.id)));

const summaries = computed<Record<CheckoutStep, string[]>>(() => {
  const current = order.value;
  const shippingLines = addressLines(current?.shippingAddress, countryName);
  const billingDiffers = current && !isSameAddress(current.shippingAddress, current.billingAddress) && current.billingAddress?.address1;
  return {
    contact: current?.customer ? [`${current.customer.firstName} ${current.customer.lastName}`, current.customer.email] : [],
    address:
      billingDiffers ?
        [
          `${messages.value.shippingAddress}: ${shippingLines.join(', ')}`,
          `${messages.value.billingAddress}: ${addressLines(current.billingAddress, countryName).join(', ')}`,
        ]
      : shippingLines,
    delivery: shippingMethod.value ? [`${shippingMethod.value.name} · ${$money(shippingMethod.value.price)}`] : [],
    payment: [],
  };
});

/** Who the order is placed as, while a customer is signed in and the order is theirs. */
const signedInText = computed(() => {
  const signedIn = customer.value;
  if (!signedIn || !order.value?.customer) return '';
  return fill(messages.value.signedInAs, { name: signedIn.email ? `${signedIn.name} (${signedIn.email})` : signedIn.name });
});

// Focus follows the shopper: a submitted step's form disappears, which would drop the focus to the
// top of the page.
const root = ref<HTMLElement>();
const baseId = useId();
const fieldId = (form: 'contact' | 'shipping' | 'billing', field: string) => `${baseId}-${form}-${field}`;

const focus = async (selector: string) => {
  await nextTick();
  root.value?.querySelector<HTMLElement>(selector)?.focus();
};
const focusOpenStep = () => focus('.checkout-step--open .checkout-step__title');
const focusField = (form: 'contact' | 'shipping' | 'billing', field: string | undefined) =>
  field ? focus(`#${CSS.escape(fieldId(form, field))}`) : Promise.resolve();

/** Whether a form was refused for its fields, so the alert above its button says so. */
const fieldsRefused = ref(false);

const afterSubmit = async (done: boolean) => {
  if (done) await focusOpenStep();
};

const openStep = async (target: CheckoutStep) => {
  fieldsRefused.value = false;
  checkout.openStep(target);
  await focusOpenStep();
};

const submitContact = async () => {
  if (signedInText.value) {
    await openStep('address');
    return;
  }
  contactFieldProblems.value = contactProblems(contact.value);
  const invalid = firstProblemField(contactFieldProblems.value, CONTACT_FIELDS);
  fieldsRefused.value = !!invalid;
  if (invalid) await focusField('contact', invalid);
  else await afterSubmit(await checkout.submitContact(contact.value));
};

const submitAddress = async () => {
  shippingProblems.value = addressProblems(shipping.value, countryCodes.value);
  billingProblems.value = billingSame.value ? {} : addressProblems(billing.value, countryCodes.value);
  const shippingInvalid = firstProblemField(shippingProblems.value, ADDRESS_FIELDS);
  const billingInvalid = firstProblemField(billingProblems.value, ADDRESS_FIELDS);
  fieldsRefused.value = !!(shippingInvalid || billingInvalid);
  if (shippingInvalid) await focusField('shipping', shippingInvalid);
  else if (billingInvalid) await focusField('billing', billingInvalid);
  else await afterSubmit(await checkout.submitAddress(shipping.value, billingSame.value ? null : billing.value));
};

const submitDelivery = async () => {
  if (shippingMethodId.value) await afterSubmit(await checkout.submitDelivery(shippingMethodId.value));
};

const placeOrder = async () => {
  if (paymentCode.value && (await checkout.placeOrder(paymentCode.value))) await focus('.checkout-confirmation');
};

const confirmationText = computed(() => {
  const done = placed.value;
  if (!done) return '';
  return fill(text(props.confirmationText, messages.value.confirmationText), { code: done.code, email: done.customer?.email ?? '' });
});

const indicator = computed(() => fill(messages.value.stepOf, { current: stepIndexOf(step.value) + 1, total: CHECKOUT_STEPS.length }));
</script>

<template>
  <section ref="root" class="vendure-checkout ecommerce-container">
    <div v-if="status === 'loading'" class="vendure-checkout__loading">
      <LoadingSpinner />
      <Text as="span" size="s">{{ messages.loading }}</Text>
    </div>

    <div v-else-if="status === 'unavailable'" class="vendure-checkout__notice">
      <StatusMessage icon="essentials/alert" status="warning" :heading="messages.unavailable" :description="messages.unavailableText" />
      <div>
        <Button variant="secondary" @click="checkout.load()">{{ messages.retry }}</Button>
      </div>
    </div>

    <CheckoutConfirmation
      v-else-if="placed"
      :order="placed"
      :messages="messages"
      :heading="text(confirmationHeading, messages.confirmationHeading)"
      :text="confirmationText"
      :delivery-lines="addressLines(placed?.shippingAddress, countryName)"
      :shop-href="shopHref"
    />

    <EmptyState
      v-else-if="isEmpty || !order"
      class="vendure-checkout__empty"
      icon="shopping/cart-check"
      :heading="text(emptyHeading, messages.emptyHeading)"
      :subline="text(emptyText, messages.emptyText)"
      :cta="{ text: messages.continueShopping, variant: 'primary' }"
      @cta-click="navigateTo(shopHref)"
    />

    <template v-else>
      <header class="vendure-checkout__header">
        <h1 class="vendure-checkout__heading heading-xl">{{ heading }}</h1>
        <Text size="s" class="vendure-checkout__muted">{{ indicator }}</Text>
      </header>

      <div class="vendure-checkout__layout">
        <div class="vendure-checkout__steps">
          <CheckoutStepPanel
            v-for="(each, index) in CHECKOUT_STEPS"
            :key="each"
            :number="index + 1"
            :title="messages[STEP_TITLES[each]]"
            :state="stepState(each)"
            :summary="summaries[each]"
            :change-label="messages.change"
            @change="openStep(each)"
          >
            <form v-if="each === 'contact'" class="vendure-checkout__form" novalidate @submit.prevent="submitContact">
              <Text v-if="signedInText" size="s">{{ signedInText }}</Text>
              <template v-else>
                <Field
                  :label="messages.email"
                  :for-id="fieldId('contact', 'email')"
                  required
                  :error-message="contactFieldProblems.email && messages[contactFieldProblems.email]"
                >
                  <Input v-model="contact.email" type="email" autocomplete="email" />
                </Field>
                <div class="vendure-checkout__row">
                  <Field
                    :label="messages.firstName"
                    :for-id="fieldId('contact', 'firstName')"
                    required
                    :error-message="contactFieldProblems.firstName && messages[contactFieldProblems.firstName]"
                  >
                    <Input v-model="contact.firstName" autocomplete="given-name" />
                  </Field>
                  <Field
                    :label="messages.lastName"
                    :for-id="fieldId('contact', 'lastName')"
                    required
                    :error-message="contactFieldProblems.lastName && messages[contactFieldProblems.lastName]"
                  >
                    <Input v-model="contact.lastName" autocomplete="family-name" />
                  </Field>
                </div>
              </template>
              <Text v-if="fieldsRefused" size="s" class="vendure-checkout__problem" role="alert">{{ messages.fieldsNeedAttention }}</Text>
              <Text v-if="problem" size="s" class="vendure-checkout__problem" role="alert">{{ messages[problem] }}</Text>
              <div>
                <Button button-type="submit" :loading="busy" :disabled="busy" icon-right="arrows/arrow-right">{{
                  messages.continue
                }}</Button>
              </div>
            </form>

            <form v-else-if="each === 'address'" class="vendure-checkout__form" novalidate @submit.prevent="submitAddress">
              <CheckoutAddressFields
                v-model="shipping"
                section="shipping"
                :id-of="(field) => fieldId('shipping', field)"
                :messages="messages"
                :countries="countryItems"
                :problems="shippingProblems"
              />
              <InputCheckbox v-model="billingSame" :label="messages.billingSameAsShipping" />
              <template v-if="!billingSame">
                <Text as="h3" type="heading" size="s" weight="semi-bold">{{ messages.billingAddress }}</Text>
                <CheckoutAddressFields
                  v-model="billing"
                  section="billing"
                  :id-of="(field) => fieldId('billing', field)"
                  :messages="messages"
                  :countries="countryItems"
                  :problems="billingProblems"
                />
              </template>
              <Text v-if="fieldsRefused" size="s" class="vendure-checkout__problem" role="alert">{{ messages.fieldsNeedAttention }}</Text>
              <Text v-if="problem" size="s" class="vendure-checkout__problem" role="alert">{{ messages[problem] }}</Text>
              <div>
                <Button button-type="submit" :loading="busy" :disabled="busy" icon-right="arrows/arrow-right">{{
                  messages.continue
                }}</Button>
              </div>
            </form>

            <form v-else-if="each === 'delivery'" class="vendure-checkout__form" novalidate @submit.prevent="submitDelivery">
              <InputRadio v-if="state?.shippingMethods.length" v-model="shippingMethodId" variant="boxed">
                <InputRadioItem v-for="method in state.shippingMethods" :key="method.id" :value="method.id" variant="boxed">
                  <CheckoutChoiceLabel
                    :name="method.name"
                    :note="method.description"
                    :aside="method.price.amount === 0 ? messages.shippingFree : $money(method.price)"
                  />
                </InputRadioItem>
              </InputRadio>
              <Text v-else size="s" role="alert">{{ messages.noShippingMethods }}</Text>
              <Text v-if="problem" size="s" class="vendure-checkout__problem" role="alert">{{ messages[problem] }}</Text>
              <div>
                <Button button-type="submit" :loading="busy" :disabled="busy || !shippingMethodId" icon-right="arrows/arrow-right">
                  {{ messages.continue }}
                </Button>
              </div>
            </form>

            <form v-else class="vendure-checkout__form" novalidate @submit.prevent="placeOrder">
              <InputRadio v-if="paymentChoices.length" v-model="paymentCode" variant="boxed">
                <InputRadioItem
                  v-for="choice in paymentChoices"
                  :key="choice.code"
                  :value="choice.code"
                  :disabled="!choice.selectable"
                  variant="boxed"
                >
                  <CheckoutChoiceLabel :name="choice.name" :note="choice.note ?? choice.description" />
                </InputRadioItem>
              </InputRadio>
              <Text v-if="paymentNotice" size="s" class="vendure-checkout__problem" role="alert">{{ messages[paymentNotice] }}</Text>
              <div class="vendure-checkout__total">
                <Text type="heading" size="m" weight="semi-bold">{{ messages.total }}</Text>
                <Text type="heading" size="m" weight="semi-bold">{{ $money(order.total) }}</Text>
              </div>
              <Text v-if="problem" size="s" class="vendure-checkout__problem" role="alert">{{ messages[problem] }}</Text>
              <Button button-type="submit" block :loading="busy" :disabled="busy || !paymentCode" icon-left="essentials/lock">
                {{ messages.placeOrder }}
              </Button>
              <Text size="xs" class="vendure-checkout__muted">{{ messages.placeOrderNote }}</Text>
            </form>
          </CheckoutStepPanel>
        </div>

        <aside class="vendure-checkout__aside">
          <CheckoutSummary :order="order" :messages="messages" :heading="messages.orderSummary" :has-shipping="!!shippingMethod" />
        </aside>
      </div>
    </template>
  </section>
</template>

<style>
.vendure-checkout {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-l);
  padding-block: var(--spacing-xl);
}

.vendure-checkout__loading {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.vendure-checkout__notice {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-m);
  max-width: 720px;
}

.vendure-checkout__empty {
  margin-inline: auto;
}

.vendure-checkout__header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
}

.vendure-checkout__heading {
  margin: 0;
}

.vendure-checkout__layout {
  display: grid;
  gap: var(--spacing-l);
  align-items: start;

  @media (--lg) {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
  }
}

.vendure-checkout__steps {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-m);
}

.vendure-checkout__aside {
  @media (--lg) {
    position: sticky;
    top: var(--spacing-l);
  }
}

.vendure-checkout__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-m);
}

.vendure-checkout__row {
  display: grid;
  gap: var(--spacing-m);

  @media (--md) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.vendure-checkout__total {
  display: flex;
  justify-content: space-between;
  padding-top: var(--spacing-s);
  border-top: 1px solid var(--grey-6);
}

.vendure-checkout__muted {
  color: var(--text-grey);
}

.vendure-checkout__problem {
  color: var(--red-11);
}
</style>
