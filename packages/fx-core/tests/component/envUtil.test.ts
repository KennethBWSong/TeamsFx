import { hooks } from "@feathersjs/hooks/lib";
import {
  err,
  FxError,
  Inputs,
  ok,
  Platform,
  Result,
  Settings,
  UserCancelError,
  UserError,
} from "@microsoft/teamsfx-api";
import { assert } from "chai";
import fs from "fs-extra";
import "mocha";
import * as sinon from "sinon";
import { DotenvOutput, dotenvUtil, envUtil } from "../../src/component/utils/envUtil";
import { settingsUtil } from "../../src/component/utils/settingsUtil";
import { LocalCrypto } from "../../src/core/crypto";
import { EnvLoaderMW, EnvWriterMW } from "../../src/component/middleware/envMW";
import { ContextInjectorMW } from "../../src/core/middleware/contextInjector";
import { CoreHookContext } from "../../src/core/types";
import { MockTools } from "../core/utils";
import { globalVars, setTools } from "../../src/core/globalVars";
import { environmentManager } from "../../src/core/environment";
import mockedEnv, { RestoreFn } from "mocked-env";
import { FxCore } from "../../src/core/FxCore";
import { pathUtils, YmlFileNameOld } from "../../src/component/utils/pathUtils";
import * as path from "path";
import { yamlParser } from "../../src/component/configManager/parser";
import { ProjectModel } from "../../src/component/configManager/interface";
import { MetadataV3 } from "../../src/common/versionMetadata";
import {
  FileNotFoundError,
  MissingEnvironmentVariablesError,
  MissingRequiredFileError,
} from "../../src/error/common";

