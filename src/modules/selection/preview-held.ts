// While an unfinished edit is previewed on the page, the page shows the edit, not
// what the edit starts from. Reading it then would turn "8 → 12" into "12 → 12",
// which looks like no change at all, and the edit would be lost. So the panel keeps
// what it read before, for as long as a preview is held. One panel, one preview.
let held = false;

export function previewHeld(): boolean {
  return held;
}

export function holdPreview(showing: boolean): void {
  held = showing;
}
