/* Reusable latest-request runner. Abort saves work; the generation check also
   rejects late results from operations that do not honour AbortSignal. */
(function (root) {
  function createLatestTask(publish) {
    let generation = 0;
    let controller;
    function cancel() {
      generation += 1;
      controller?.abort();
      controller = undefined;
      publish({ phase: "idle" });
    }
    async function run(operation) {
      controller?.abort();
      const current = ++generation;
      const request = new AbortController();
      controller = request;
      publish({ phase: "busy" });
      try {
        const value = await operation(request.signal);
        if (current === generation) publish({ phase: "ready", value });
      } catch (error) {
        if (current === generation) publish({ phase: "error", error });
      } finally {
        if (current === generation) controller = undefined;
      }
    }
    return { run, cancel };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { createLatestTask };
  else root.createLatestTask = createLatestTask;
})(globalThis);
