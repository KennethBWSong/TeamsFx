// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { UserInteraction } from "../qm/ui";
import { Inputs, Json, ProjectSettings } from "../types";
import {
  CryptoProvider,
  LogProvider,
  TelemetryReporter,
  PermissionRequestProvider,
  ExpServiceProvider,
} from "../utils";
import { EnvInfo } from "../context";
import { FxError } from "../error";

export interface Context {
  userInteraction: UserInteraction;
  logProvider: LogProvider;
  telemetryReporter: TelemetryReporter;
  cryptoProvider: CryptoProvider;
  projectSetting: ProjectSettings;
  permissionRequestProvider?: PermissionRequestProvider;
  expServiceProvider?: ExpServiceProvider;
}

export interface LocalSettings extends Json {
  teamsApp: Record<string, string>;
  auth?: Record<string, string>;
  frontend?: Record<string, string>;
  backend?: Record<string, string>;
  bot?: Record<string, string>;
}

export type LocalSetting = { key: keyof LocalSettings; value: Record<string, string> };

export type InputsWithProjectPath = Inputs & { projectPath: string };

export class FxSuccess<T> {
  kind: "success";
  output: T;
  constructor(output: T) {
    this.kind = "success";
    this.output = output;
  }
}

export class FxPartialSuccess<T, Error = FxError> {
  kind: "partialSuccess";
  output: T;
  error: Error;
  constructor(output: T, error: Error) {
    this.kind = "partialSuccess";
    this.output = output;
    this.error = error;
  }
}

export class FxFailure<Error = FxError> {
  kind: "failure";
  error: Error;
  constructor(error: Error) {
    this.kind = "failure";
    this.error = error;
  }
}

export type FxResult<T, Error = FxError> =
  | FxSuccess<T>
  | FxPartialSuccess<T, Error>
  | FxFailure<Error>;

export type EnvInfoV2 = Omit<EnvInfo, "state" | "config"> & { state: Json } & { config: Json };

// This type has not been supported by TypeScript yet.
// Check here https://github.com/microsoft/TypeScript/issues/13923.
export type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};
