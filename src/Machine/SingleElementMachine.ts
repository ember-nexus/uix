import { GetElementEvent } from '@ember-nexus/web-sdk/BrowserEvent/Element';
import { Node, Relation, Uuid, uuidv4Regex } from '@ember-nexus/web-sdk/Type/Definition';
import { assign, fromPromise, setup } from 'xstate';

export const maxRetryAttempts = 10;
export const retryTimeoutMinMilliseconds = 10;
export const retryTimeoutVariance = 0.1; // +- 10% variance

export const singleElementMachine = setup({
  actors: {
    loadElement: fromPromise<Node | Relation, { elementId: Uuid; htmlElement: HTMLElement | DocumentFragment }>(
      ({ input }) => {
        const event = new GetElementEvent(input.elementId!);
        input.htmlElement.dispatchEvent(event);
        const getElementResult = event.getElement();
        if (getElementResult === null) {
          return Promise.reject('Unable to get Ember Nexus Web SDK events handled.');
        }
        return getElementResult;
      },
    ),
  },
  delays: {
    retryTimeout: ({ context }) => {
      // exponential backoff with ± 10% random variance
      return Math.round(
        (1 << context.retryAttempts) *
          retryTimeoutMinMilliseconds *
          (Math.random() * 2 * retryTimeoutVariance + 1 - retryTimeoutVariance),
      );
    },
  },
  guards: {
    isValidElementId: ({ context }) => {
      if (context.elementId === null) {
        return false;
      }
      return context.elementId.match(uuidv4Regex) !== null;
    },
    isElementIdEmpty: ({ context }) => {
      if (context.elementId === null) {
        return true;
      }
      return context.elementId === '';
    },
    shouldAttemptRetry: ({ context }) => {
      if (context.retryAttempts > maxRetryAttempts) {
        return false;
      }
      return context.error === 'Unable to get Ember Nexus Web SDK events handled.';
    },
  },
  types: {
    context: {} as {
      elementId: null | Uuid;
      element: null | Node | Relation;
      error: null | string;
      htmlElement: HTMLElement | DocumentFragment;
      retryAttempts: number;
    },
    input: {} as {
      elementId: Uuid;
      htmlElement: HTMLElement | DocumentFragment;
    },
    events: {} as { type: 'reset'; elementId: Uuid },
  },
}).createMachine({
  id: 'single-element-machine',
  context: ({ input }) => ({
    elementId: input.elementId,
    element: null,
    error: null,
    htmlElement: input.htmlElement,
    retryAttempts: 0,
  }),
  initial: 'Initial',
  states: {
    Initial: {
      entry: assign({
        elementId: ({ context }) => {
          return context.elementId;
        },
        element: null,
        error: null,
        retryAttempts: 0,
      }),
      always: [
        {
          guard: 'isValidElementId',
          target: 'Loading',
        },
        {
          guard: 'isElementIdEmpty',
          target: 'Error',
          actions: assign({
            error: 'Element id can not be empty.',
          }),
        },
        {
          target: 'Error',
          actions: assign({
            error: 'Unable to parse element id as uuid.',
          }),
        },
      ],
    },
    Loading: {
      invoke: {
        src: 'loadElement',
        // @ts-expect-error error description
        input: ({ context }) => ({
          elementId: context.elementId,
          htmlElement: context.htmlElement,
        }),
        onDone: {
          target: 'Loaded',
          actions: assign({
            element: ({ event }) => event.output,
          }),
        },
        onError: {
          target: 'Error',
          actions: assign({
            error: ({ event }) => String(event.error),
          }),
        },
      },
    },
    WaitingForRetry: {
      after: {
        retryTimeout: {
          target: 'Loading',
        },
      },
      on: {
        reset: {
          actions: assign({
            elementId: ({ event }) => event.elementId,
          }),
          target: 'Initial',
        },
      },
    },
    Loaded: {
      on: {
        reset: {
          actions: assign({
            elementId: ({ event }) => event.elementId,
          }),
          target: 'Initial',
        },
      },
    },
    Error: {
      on: {
        reset: {
          actions: assign({
            elementId: ({ event }) => event.elementId,
          }),
          target: 'Initial',
        },
      },
      always: {
        target: 'WaitingForRetry',
        actions: assign({
          retryAttempts: ({ context }) => context.retryAttempts + 1,
          error: null,
        }),
        guard: 'shouldAttemptRetry',
      },
    },
  },
});
