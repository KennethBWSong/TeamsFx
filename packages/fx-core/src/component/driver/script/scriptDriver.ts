/**
 * @author huajiezhang <huajiezhang@microsoft.com>
 */
import { err, FxError, ok, Result } from "@microsoft/teamsfx-api";
import { Service } from "typedi";
import { DriverContext } from "../interface/commonArgs";
import { ExecutionResult, StepDriver } from "../interface/stepDriver";
import { hooks } from "@feathersjs/hooks";
import { addStartAndEndTelemetry } from "../middleware/addStartAndEndTelemetry";
import { TelemetryConstant } from "../../constant/commonConstant";
import { executeCommand, maskSecretValues } from "../../code/utils";
import { ProgressMessages } from "../../messages";

const ACTION_NAME = "script";

interface ScriptDriverArgs {
  run: string;
  workingDirectory?: string;
  shell?: string;
  timeout?: number;
  redirectTo?: string;
}

@Service(ACTION_NAME)
export class ScriptDriver implements StepDriver {
  @hooks([addStartAndEndTelemetry(ACTION_NAME, TelemetryConstant.SCRIPT_COMPONENT)])
  async run(args: unknown, context: DriverContext): Promise<Result<Map<string, string>, FxError>> {
    const typedArgs = args as ScriptDriverArgs;
    await context.progressBar?.next(
      ProgressMessages.runCommand(typedArgs.run, typedArgs.workingDirectory ?? "./")
    );
    const res = await executeCommand(
      typedArgs.run,
      context.projectPath,
      context.logProvider,
      context.ui,
      typedArgs.workingDirectory,
      undefined,
      typedArgs.shell,
      typedArgs.timeout,
      typedArgs.redirectTo
    );
    if (res.isErr()) return err(res.error);
    const outputs = res.value[1];
    const kvArray: [string, string][] = Object.keys(outputs).map((k) => [k, outputs[k]]);
    return ok(new Map(kvArray));
  }

  @hooks([addStartAndEndTelemetry(ACTION_NAME, TelemetryConstant.SCRIPT_COMPONENT)])
  async execute(args: unknown, ctx: DriverContext): Promise<ExecutionResult> {
    const res = await this.run(args, ctx);
    const summaries: string[] = res.isOk()
      ? [`Successfully executed command ${maskSecretValues((args as any).run)}`]
      : [];
    return { result: res, summaries: summaries };
  }
}

export const scriptDriver = new ScriptDriver();
