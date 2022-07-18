import {Session} from '../session';
import {SessionInterface} from '../types';
import {SessionStorage} from '../session_storage';
import * as ShopifyErrors from '../../../error';

export class CustomSessionStorage implements SessionStorage {
  constructor(
    readonly storeSessionCallback: (
      session: SessionInterface,
    ) => Promise<boolean>,
    readonly loadSessionCallback: (
      id: string,
    ) => Promise<SessionInterface | {[key: string]: unknown} | undefined>,
    readonly deleteSessionCallback: (id: string) => Promise<boolean>,
    readonly deleteSessionsCallback?: (ids: string[]) => Promise<boolean>,
    readonly findSessionsByShopCallback?: (
      shop: string,
    ) => Promise<SessionInterface[] | {[key: string]: unknown}[]>,
  ) {
    this.storeSessionCallback = storeSessionCallback;
    this.loadSessionCallback = loadSessionCallback;
    this.deleteSessionCallback = deleteSessionCallback;
    this.deleteSessionsCallback = deleteSessionsCallback;
    this.findSessionsByShopCallback = findSessionsByShopCallback;
  }

  public async storeSession(session: SessionInterface): Promise<boolean> {
    try {
      return await this.storeSessionCallback(session);
    } catch (error) {
      throw new ShopifyErrors.SessionStorageError(
        `CustomSessionStorage failed to store a session. Error Details: ${error}`,
      );
    }
  }

  public async loadSession(id: string): Promise<SessionInterface | undefined> {
    let result: SessionInterface | {[key: string]: unknown} | undefined;
    try {
      result = await this.loadSessionCallback(id);
    } catch (error) {
      throw new ShopifyErrors.SessionStorageError(
        `CustomSessionStorage failed to load a session. Error Details: ${error}`,
      );
    }
    if (result) {
      if (result instanceof Session) {
        if (result.expires && typeof result.expires === 'string') {
          result.expires = new Date(result.expires);
        }

        return result as SessionInterface;
      } else if (result instanceof Object && 'id' in result) {
        let session = new Session(
          result.id as string,
          result.shop as string,
          result.state as string,
          result.isOnline as boolean,
        );
        session = {...session, ...(result as SessionInterface)};

        if (session.expires && typeof session.expires === 'string') {
          session.expires = new Date(session.expires);
        }

        return session as SessionInterface;
      } else {
        throw new ShopifyErrors.SessionStorageError(
          `Expected return to be instanceof Session, but received instanceof ${
            result!.constructor.name
          }.`,
        );
      }
    } else {
      return undefined;
    }
  }

  public async deleteSession(id: string): Promise<boolean> {
    try {
      return await this.deleteSessionCallback(id);
    } catch (error) {
      throw new ShopifyErrors.SessionStorageError(
        `CustomSessionStorage failed to delete a session. Error Details: ${error}`,
      );
    }
  }

  public async deleteSessions(ids: string[]): Promise<boolean> {
    if (this.deleteSessionsCallback) {
      try {
        return await this.deleteSessionsCallback(ids);
      } catch (error) {
        throw new ShopifyErrors.SessionStorageError(
          `CustomSessionStorage failed to delete array of sessions. Error Details: ${error}`,
        );
      }
    } else {
      console.warn(
        `CustomSessionStorage failed to delete array of sessions. Error Details: deleteSessionsCallback not defined.`,
      );
    }
    return false;
  }

  public async findSessionsByShop(
    shop: string,
  ): Promise<SessionInterface[] | {[key: string]: unknown}[]> {
    const sessions: SessionInterface[] = [];

    if (this.findSessionsByShopCallback) {
      let results: SessionInterface[] | {[key: string]: unknown}[] = [];

      try {
        results = await this.findSessionsByShopCallback(shop);
      } catch (error) {
        throw new ShopifyErrors.SessionStorageError(
          `CustomSessionStorage failed to find sessions by shop. Error Details: ${error}`,
        );
      }

      if (results && results instanceof Array) {
        // loop through array and convert to SessionInterface
        results.forEach((element) => {
          sessions.push(element as SessionInterface);
        });
      }
    } else {
      console.warn(
        `CustomSessionStorage failed to find sessions by shop. Error Details: findSessionsByShopCallback not defined.`,
      );
    }
    return sessions;
  }
}
