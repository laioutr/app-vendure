import { createCheckoutFlow } from './checkoutFlow';
import { computed, fetchAction, onBeforeUnmount, onMounted, ref, useAnalytics, useLanguage, useNuxtApp } from '#imports';
import { AddPaymentInfo, AddShippingInfo, Purchase } from '@laioutr-core/canonical-types/analytics';
import { CartAddItemsAction, CustomerGetCurrentAction } from '@laioutr-core/canonical-types/ecommerce';
import type { ActionToken } from '@laioutr-core/core-types/orchestr';
// Brings orchestr's typing of the action hooks this composable listens to.
import type {} from '@laioutr-core/orchestr';
import { messagesFor } from '../i18n/messages';
import { isCartChange } from '../utils/cartChanges';

const PLACED_MARKER_KEY = 'vendure-checkout-placed';

/**
 * Whether an order was just placed in this tab. Session storage, not the address: an order number in
 * the URL reaches whatever reads the address (tags, session replay, a shared link). Storage can be
 * blocked; then a reload shows the empty cart instead of the confirmation.
 */
const placedMarker = {
  has: () => {
    try {
      return sessionStorage.getItem(PLACED_MARKER_KEY) === '1';
    } catch {
      return false;
    }
  },
  set: () => {
    try {
      sessionStorage.setItem(PLACED_MARKER_KEY, '1');
    } catch {
      // A reload then shows the empty cart; the order itself is placed.
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(PLACED_MARKER_KEY);
    } catch {
      // Nothing could have been stored.
    }
  },
};

/**
 * The checkout section's state in a page: the flow on the storefront's own actions and analytics, the
 * texts in the page's language, and who is signed in.
 */
export const useVendureCheckout = () => {
  const language = useLanguage();
  const messages = computed(() => messagesFor(language.value?.languageCode));
  const languageTag = computed(() => language.value?.code || 'en');

  const { track } = useAnalytics();
  const flow = createCheckoutFlow(
    fetchAction,
    {
      shippingInfo: (payload) => track(AddShippingInfo, payload),
      paymentInfo: (payload) => track(AddPaymentInfo, payload),
      purchase: (payload) => track(Purchase, payload),
    },
    {
      placedMarker,
      // The header's cart refreshes when an add to the cart finishes; an empty add is that signal and
      // asks the shop nothing.
      cartChanged: () => {
        fetchAction(CartAddItemsAction, []).catch(() => undefined);
      },
    }
  );

  /** The signed-in customer's name and email; null for a guest. */
  const customer = ref<{ name: string; email?: string } | null>(null);

  const nuxt = useNuxtApp();
  const refreshOnCartChange = ({ token }: { token: ActionToken }) => {
    if (isCartChange(token)) flow.refresh();
  };
  // The cart can also change in another tab while this one is in the background.
  const refreshWhenShown = () => {
    if (document.visibilityState === 'visible') flow.refresh();
  };
  let unhookCartChanges: (() => void) | undefined;

  // Read in the browser only: the order belongs to the visitor's session, and a failed read in the
  // server render would fail the whole page rather than this section.
  onMounted(async () => {
    unhookCartChanges = nuxt.hooks.hook('orchestr:action:fetch:finally', refreshOnCartChange);
    document.addEventListener('visibilitychange', refreshWhenShown);

    // A guest is answered as unauthenticated, which is no failure here.
    const [signedIn] = await Promise.all([fetchAction(CustomerGetCurrentAction).catch(() => undefined), flow.load()]);
    const current = signedIn?.customer;
    customer.value = current ? { name: current.displayName, email: current.email } : null;
  });

  onBeforeUnmount(() => {
    unhookCartChanges?.();
    document.removeEventListener('visibilitychange', refreshWhenShown);
  });

  return { ...flow, messages, languageTag, customer };
};
