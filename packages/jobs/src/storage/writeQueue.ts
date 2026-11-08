// A queue that runs write tasks one at a time, so read-change-write updates of a file never overlap and lose changes.

// Returns a function that runs each task after the one before it has finished, in the order given. A failed task
// passes its error to its own caller and does not stop the tasks after it.
export function createWriteQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let last: Promise<unknown> = Promise.resolve()
  return (task) => {
    const run = last.then(task)
    last = run.catch(() => undefined)
    return run
  }
}
