export interface SiteAdapter {
  name: string
  matches(url: URL): boolean
}
