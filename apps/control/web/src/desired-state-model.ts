import { buildDesiredStateActionModel } from "./desired-state-model-actions.js";
import { buildDesiredStateActivityModel } from "./desired-state-model-activity.js";
import { buildDesiredStateSelectionModel } from "./desired-state-model-selectors.js";
import { buildDesiredStateTableModel } from "./desired-state-model-tables.js";
import {
  type BuildDesiredStateModelArgs,
  type DesiredStateModelCopy,
  type DesiredStateViewModel
} from "./desired-state-model-types.js";

export {
  type DesiredStateViewModel
} from "./desired-state-model-types.js";

export function buildDesiredStateModel<Copy extends DesiredStateModelCopy>(
  args: BuildDesiredStateModelArgs<Copy>
): DesiredStateViewModel {
  const selections = buildDesiredStateSelectionModel({
    data: args.data,
    defaultTabId: args.defaultTabId,
    focus: args.focus
  });
  const tables = buildDesiredStateTableModel({
    copy: args.copy,
    data: args.data,
    renderFocusLink: args.renderFocusLink,
    renderPill: args.renderPill,
    selections
  });
  const activity = buildDesiredStateActivityModel({
    data: args.data,
    findLatestJobWithStatus: args.findLatestJobWithStatus,
    findRelatedAuditEvents: args.findRelatedAuditEvents,
    findRelatedJobs: args.findRelatedJobs,
    selections
  });
  const actions = buildDesiredStateActionModel({
    activity,
    copy: args.copy,
    createComparisonDeltaItems: args.createComparisonDeltaItems,
    createComparisonRow: args.createComparisonRow,
    data: args.data,
    formatDnsRecordPreview: args.formatDnsRecordPreview,
    readBooleanPayloadValue: args.readBooleanPayloadValue,
    readObjectArrayPayloadValue: args.readObjectArrayPayloadValue,
    readStringArrayPayloadValue: args.readStringArrayPayloadValue,
    readStringPayloadValue: args.readStringPayloadValue,
    selections,
    summarizeComparisonRows: args.summarizeComparisonRows
  });

  return {
    ...selections,
    ...tables,
    ...activity,
    ...actions
  };
}
