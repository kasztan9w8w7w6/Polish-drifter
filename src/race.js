import { CatmullRomCurve3, Vector3 } from 'three';

// Race against a neighbour (logic only, tested in Node): a closed route from the map (`routes`: points along the
// streets, in driving order), smoothed with three.js CatmullRomCurve3 (centripetal, so corners don't overshoot).
// - Progress of both cars is distance along the route; laps are counted when the start/finish line is crossed.
//   The player's position is searched only near the last one, so cutting across a yard doesn't jump ahead.
// - The opponent is a follower on the route (no physics driving – it can't get stuck or teleport): its speed
//   comes from the curvature ahead (brakes before corners), accelerates / brakes at limited rates, and is gently
//   matched to the player (a bit faster when far behind, a bit slower when far ahead). When the player blocks the
//   way it moves over to the other side of the lane and doesn't drive through.
export const raceSettings = {
  top: 26, // m/s on a straight (≈ 94 km/h; the Polonez does ~108)
  lateral: 6.5, // m/s² in corners → corner speed = √(lateral / curvature)
  accel: 3.2, // m/s²
  brake: 7, // m/s²
  catchUp: 0.2, // up to +20 % when far behind…
  holdBack: 0.22, // …and up to −22 % when far ahead
  gapRange: 70, // m of gap for the full effect
  lane: 1.8, // m from the route line (drives on the right, moves over to overtake)
  offRoute: 30, // m from the route: the player's progress stops counting
};

// Route points from the map are the street corners (and a few in between); the curve needs them dense along the
// straights and each corner cut by two points `corner` m either side of it, or the spline bulges off the road.
export function densify(points, spacing = 8, corner = 7) {
  const out = [];
  const n = points.length;
  // how much to cut at point i: only at a real corner (a point on a straight, like the start line, stays put)
  const cutAt = (i) => {
    const [ax, az] = points[(i - 1 + n) % n], [bx, bz] = points[i], [cx, cz] = points[(i + 1) % n];
    const turn = Math.abs(Math.atan2((bx - ax) * (cz - bz) - (bz - az) * (cx - bx), (bx - ax) * (cx - bx) + (bz - az) * (cz - bz)));
    return turn > 0.2 ? corner : 0;
  };
  for (let i = 0; i < n; i++) {
    const [ax, az] = points[i], [bx, bz] = points[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az);
    const c0 = Math.min(cutAt(i), len / 3), c1 = Math.min(cutAt((i + 1) % n), len / 3);
    const steps = Math.max(1, Math.round((len - c0 - c1) / spacing));
    for (let k = 0; k < steps + (c1 > 0 ? 1 : 0); k++) {
      const u = (c0 + ((len - c0 - c1) * k) / steps) / len;
      out.push([ax + (bx - ax) * u, az + (bz - az) * u]);
    }
  }
  return out;
}

export function createRoute(corners, samples = 600) {
  const points = densify(corners);
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), true, 'centripetal');
  const length = curve.getLength();
  const pts = curve.getSpacedPoints(samples); // equal spacing: index ↔ distance
  const step = length / samples;
  // curvature at each sample (turn angle between neighbours / distance)
  const kappa = pts.map((_, i) => {
    const a = pts[(i - 1 + samples) % samples], b = pts[i], c = pts[(i + 1) % samples];
    const h1 = Math.atan2(b.z - a.z, b.x - a.x), h2 = Math.atan2(c.z - b.z, c.x - b.x);
    let d = h2 - h1;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    return Math.abs(d) / (2 * step);
  });
  const idx = (s) => ((Math.round(s / step) % samples) + samples) % samples;
  return {
    length,
    samples,
    step,
    // point and heading at distance s (any s: wraps round)
    at(s) {
      const u = (((s % length) + length) % length) / length;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      return { x: p.x, z: p.z, dx: t.x, dz: t.z };
    },
    kappa: (s) => kappa[idx(s)],
    // nearest distance along the route to (x, z), searching ±window m around `near` (or everywhere)
    project(x, z, near = null, window = 40) {
      let best = Infinity, bestS = 0;
      const n = near === null ? samples : Math.ceil(window / step);
      const i0 = near === null ? 0 : Math.round(near / step) - n;
      for (let k = 0; k <= (near === null ? samples - 1 : 2 * n); k++) {
        const i = i0 + k;
        const p = pts[((i % samples) + samples) % samples];
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < best) (best = d), (bestS = i * step);
      }
      return { s: bestS, dist: Math.sqrt(best) };
    },
  };
}

