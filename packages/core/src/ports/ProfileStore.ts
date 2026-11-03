import type { Profile } from "../profile/types"

export interface ProfileStore {
  load(): Promise<Profile | undefined>
  save(profile: Profile): Promise<void>
}
