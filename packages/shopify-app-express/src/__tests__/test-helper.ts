import crypto, {BinaryToTextEncoding} from 'crypto';

import semver from 'semver';
import fetchMock, {MockParams} from 'jest-fetch-mock';
import {LATEST_API_VERSION} from '@shopify/shopify-api';
import {MemorySessionStorage} from '@shopify/shopify-app-session-storage-memory';

import {shopifyApp, ShopifyApp} from '../index';
import {AppConfigParams} from '../config-types';
import {SHOPIFY_EXPRESS_LIBRARY_VERSION} from '../version';

// eslint-disable-next-line import/no-mutable-exports
export let testConfig: AppConfigParams & {
  api: {
    apiKey: string;
    apiSecretKey: string;
    scopes: string[];
    apiVersion: string;
  };
};
// eslint-disable-next-line import/no-mutable-exports
export let shopify: ShopifyApp;

export const TEST_SHOP = 'test-shop.myshopify.io';
export const BASE64_HOST = Buffer.from(TEST_SHOP).toString('base64');
export const TEST_WEBHOOK_ID = '1234567890';

let currentCall: number;
beforeEach(() => {
  testConfig = {
    auth: {
      path: '/auth',
      callbackPath: '/auth/callback',
    },
    webhooks: {
      path: '/webhooks',
    },
    sessionStorage: new MemorySessionStorage(),
    api: {
      apiKey: 'testApiKey',
      apiSecretKey: 'testApiSecretKey',
      scopes: ['testScope'],
      apiVersion: LATEST_API_VERSION,
      hostName: 'my-test-app.myshopify.io',
      logger: {
        log: jest.fn(),
      },
    },
  };

  shopify = shopifyApp(testConfig);

  currentCall = 0;
});

export type MockBody =
  | string
  | {
      [key: string]: any;
    };

interface AssertHttpRequestParams {
  method: string;
  url: string | URL;
  body?: MockBody;
  headers?: (string | [string, string])[];
}

export function mockShopifyResponse(body: MockBody, init?: MockParams) {
  fetchMock.mockResponse(
    typeof body === 'string' ? body : JSON.stringify(body),
    init,
  );
}

export function mockShopifyResponses(
  ...responses: ([MockBody] | [MockBody, MockParams])[]
) {
  const parsedResponses: [string, MockParams][] = responses.map(
    ([body, init]) => {
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

      return init ? [bodyString, init] : [bodyString, {}];
    },
  );

  fetchMock.mockResponses(...parsedResponses);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchMadeHttpRequest(): R;
      toBeWithinDeprecationSchedule(): R;
    }
  }
}

expect.extend({
  toMatchMadeHttpRequest({
    method,
    url,
    headers = expect.arrayContaining([]),
    body = expect.objectContaining({}),
  }: AssertHttpRequestParams) {
    const index = currentCall++;

    if (!fetchMock.mock.calls[index]) {
      return {
        pass: false,
        message: () => `Expected a request to be made but none were`,
      };
    }

    const expectedUrl = typeof url === 'string' ? new URL(url) : url;

    const mockCall = fetchMock.mock.calls[index];
    const requestUrl = new URL(mockCall[0] as string);

    const mockBody = mockCall[1]!.body;

    if (body) {
      if (
        typeof body === 'string' ||
        body.constructor.name === 'StringContaining'
      ) {
        expect(mockBody).toEqual(body);
      } else {
        let requestBody = mockBody;
        if (typeof mockBody === 'string') {
          try {
            requestBody = JSON.parse(mockBody);
          } catch (error) {
            // Not JSON, that's fine
          }
        }

        if (typeof requestBody === 'string') {
          expect(requestBody).toEqual(body);
        } else {
          expect(requestBody).toMatchObject(body);
        }
      }
    } else {
      expect(mockBody).toBeFalsy();
    }

    expect(requestUrl).toEqual(expectedUrl);
    expect(mockCall[1]).toMatchObject({method, headers});

    return {
      message: () => `The expected HTTP requests have been seen`,
      pass: true,
    };
  },
  toBeWithinDeprecationSchedule(version: string) {
    return {
      message: () =>
        `Found deprecation limited to version ${version}, please update or remove it.`,
      pass: semver.lt(SHOPIFY_EXPRESS_LIBRARY_VERSION, version),
    };
  },
});

export function validWebhookHeaders(
  topic: string,
  body: string,
  secretKey: string,
): {[key: string]: string} {
  const hmac = createTestHmac(secretKey, body);

  return {
    'X-Shopify-Topic': topic,
    'X-Shopify-Shop-Domain': TEST_SHOP,
    'X-Shopify-Hmac-Sha256': hmac,
    'X-Shopify-Webhook-Id': TEST_WEBHOOK_ID,
    'X-Shopify-Api-Version': LATEST_API_VERSION,
  };
}

export function createTestHmac(
  secretKey: string,
  body: string,
  digest = 'base64',
): string {
  return crypto
    .createHmac('sha256', secretKey)
    .update(body, 'utf8')
    .digest(digest as BinaryToTextEncoding);
}

export function queryArgs(query: {[key: string]: string}): string {
  if (!('timestamp' in query)) {
    query.timestamp = Math.floor(Date.now() / 1000).toString();
  }

  const args = new URLSearchParams();

  Object.keys(query)
    .sort((val1, val2) => val1.localeCompare(val2))
    .forEach((key) => args.append(key, query[key]));

  args.append(
    'hmac',
    createTestHmac(shopify.api.config.apiSecretKey, args.toString(), 'hex'),
  );

  return args.toString();
}

test('passes test deprecation checks', () => {
  expect('9999.0.0').toBeWithinDeprecationSchedule();
  expect(() => expect('0.0.0').toBeWithinDeprecationSchedule()).toThrow();
  expect(() =>
    expect(SHOPIFY_EXPRESS_LIBRARY_VERSION).toBeWithinDeprecationSchedule(),
  ).toThrow();
});
