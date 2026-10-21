import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const mounted: Array<{ root: Root; container: HTMLDivElement }> = []
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export function render(element: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ root, container })
  act(() => root.render(element))
}
export function cleanup() {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
}
export { act }
