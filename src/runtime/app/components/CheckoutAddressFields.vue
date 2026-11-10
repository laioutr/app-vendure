<script setup lang="ts">
import Field from '#ui-kit/components/Field/Field.vue';
import Input from '#ui-kit/components/Input/Input.vue';
import InputCombobox from '#ui-kit/components/InputCombobox/InputCombobox.vue';
import type { CheckoutMessages } from '../i18n/messages';
import type { AddressForm, FieldProblems } from '../utils/checkoutForms';

const props = defineProps<{
  messages: CheckoutMessages;
  countries: { value: string; label: string }[];
  problems: FieldProblems<AddressForm>;
  /** The autocomplete section, so a browser fills shipping and billing from different entries. */
  section: 'shipping' | 'billing';
  /** The id of a field's input, so the form can move the focus to a field it refuses. */
  idOf: (field: keyof AddressForm) => string;
}>();

const address = defineModel<AddressForm>({ required: true });

const problemOf = (field: keyof AddressForm) => {
  const key = props.problems[field];
  return key ? props.messages[key] : undefined;
};

const autocomplete = (token: string) => `section-${props.section} ${props.section} ${token}`;
</script>

<template>
  <div class="checkout-address">
    <div class="checkout-address__row">
      <Field :label="messages.firstName" required :for-id="idOf('firstName')" :error-message="problemOf('firstName')">
        <Input v-model="address.firstName" :autocomplete="autocomplete('given-name')" />
      </Field>
      <Field :label="messages.lastName" required :for-id="idOf('lastName')" :error-message="problemOf('lastName')">
        <Input v-model="address.lastName" :autocomplete="autocomplete('family-name')" />
      </Field>
    </div>
    <Field :label="messages.company" :for-id="idOf('company')" :error-message="problemOf('company')">
      <Input v-model="address.company" :autocomplete="autocomplete('organization')" />
    </Field>
    <Field :label="messages.address1" required :for-id="idOf('address1')" :error-message="problemOf('address1')">
      <Input v-model="address.address1" :autocomplete="autocomplete('address-line1')" />
    </Field>
    <Field :label="messages.address2" :for-id="idOf('address2')" :error-message="problemOf('address2')">
      <Input v-model="address.address2" :autocomplete="autocomplete('address-line2')" />
    </Field>
    <div class="checkout-address__row">
      <Field :label="messages.postalCode" required :for-id="idOf('postalCode')" :error-message="problemOf('postalCode')">
        <Input v-model="address.postalCode" :autocomplete="autocomplete('postal-code')" />
      </Field>
      <Field :label="messages.city" required :for-id="idOf('city')" :error-message="problemOf('city')">
        <Input v-model="address.city" :autocomplete="autocomplete('address-level2')" />
      </Field>
    </div>
    <div class="checkout-address__row">
      <Field :label="messages.country" required :for-id="idOf('countryCode')" :error-message="problemOf('countryCode')">
        <!-- A combobox: a shop may deliver to every country, a list too long to scroll. -->
        <InputCombobox
          :model-value="address.countryCode"
          :options="countries"
          :placeholder="messages.chooseCountry"
          @update:model-value="address.countryCode = String($event)"
        />
      </Field>
      <Field :label="messages.province" :for-id="idOf('provinceCode')" :error-message="problemOf('provinceCode')">
        <Input v-model="address.provinceCode" :autocomplete="autocomplete('address-level1')" />
      </Field>
    </div>
    <Field :label="messages.phone" :for-id="idOf('phone')" :error-message="problemOf('phone')">
      <Input v-model="address.phone" type="tel" :autocomplete="autocomplete('tel')" />
    </Field>
  </div>
</template>

<style>
.checkout-address {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-m);
}

.checkout-address__row {
  display: grid;
  gap: var(--spacing-m);

  @media (--md) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
