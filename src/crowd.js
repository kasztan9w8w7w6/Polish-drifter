// Onlookers reacting to the player's driving (logic only, tested in Node): the lads by the drift lot shout short lines
// in speech bubbles – "dawaj!" for a deep, fast drift held for a while, "słabo" for a timid one, something else for
// a crash or for standing about. The lines are in the characters' data (postacie.json → reakcje), this only decides
// WHEN and WHICH KIND. Every kind has its own pause, so they don't shout over each other.
export const crowdSettings = {
  goodAngle: 25, // ° held…
  goodSpeed: 9, // m/s…
  goodTime: 1.2, // …for this long = "dobrze"
  weakAngle: 18, // a drift that stays below this for weakTime = "słabo"
  weakTime: 1.8,
  idleTime: 7, // s in the zone with nothing happening = "czekanie"
  crash: 4, // m/s into something = "uderzenie"
  pause: 2.6, // s between two shouts
  pauseCalm: 6, // … outside a show (the lads just watch)
};

export function createCrowd(settings = crowdSettings) {
  const s = settings;
  let good = 0, weak = 0, idle = 0, wait = 0;
  // car: { inZone, drifting, angle (°), speed (m/s), crash (m/s) }, show: a mission wants them loud
  function update(dt, car, show = false) {
    wait -= dt;
    if (!car.inZone) {
      good = weak = idle = 0;
      return null;
    }
    const drift = car.drifting && car.speed > 4;
    good = drift && car.angle >= s.goodAngle && car.speed >= s.goodSpeed ? good + dt : 0;
    weak = drift && car.angle < s.weakAngle ? weak + dt : 0;
    idle = drift || car.speed > 6 ? 0 : idle + dt;
    let kind = null;
    if (car.crash >= s.crash) kind = 'uderzenie';
    else if (good >= s.goodTime) kind = 'dobrze';
    else if (weak >= s.weakTime) kind = 'slabo';
    else if (idle >= s.idleTime) kind = 'czekanie';
    if (!kind || (wait > 0 && kind !== 'uderzenie')) return null;
    wait = show ? s.pause : s.pauseCalm;
    if (kind === 'dobrze') good = -s.goodTime; // (the next "dawaj!" needs the drift held a bit longer)
    if (kind === 'slabo') weak = 0;
    if (kind === 'czekanie') idle = 0;
    return kind;
  }
  return { update };
}
