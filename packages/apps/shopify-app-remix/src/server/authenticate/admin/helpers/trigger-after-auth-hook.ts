import {Session, ShopifyRestResources} from '@shopify/shopify-api';

import type {BasicParams} from '../../../types';
import {AuthorizationStrategy} from '../strategies/types';

import {createAdminApiContext} from './create-admin-api-context';
import { redirectFactory } from './redirect';
import { redirect as remixRedirect } from '@remix-run/server-runtime';

export async function triggerAfterAuthHook<
  Resources extends ShopifyRestResources = ShopifyRestResources,
>(
  params: BasicParams,
  session: Session,
  request: Request,
  authStrategy: AuthorizationStrategy,
) {
  const {config, logger} = params;
  if (config.hooks.afterAuth) {
    logger.info('Running afterAuth hook');
    await config.hooks.afterAuth({
      session,
      admin: createAdminApiContext<Resources>(
        session,
        params,
        authStrategy.handleClientError(request),
      ),
      redirect: config.isEmbeddedApp ? redirectFactory(params, request) : remixRedirect,
    });
  }
}