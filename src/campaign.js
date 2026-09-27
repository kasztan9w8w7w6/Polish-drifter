// Order of the missions and what "Kontynuuj" continues (logic only, tested in Node). The order is a data file
// (src/story/kampania.json: "misje": [ids]); the saved progress is { mission, step, save } (settings.js, localStorage).
export function createCampaign(def, missions) {
  const order = def.misje.filter((id) => missions[id]);
  return {
    order,
    first: order[0],
    // the mission after `id` (null = that was the last one)
    next: (id) => order[order.indexOf(id) + 1] ?? null,
    number: (id) => order.indexOf(id) + 1,
    // saved progress → { mission, step } to continue from (a missing / unknown mission starts from the first one)
    resume(progress) {
      if (!progress) return { mission: order[0], step: 0 };
      if (progress.mission === null || progress.done) return { mission: null, step: 0 }; // everything done: free ride
      if (!missions[progress.mission]) return { mission: order[0], step: 0 };
      return { mission: progress.mission, step: progress.step ?? 0 };
    },
  };
}
