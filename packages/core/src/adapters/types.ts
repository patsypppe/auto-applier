// Defines the contract every site-specific adapter must follow.
export interface SiteAdapter {
  name: string
  matches(url: URL): boolean
}