// Distance along the route (laps included) of a car driven by the player
export function createTracker(route, settings = raceSettings) {
  let total = null; // m since the start line, laps included (can be slightly negative on the grid)
  return {
    update(x, z) {
      if (total === null) {
        const p = route.project(x, z);
        total = p.s > route.length / 2 ? p.s - route.length : p.s; // on the grid, just behind the line
        return total;
      }
      const p = route.project(x, z, total);
      if (p.dist > settings.offRoute) return total; // off the route (a shortcut, the yard): no progress
      // unwrap to the lap nearest the last position
      const base = total - (((total % route.length) + route.length) % route.length);
      let s = base + p.s;
      if (s - total > route.length / 2) s -= route.length;
      if (total - s > route.length / 2) s += route.length;
      total = s;
      return total;
    },
    get total() {
      return total ?? 0;
    },
    reset(s = null) {
      total = s;
    },
  };
}

// The opponent. start: distance along the route of its grid slot; lane: +1 right of the line, −1 left.
export function createOpponent(route, { start = 0, lane = 1 } = {}, settings = raceSettings) {
  const s = settings;
  const st = { total: start, speed: 0, lane, laneNow: lane, x: 0, z: 0, yaw: 0, finished: false, blocked: false };
  // highest speed allowed here, braking in time for the corners in the next 40 m
  function limit(at) {
    let v = s.top;
    for (let d = 0; d <= 40; d += route.step * 2) {
      const k = route.kappa(at + d);
      const vc = k > 1e-4 ? Math.sqrt(s.lateral / k) : s.top;
      v = Math.min(v, Math.sqrt(vc * vc + 2 * s.brake * d));
    }
    return v;
  }
  function place() {
    const p = route.at(st.total);
    // right of the direction of travel (x right = (−dz, dx) in this y-up, z-south frame)
    const rx = -p.dz, rz = p.dx;
    st.x = p.x + rx * st.laneNow * s.lane;
    st.z = p.z + rz * st.laneNow * s.lane;
    st.yaw = Math.atan2(-p.dz, p.dx); // heading like the player's car (+X forwards, CCW from above)
  }
  place();
  return {
    state: st,
    // player: { total (tracker), x, z, speed }; go: false before the start / after the finish line
    update(dt, player, go = true, finishAt = Infinity) {
      let target = go ? limit(st.total) : 0;
      if (go) {
        const gap = player.total - st.total; // + = the player is ahead
        const k = Math.max(-1, Math.min(1, gap / s.gapRange));
        target *= k > 0 ? 1 + s.catchUp * k : 1 + s.holdBack * k;
        // the player right in front (along the route and on this side): move over, don't push through
        const ahead = gap > 0 && gap < 12;
        const p = route.at(st.total);
        const side = (player.x - p.x) * -p.dz + (player.z - p.z) * p.dx; // + = right of the route line
        st.blocked = ahead && Math.abs(side - st.laneNow * s.lane) < 2.4;
        if (st.blocked) {
          st.lane = side > 0 ? -1 : 1;
          if (gap < 7) target = Math.min(target, player.speed);
        } else if (gap < -25) st.lane = 1; // well clear: back to the right
      }
      if (st.total >= finishAt) {
        st.finished = true;
        target = 0; // over the line: roll to a stop
      }
      const a = target > st.speed ? s.accel : s.brake;
      st.speed += Math.max(-a * dt, Math.min(a * dt, target - st.speed));
      st.total += st.speed * dt;
      st.laneNow += Math.max(-dt * 0.8, Math.min(dt * 0.8, st.lane - st.laneNow)); // a gentle lane change
      place();
      return st;
    },
  };
}

// Whole race: laps, positions, result
export function createRace(route, { laps = 2, playerStart = -8, rivalStart = -8, countdown = 3 } = {}, settings = raceSettings) {
  const tracker = createTracker(route, settings);
  const rival = createOpponent(route, { start: rivalStart, lane: 1 }, settings);
  const finishAt = laps * route.length;
  const st = { time: -countdown, laps, lap: 1, rivalLap: 1, position: 1, gap: 0, result: null, playerTotal: playerStart };
  return {
    state: st,
    route,
    rival,
    tracker,
    finishAt,
    // player: { x, z, speed } → state
    update(dt, player) {
      st.time += dt;
      const go = st.time >= 0;
      const total = tracker.update(player.x, player.z);
      st.playerTotal = total;
      rival.update(dt, { ...player, total }, go, finishAt); // (it drives on to its own finish line, then stops)
      st.lap = Math.min(laps, Math.floor(Math.max(0, total) / route.length) + 1);
      st.rivalLap = Math.min(laps, Math.floor(Math.max(0, rival.state.total) / route.length) + 1);
      st.gap = total - rival.state.total;
      st.position = st.gap >= 0 ? 1 : 2;
      if (!st.result && go) {
        if (total >= finishAt) st.result = 'won';
        else if (rival.state.total >= finishAt) st.result = 'lost';
      }
      return st;
    },
    get countdown() {
      return st.time < 0 ? Math.ceil(-st.time) : 0;
    },
  };
}
