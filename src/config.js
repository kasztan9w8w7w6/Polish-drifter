// What the game runs. The MVP story "W nocy robota" (docs/wdrozenie-fabuly.md) replaces the prototype's systems; they
// are switched off here, not deleted – `?stare` in the address brings the old prototype back (missions 1–3, respect,
// the shop, 5G masts, the race, pushing / towing, the narrator, cash for drifting).
const stare = new URLSearchParams(globalThis.location?.search ?? '').has('stare');

export const features = {
  fabula: !stare,
  narrator: stare, // projekt §5: no narrator, only technical text
  szacun: stare,
  sklep: stare, // the shop / energy drink / save pad at Żappka
  maszty5g: stare,
  wyscig: stare,
  pchanie: stare, // empty tank: push / call a mate
  stareMisje: stare,
  starePostacie: stare,
  kasaZaDrift: stare, // plan §4: drifting for cash comes back after the MVP (bets are the MVP's drift for money)
};
