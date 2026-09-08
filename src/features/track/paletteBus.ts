/* One event name, so the top bar can open the command palette without the
   shell knowing anything about the control tower's state.

   The alternative — lifting palette state into a shared store — buys nothing
   here: it is a single boolean owned by one screen. */

export const OPEN_PALETTE = "ct:open-palette";

export function openPalette(): void {
  window.dispatchEvent(new CustomEvent(OPEN_PALETTE));
}
