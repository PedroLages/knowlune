/** Yield to the UI thread between heavy operations */
export function yieldToUI(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}
