// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * @author Siglud <Siglud@gmail.com>
 */
import { happyPathTest } from "./BotHappyPathCommon";
import { Runtime } from "../../commonlib/constants";
import { it } from "@microsoft/extra-shot-mocha";
import { isV3Enabled } from "@microsoft/teamsfx-core";

describe("Provision for Dotnet", () => {
  it(
    "Provision Resource: func hosted notification",
    { testPlanCaseId: 15685880 },
    async function () {
      await happyPathTest(Runtime.Dotnet, "notification", ["http-functions"]);
    }
  );
});
