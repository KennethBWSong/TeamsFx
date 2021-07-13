// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { TokenCredential } from "@azure/core-http";
import { TokenCredentialsBase } from "@azure/ms-rest-nodeauth";
import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";
import * as identity from "@azure/identity";
import { SubscriptionClient } from "@azure/arm-subscriptions";
import * as fs from "fs-extra";
import * as path from "path";

import { AzureAccountProvider, ConfigFolderName, err, FxError, ok, Result, SubscriptionInfo } from "@microsoft/teamsfx-api";

import { NotSupportedProjectType, NotFoundSubscriptionId } from "../error";
import { login, LoginStatus } from "./common/login";
import { signedOut } from "./common/constant";

const clientId = process.env.E2E_CLIENT_ID ?? "";
const secret = process.env.E2E_SECRET ?? "";
const tenantId = process.env.E2E_TENANT_ID ?? "";

/**
 * Prepare for service princle login, not fully implemented
 */
export class AzureAccountManager extends login implements AzureAccountProvider {
  static tokenCredentialsBase: TokenCredentialsBase;

  static tokenCredential: TokenCredential;

  static subscriptionId: string;

  private static instance: AzureAccountManager;

  /**
   * Gets instance
   * @returns instance
   */
  public static getInstance(): AzureAccountManager {
    if (!AzureAccountManager.instance) {
      AzureAccountManager.instance = new AzureAccountManager();
    }

    return AzureAccountManager.instance;
  }

  async getAccountCredentialAsync(): Promise<TokenCredentialsBase | undefined> {
    if (AzureAccountManager.tokenCredentialsBase == undefined) {
      const authres = await msRestNodeAuth.loginWithServicePrincipalSecretWithAuthResponse(
        clientId,
        secret,
        tenantId
      );
      AzureAccountManager.tokenCredentialsBase = authres.credentials;
    }

    return new Promise((resolve) => {
      resolve(AzureAccountManager.tokenCredentialsBase);
    });
  }

  async getIdentityCredentialAsync(): Promise<TokenCredential | undefined> {
    if (AzureAccountManager.tokenCredential == undefined) {
      const identityCredential = new identity.ClientSecretCredential(tenantId, clientId, secret);
      const credentialChain = new identity.ChainedTokenCredential(identityCredential);
      AzureAccountManager.tokenCredential = credentialChain;
    }

    return new Promise((resolve) => {
      resolve(AzureAccountManager.tokenCredential);
    });
  }

  /**
   * singnout from Azure
   */
  async signout(): Promise<boolean> {
    // await vscode.commands.executeCommand("azure-account.logout");
    // if (AzureAccountManager.statusChange !== undefined) {
    //   await AzureAccountManager.statusChange("SignedOut", undefined, undefined);
    // }
    return new Promise((resolve) => {
      resolve(true);
    });
  }

  async getSubscriptionList(azureToken: TokenCredentialsBase): Promise<AzureSubscription[]> {
    const client = new SubscriptionClient(azureToken);
    const subscriptions = await listAll(client.subscriptions, client.subscriptions.list());
    const subs: Partial<AzureSubscription>[] = subscriptions.map((sub) => {
      return { displayName: sub.displayName, subscriptionId: sub.subscriptionId };
    });
    const filteredSubs = subs.filter(
      (sub) => sub.displayName !== undefined && sub.subscriptionId !== undefined
    );
    return filteredSubs.map((sub) => {
      return { displayName: sub.displayName!, subscriptionId: sub.subscriptionId! };
    });
  }

  public async setSubscriptionId(
    subscriptionId: string,
    root_folder = "./"
  ): Promise<Result<null, FxError>> {
    const token = await this.getAccountCredentialAsync();
    const subscriptions = await this.getSubscriptionList(token!);

    if (subscriptions.findIndex((sub) => sub.subscriptionId === subscriptionId) < 0) {
      return err(NotFoundSubscriptionId());
    }
    AzureAccountManager.subscriptionId = subscriptionId;

    /// TODO: use api's constant
    const configPath = path.resolve(root_folder, `.${ConfigFolderName}/env.default.json`);
    if (!(await fs.pathExists(configPath))) {
      return err(NotSupportedProjectType());
    }
    const configJson = await fs.readJson(configPath);
    configJson["solution"].subscriptionId = subscriptionId;
    await fs.writeFile(configPath, JSON.stringify(configJson, null, 4));

    return ok(null);
  }

  async getStatus(): Promise<LoginStatus> {
    throw new Error("Method not implemented.");
  }

  getJsonObject(showDialog?: boolean): Promise<Record<string, unknown> | undefined> {
    throw new Error("Method not implemented.");
  }
  listSubscriptions(): Promise<SubscriptionInfo[]> {
    throw new Error("Method not implemented.");
  }
  setSubscription(subscriptionId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getAccountInfo(): Record<string, string> | undefined {
    throw new Error("Method not implemented.");
  }

  getSelectedSubscription(): SubscriptionInfo | undefined {
    throw new Error("Method not implemented.");
  }

  selectSubscription(subscriptionId?: string): Promise<string | undefined> {
    throw new Error("Method not implemented.");
  }
}

interface PartialList<T> extends Array<T> {
  nextLink?: string;
}

// Copied from https://github.com/microsoft/vscode-azure-account/blob/2b3c1a8e81e237580465cc9a1f4da5caa34644a6/sample/src/extension.ts
// to list all subscriptions
async function listAll<T>(
  client: { listNext(nextPageLink: string): Promise<PartialList<T>> },
  first: Promise<PartialList<T>>
): Promise<T[]> {
  const all: T[] = [];
  for (
    let list = await first;
    list.length || list.nextLink;
    list = list.nextLink ? await client.listNext(list.nextLink) : []
  ) {
    all.push(...list);
  }
  return all;
}

export type AzureSubscription = {
  displayName: string;
  subscriptionId: string;
};

export default AzureAccountManager.getInstance();
