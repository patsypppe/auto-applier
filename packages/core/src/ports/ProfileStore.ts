// Defines how the core loads and saves a profile, without knowing where it is stored.
import type { Profile } from "../profile/types"

export interface ProfileStore {
  load(): Promise<Profile | undefined>
  save(profile: Profile): Promise<void>
}