describe("env utils", () => {
  const tools = new MockTools();
  setTools(tools);
  const sandbox = sinon.createSandbox();
  const cryptoProvider = new LocalCrypto("mockProjectId");
  const decrypted = "123";
  const mockSettings: Settings = {
    trackingId: "mockProjectId",
    version: "1",
  };
  let mockedEnvRestore: RestoreFn | undefined;
  afterEach(() => {
    sandbox.restore();
  });

  it("pathUtils.getYmlFilePath", async () => {
    sandbox.stub(fs, "pathExistsSync").returns(true);
    process.env.TEAMSFX_ENV = "dev";
    const res1 = pathUtils.getYmlFilePath(".", "dev");
    assert.equal(res1, path.join(".", MetadataV3.configFile));
  });
  it("pathUtils.getYmlFilePath throw MissingRequiredFileError with env=dev", async () => {
    sandbox.stub(fs, "pathExistsSync").returns(false);
    process.env.TEAMSFX_ENV = "dev";
    try {
      await pathUtils.getYmlFilePath(".", "dev");
      assert.fail("show not reach here");
    } catch (e) {
      assert.isTrue(e instanceof MissingRequiredFileError);
    }
  });
  it("pathUtils.getYmlFilePath throw MissingRequiredFileError with env=local", async () => {
    sandbox.stub(fs, "pathExistsSync").returns(false);
    process.env.TEAMSFX_ENV = "local";
    try {
      await pathUtils.getYmlFilePath(".", "local");
      assert.fail("show not reach here");
    } catch (e) {
      assert.isTrue(e instanceof MissingRequiredFileError);
    }
  });
  it("pathUtils.getEnvFolderPath", async () => {
    const mockProjectModel: ProjectModel = {
      environmentFolderPath: "/home/envs",
    };
    sandbox.stub(yamlParser, "parse").resolves(ok(mockProjectModel));
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox.stub(pathUtils, "getYmlFilePath").resolves("./xxx");
    const res = await pathUtils.getEnvFolderPath(".");
    assert.isTrue(res.isOk());
    if (res.isOk()) {
      assert.equal(res.value, "/home/envs");
    }
  });
  it("pathUtils.getEnvFolderPath returns default value", async () => {
    const mockProjectModel: ProjectModel = {};
    sandbox.stub(pathUtils, "getYmlFilePath").resolves("./teamsapp.yml");
    sandbox.stub(yamlParser, "parse").resolves(ok(mockProjectModel));
    sandbox.stub(fs, "pathExists").resolves(true);
    const res = await pathUtils.getEnvFolderPath("");
    assert.isTrue(res.isOk());
    if (res.isOk()) {
      assert.equal(res.value, path.join("", "./env"));
    }
  });
  it("pathUtils.getEnvFolderPath returns undefined value", async () => {
    const mockProjectModel: ProjectModel = {};
    sandbox.stub(pathUtils, "getYmlFilePath").resolves("./teamsapp.yml");
    sandbox.stub(yamlParser, "parse").resolves(ok(mockProjectModel));
    sandbox.stub(fs, "pathExists").resolves(false);
    const res = await pathUtils.getEnvFolderPath("");
    assert.isTrue(res.isOk());
    if (res.isOk()) {
      assert.isUndefined(res.value);
    }
  });
  it("pathUtils.getEnvFilePath", async () => {
    const mockProjectModel: ProjectModel = {
      environmentFolderPath: "/home/envs",
    };
    sandbox.stub(pathUtils, "getYmlFilePath").resolves("./xxx");
    sandbox.stub(yamlParser, "parse").resolves(ok(mockProjectModel));
    sandbox.stub(fs, "pathExists").resolves(true);
    const res = await pathUtils.getEnvFilePath(".", "dev");
    assert.isTrue(res.isOk());
    if (res.isOk()) {
      assert.equal(res.value, path.join("/home/envs", ".env.dev"));
    }
  });
  it("pathUtils.getEnvFilePath returns default value", async () => {
    const mockProjectModel: ProjectModel = {};
    sandbox.stub(yamlParser, "parse").resolves(ok(mockProjectModel));
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox.stub(pathUtils, "getYmlFilePath").resolves("./xxx");
    const res = await pathUtils.getEnvFilePath(".", "dev");
    assert.isTrue(res.isOk());
    if (res.isOk()) {
      assert.equal(res.value, path.join("./env", ".env.dev"));
    }
  });
  it("envUtil.readEnv", async () => {
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok("."));
    const encRes = await cryptoProvider.encrypt(decrypted);
    if (encRes.isErr()) throw encRes.error;
    const encrypted = encRes.value;
    sandbox
      .stub(fs, "readFile")
      .onFirstCall()
      .resolves("TEAMSFX_ENV=env\nTEAMS_APP_ID=testappid\nTAB_ENDPOINT=testendpoint" as any)
      .onSecondCall()
      .resolves(("SECRET_ABC=" + encrypted) as any);
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    const res = await envUtil.readEnv(".", "dev");
    assert.isTrue(res.isOk());
    assert.equal(process.env.SECRET_ABC, decrypted);
  });
  it("envUtil.readEnv silent", async () => {
    sandbox.stub(fs, "pathExists").resolves(false);
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok("."));
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    const res = await envUtil.readEnv(".", "dev", false, true);
    assert.isTrue(res.isOk());
    if (res.isOk()) {
      assert.deepEqual(res.value, { TEAMSFX_ENV: "dev" });
    }
  });
  it("envUtil.readEnv not silent 1", async () => {
    sandbox.stub(fs, "pathExists").resolves(false);
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok("."));
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    const res = await envUtil.readEnv(".", "dev", false, false);
    assert.isTrue(res.isErr());
    if (res.isErr()) {
      assert.isTrue(res.error instanceof FileNotFoundError);
    }
  });
  it("envUtil.readEnv not silent 2", async () => {
    sandbox.stub(fs, "pathExists").resolves(false);
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok(""));
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    const res = await envUtil.readEnv(".", "dev", false, false);
    assert.isTrue(res.isErr());
    if (res.isErr()) {
      assert.isTrue(res.error instanceof FileNotFoundError);
    }
  });
  it("MissingEnvironmentVariablesError", async () => {
    new MissingEnvironmentVariablesError("test", "ABC", "./abc.yml");
    globalVars.ymlFilePath = "./abc.yml";
    new MissingEnvironmentVariablesError("test", "ABC");
    globalVars.ymlFilePath = "";
    new MissingEnvironmentVariablesError("test", "ABC");
  });
  it("envUtil.readEnv - loadToProcessEnv false", async () => {
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok(".env.dev"));
    const encRes = await cryptoProvider.encrypt(decrypted);
    if (encRes.isErr()) throw encRes.error;
    const encrypted = encRes.value;
    sandbox.stub(fs, "readFile").resolves(("SECRET_ABC=" + encrypted) as any);
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    const res = await envUtil.readEnv(".", "dev", false);
    assert.isTrue(res.isOk());
    assert.equal(process.env.SECRET_ABC, decrypted);
  });

  it("envUtil.readEnv fail: read settings.json fail", async () => {
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok(".env.dev"));
    sandbox.stub(fs, "readFile").resolves("SECRET_ABC=AAA" as any);
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox
      .stub(settingsUtil, "readSettings")
      .resolves(err(new UserError({ source: "test", name: "TestError", message: "message" })));
    const res = await envUtil.readEnv(".", "dev");
    assert.isTrue(res.isErr());
  });
  it("envUtil.writeEnv", async () => {
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok(".env.dev"));
    let value = "";
    sandbox.stub(fs, "writeFile").callsFake(async (file: fs.PathLike | number, data: any) => {
      value = data as string;
      return Promise.resolve();
    });
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    const res = await envUtil.writeEnv(".", "dev", { SECRET_ABC: decrypted });
    assert.isTrue(res.isOk());
    assert.isDefined(value);
    value = value!.substring("SECRET_ABC=".length);
    const decRes = await cryptoProvider.decrypt(value);
    if (decRes.isErr()) throw decRes.error;
    assert.isTrue(decRes.isOk());
    assert.equal(decRes.value, decrypted);
  });
  it("envUtil.writeEnv no variables", async () => {
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok(".env.dev"));
    sandbox.stub(fs, "readFile").resolves("" as any);
    sandbox.stub(fs, "writeFile").resolves();
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    const res = await envUtil.writeEnv(".", "dev", {});
    assert.isTrue(res.isOk());
  });
  it("envUtil.writeEnv to default path", async () => {
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok(undefined));
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    sandbox.stub(fs, "writeFile").resolves();
    const res = await envUtil.writeEnv(".", "dev", {
      SECRET_ABC: decrypted,
      TEAMS_APP_UPDATE_TIME: "xx-xx-xx",
    });
    assert.isTrue(res.isOk());
  });
  it("envUtil.writeEnv failed", async () => {
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok(".env.dev"));
    sandbox
      .stub(settingsUtil, "readSettings")
      .resolves(err(new UserError({ source: "test", name: "TestError", message: "message" })));
    const res = await envUtil.writeEnv(".", "dev", { SECRET_ABC: decrypted });
    assert.isTrue(res.isErr());
  });

  it("envUtil.listEnv", async () => {
    sandbox.stub(pathUtils, "getEnvFolderPath").resolves(ok("teamsfx"));
    sandbox.stub(fs, "readdir").resolves([".env.dev", ".env.prod"] as any);
    const res = await envUtil.listEnv(".");
    assert.isTrue(res.isOk());
    if (res.isOk()) {
      assert.deepEqual(res.value, ["dev", "prod"]);
    }
  });

  it("envUtil.mergeEnv case 1", async () => {
    const env: DotenvOutput = {};
    mockedEnvRestore = mockedEnv({
      mykey: "myvalue",
    });
    envUtil.mergeEnv(process.env, env);
    assert.equal(process.env.mykey, "myvalue");
  });

  it("envUtil.mergeEnv case 2", async () => {
    const env: DotenvOutput = { mykey: "myvalue" };
    mockedEnvRestore = mockedEnv({
      mykey: "",
    });
    envUtil.mergeEnv(process.env, env);
    assert.equal(process.env.mykey, "myvalue");
  });

  it("envUtil.mergeEnv case 3", async () => {
    const env: DotenvOutput = { mykey: "myvalue2" };
    mockedEnvRestore = mockedEnv({
      mykey: "myvalue",
    });
    envUtil.mergeEnv(process.env, env);
    assert.equal(process.env.mykey, "myvalue");
  });

  it("envUtil.mergeEnv case 4", async () => {
    const env: DotenvOutput = { mykey: "" };
    mockedEnvRestore = mockedEnv({
      mykey: "myvalue",
    });
    envUtil.mergeEnv(process.env, env);
    assert.equal(process.env.mykey, "myvalue");
  });

  it("environmentManager.listAllEnvConfigs", async () => {
    sandbox.stub(pathUtils, "getEnvFolderPath").resolves(ok("teamsfx"));
    sandbox.stub(fs, "readdir").resolves([".env.dev", ".env.prod"] as any);
    const res = await environmentManager.listAllEnvConfigs(".");
    assert.isTrue(res.isOk());
    if (res.isOk()) {
      assert.deepEqual(res.value, ["dev", "prod"]);
    }
  });
  it("environmentManager.listRemoteEnvConfigs", async () => {
    sandbox.stub(pathUtils, "getEnvFolderPath").resolves(ok("teamsfx"));
    sandbox.stub(fs, "readdir").resolves([".env.dev", ".env.prod", ".env.local"] as any);
    const res = await environmentManager.listRemoteEnvConfigs(".");
    assert.isTrue(res.isOk());
    if (res.isOk()) {
      assert.deepEqual(res.value, ["dev", "prod"]);
    }
  });

  it("EnvLoaderMW success", async () => {
    sandbox.stub(pathUtils, "getEnvFolderPath").resolves(ok("teamsfx"));
    const encRes = await cryptoProvider.encrypt(decrypted);
    if (encRes.isErr()) throw encRes.error;
    const encrypted = encRes.value;
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox.stub(fs, "readFile").resolves(("SECRET_ABC=" + encrypted) as any);
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    if (process.env.SECRET_ABC || process.env.SECRET_ABC === undefined) {
      delete process.env.SECRET_ABC;
    }
    sandbox
      .stub(dotenvUtil, "deserialize")
      .onFirstCall()
      .returns({
        lines: [],
        obj: {},
      })
      .onSecondCall()
      .returns({
        lines: [],
        obj: { SECRET_ABC: encrypted },
      })
      .onThirdCall()
      .returns({
        lines: [],
        obj: {},
      });
    process.env.ENV_VAR = "1";
    class MyClass {
      async myMethod(inputs: Inputs): Promise<Result<any, FxError>> {
        assert.equal(process.env.SECRET_ABC, decrypted);
        process.env.ENV_VAR = "2";
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [EnvLoaderMW(true)],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
      env: "dev",
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isOk());
    assert.isUndefined(process.env.SECRET_ABC);
    assert.equal(process.env.ENV_VAR, "1", "process.env.ENV_VAR should be restored to 1");

    // const core = new FxCore(tools);
    // const getDotEnvRes = await core.getDotEnv(inputs);
    // assert.isTrue(getDotEnvRes.isOk());
  });

  it("EnvLoaderMW skip load", async () => {
    sandbox.stub(fs, "pathExists").resolves(true);
    class MyClass {
      async myMethod(inputs: Inputs): Promise<Result<any, FxError>> {
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [EnvLoaderMW(true, true)],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isOk());
  });

  it("EnvLoaderMW success for F5 (missing .env file)", async () => {
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(ok("."));
    sandbox.stub(fs, "pathExistsSync").returns(false);
    sandbox.stub(fs, "writeFile").resolves();
    sandbox.stub(envUtil, "readEnv").resolves(ok({}));
    class MyClass {
      async myMethod(inputs: Inputs): Promise<Result<any, FxError>> {
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [EnvLoaderMW(false)],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
      env: "dev",
      isLocalDebug: true,
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isOk());
    const core = new FxCore(tools);
    const getDotEnvRes = await core.getDotEnv(inputs);
    assert.isTrue(getDotEnvRes.isOk());
  });
  it("EnvLoaderMW failed for F5 (missing .env file and getEnvFilePath Error)", async () => {
    sandbox.stub(pathUtils, "getEnvFilePath").resolves(err(new UserError({})));
    class MyClass {
      async myMethod(inputs: Inputs): Promise<Result<any, FxError>> {
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [EnvLoaderMW(false)],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
      env: "dev",
      isLocalDebug: true,
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isErr());
  });
  it("EnvLoaderMW success: no env available, use dev", async () => {
    sandbox.stub(pathUtils, "getEnvFolderPath").resolves(ok("teamsfx"));
    sandbox.stub(envUtil, "listEnv").resolves(ok([]));
    sandbox.stub(envUtil, "readEnv").resolves(ok({}));
    class MyClass {
      async myMethod(inputs: Inputs): Promise<Result<any, FxError>> {
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [EnvLoaderMW(true)],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isOk());
  });
  it("EnvLoaderMW ignoreEnvInfo", async () => {
    sandbox.stub(pathUtils, "getEnvFolderPath").resolves(ok("teamsfx"));
    sandbox.stub(envUtil, "readEnv").resolves(ok({}));
    class MyClass {
      async myMethod(inputs: Inputs): Promise<Result<any, FxError>> {
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [EnvLoaderMW(true)],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
      ignoreEnvInfo: true,
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isOk());
    const core = new FxCore(tools);
    const getDotEnvRes = await core.getDotEnv(inputs);
    assert.isTrue(getDotEnvRes.isOk());
  });
  it("EnvLoaderMW fail without projectPath", async () => {
    class MyClass {
      async myMethod(inputs: Inputs): Promise<Result<any, FxError>> {
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [EnvLoaderMW(true)],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      env: "dev",
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isErr());
    if (res.isErr()) {
      assert.equal(res.error.name, "NoProjectOpenedError");
    }
  });
  it("EnvLoaderMW fail with listEnv Error", async () => {
    sandbox.stub(pathUtils, "getEnvFolderPath").resolves(ok("teamsfx"));
    sandbox
      .stub(envUtil, "listEnv")
      .resolves(err(new UserError({ source: "test", name: "TestError", message: "message" })));
    class MyClass {
      async myMethod(inputs: Inputs): Promise<Result<any, FxError>> {
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [EnvLoaderMW(true)],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isErr());
    if (res.isErr()) {
      assert.equal(res.error.name, "TestError");
    }
  });
  it("EnvLoaderMW fail with envUtil Error", async () => {
    const encRes = await cryptoProvider.encrypt(decrypted);
    if (encRes.isErr()) throw encRes.error;
    const encrypted = encRes.value;
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox.stub(fs, "readFile").resolves(("SECRET_ABC=" + encrypted) as any);
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    sandbox
      .stub(envUtil, "readEnv")
      .resolves(err(new UserError({ source: "test", name: "TestError", message: "message" })));
    class MyClass {
      async myMethod(inputs: Inputs): Promise<Result<any, FxError>> {
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [EnvLoaderMW(true)],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
      env: "dev",
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isErr());
  });
  it("EnvLoaderMW cancel", async () => {
    sandbox.stub(envUtil, "listEnv").resolves(ok(["dev", "prod"]));
    sandbox.stub(tools.ui, "selectOption").resolves(err(UserCancelError));
    class MyClass {
      async myMethod(inputs: Inputs): Promise<Result<any, FxError>> {
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [EnvLoaderMW(true)],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isErr());
  });
  it("EnvWriterMW success", async () => {
    sandbox.stub(pathUtils, "getEnvFolderPath").resolves(ok("teamsfx"));
    let value = "";
    sandbox.stub(fs, "writeFile").callsFake(async (file: fs.PathLike | number, data: any) => {
      value = data as string;
      return Promise.resolve();
    });
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    const envs = { SECRET_ABC: decrypted };
    class MyClass {
      async myMethod(inputs: Inputs, ctx?: CoreHookContext): Promise<Result<any, FxError>> {
        ctx!.envVars = envs;
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [ContextInjectorMW, EnvWriterMW],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
      env: "dev",
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isOk());
    assert.isDefined(value);
    value = value!.substring("SECRET_ABC=".length);
    const decRes = await cryptoProvider.decrypt(value);
    if (decRes.isErr()) throw decRes.error;
    assert.isTrue(decRes.isOk());
    assert.equal(decRes.value, decrypted);
  });

  it("EnvWriterMW fail with envUtil Error", async () => {
    sandbox
      .stub(envUtil, "writeEnv")
      .resolves(err(new UserError({ source: "test", name: "TestError", message: "message" })));
    sandbox.stub(settingsUtil, "readSettings").resolves(ok(mockSettings));
    const envs = { SECRET_ABC: decrypted };
    class MyClass {
      async myMethod(inputs: Inputs, ctx?: CoreHookContext): Promise<Result<any, FxError>> {
        ctx!.envVars = envs;
        return ok(undefined);
      }
    }
    hooks(MyClass, {
      myMethod: [ContextInjectorMW, EnvWriterMW],
    });
    const my = new MyClass();
    const inputs = {
      platform: Platform.VSCode,
      projectPath: ".",
      env: "dev",
    };
    const res = await my.myMethod(inputs);
    assert.isTrue(res.isErr());
  });

  it("dotenvUtil deserialize & serialize", async () => {
    const original =
      '#COMMENT\n\n\nKEY1=VALUE1#COMMENT2\nKEY2=\'VALUE2\'\nKEY3="VALUE3#"\nindexPath="/index.html#"#COMMENT3';
    const expected =
      '#COMMENT\n\n\nKEY1=VALUE1#COMMENT2\nKEY2=\'VALUE2\'\nKEY3="VALUE3#"\nindexPath="/index.html#"#COMMENT3\nKEY4="VALUE4"\nKEY5="VALUE5#"';
    const parsed = dotenvUtil.deserialize(original);
    console.log(parsed);
    assert.deepEqual(parsed, {
      lines: [
        "#COMMENT",
        "",
        "",
        { key: "KEY1", value: "VALUE1", comment: "#COMMENT2" },
        { key: "KEY2", value: "VALUE2", quote: "'" },
        { key: "KEY3", value: "VALUE3#", quote: '"' },
        { key: "indexPath", value: "/index.html#", quote: '"', comment: "#COMMENT3" },
      ],
      obj: { KEY1: "VALUE1", KEY2: "VALUE2", KEY3: "VALUE3#", indexPath: "/index.html#" },
    });
    parsed.lines?.push({ key: "KEY4", value: "VALUE4", quote: '"' });
    parsed.obj["KEY5"] = "VALUE5#";
    const serialized = dotenvUtil.serialize(parsed);
    assert.equal(serialized, expected);
  });
  it("dotenvUtil deserialize & serialize empty", async () => {
    const original = "";
    const parsed = dotenvUtil.deserialize(original);
    assert.deepEqual(parsed, {
      lines: [""],
      obj: {},
    });
    const serialized = dotenvUtil.serialize(parsed);
    assert.equal(serialized, original);
  });
  it("dotenvUtil serialize without lines", async () => {
    const parsed = {
      obj: { KEY: "VALUE", KEY2: "VALUE2" },
    };
    const str = dotenvUtil.serialize(parsed);
    assert.equal(str, "KEY=VALUE\nKEY2=VALUE2");
  });

  it("settingsUtil read not exist", async () => {
    sandbox.stub(pathUtils, "getYmlFilePath").resolves(ok("."));
    const res = await settingsUtil.readSettings("abc");
    assert.isTrue(res.isErr());
  });

  it("settingsUtil read and ensure trackingId", async () => {
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox.stub(pathUtils, "getYmlFilePath").resolves(ok("."));
    sandbox.stub<any, any>(fs, "readFile").callsFake(async (file: string) => {
      return "version: 1.0.0";
    });
    sandbox.stub(fs, "writeFile").resolves();
    const res = await settingsUtil.readSettings("abc");
    assert.isTrue(res.isOk());
    if (res.isOk()) {
      assert.isDefined(res.value.trackingId);
    }
  });

  it("settingsUtil write success", async () => {
    sandbox.stub(pathUtils, "getYmlFilePath").resolves(ok("."));
    sandbox.stub(fs, "writeFile").resolves();
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox.stub<any, any>(fs, "readFile").callsFake(async (file: string) => {
      return "version: 1.0.0";
    });
    const res = await settingsUtil.writeSettings(".", { trackingId: "123", version: "2" });
    assert.isTrue(res.isOk());
  });
  it("settingsUtil write failed", async () => {
    sandbox.stub(pathUtils, "getYmlFilePath").resolves(ok("."));
    sandbox.stub(fs, "pathExists").resolves(false);
    const res = await settingsUtil.writeSettings(".", { trackingId: "123", version: "2" });
    assert.isTrue(res.isErr());
    assert.isTrue(res._unsafeUnwrapErr() instanceof FileNotFoundError);
  });
});

describe("environmentManager.listRemoteEnvConfigs", () => {
  const tools = new MockTools();
  setTools(tools);
  const sandbox = sinon.createSandbox();
  let mockedEnvRestore: RestoreFn | undefined;
  afterEach(() => {
    sandbox.restore();
    if (mockedEnvRestore) {
      mockedEnvRestore();
    }
  });
  it("environmentManager.listRemoteEnvConfigs return error V3", async () => {
    mockedEnvRestore = mockedEnv({
      TEAMSFX_V3: "true",
    });
    sandbox.stub(fs, "readdir").resolves([] as any);
    sandbox.stub(pathUtils, "getYmlFilePath").resolves("./xxx");
    const res = await environmentManager.listRemoteEnvConfigs(".", true);
    assert.isTrue(res.isErr());
  });
  it("environmentManager.listRemoteEnvConfigs return error V2", async () => {
    mockedEnvRestore = mockedEnv({
      TEAMSFX_V3: "false",
    });
    sandbox.stub(fs, "readdir").resolves([] as any);
    const res = await environmentManager.listRemoteEnvConfigs(".", true);
    assert.isTrue(res.isErr());
  });
});
