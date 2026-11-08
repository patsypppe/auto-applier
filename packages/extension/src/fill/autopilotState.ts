// Describes where a content script remembers how far its apply-by-link run has got.
import type { AutopilotState } from "../messaging"

export interface AutopilotPort {
  load(): Promise<AutopilotState | undefined>
  save(state: AutopilotState): Promise<void>
  clear(): Promise<void>
}
