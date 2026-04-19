import {
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";

import {
  createControlCombinedSurface,
  type ControlCombinedSurface
} from "./combined-surface.js";

export interface ControlRuntimeSurface<
  TMode extends "combined" | "split"
> {
  readonly mode: TMode;
  readonly context: ControlProcessContext;
  readonly requestHandler: ControlCombinedSurface["requestHandler"];
  close(): Promise<void>;
}

export interface CombinedControlRuntimeSurface
  extends ControlRuntimeSurface<"combined"> {
  readonly surface: ControlCombinedSurface;
}

export async function createCombinedControlRuntimeSurface(
  context: ControlProcessContext = createControlProcessContext()
): Promise<CombinedControlRuntimeSurface> {
  const surface = await createControlCombinedSurface(context);

  return {
    mode: "combined",
    context,
    surface,
    requestHandler: surface.requestHandler,
    close: surface.close
  };
}
