// Describes where a content script remembers how far its Next-button flow has got, so a page reload does not end the flow.
import type { FlowState } from "../messaging"

export interface FlowStatePort {
  save(state: FlowState): Promise<void>
  load(): Promise<FlowState | undefined>
  clear(): Promise<void>
}
