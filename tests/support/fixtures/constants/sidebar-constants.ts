export const SIDEBAR_STORAGE_KEY = 'knowlune-sidebar-v1'
export const SIDEBAR_CLOSED_STATE = 'false'

export function closeSidebar() {
  return { [SIDEBAR_STORAGE_KEY]: SIDEBAR_CLOSED_STATE }
}
