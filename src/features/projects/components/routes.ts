/**
 * The two project screens, from one module so they build into one chunk.
 *
 * Each route is otherwise its own chunk. These two are the exception because they are not
 * independent: `/projects` is a stop on the way into a workspace far more often than a
 * destination, and the pair share their API modules and presentation helpers. Split, those
 * shared parts became a third chunk and the home screen a fourth, for about 1.5 kB — a
 * second round trip on the most common path in exchange for saving it on the rarest.
 */
export { default as Projects } from './Projects';
export { default as Workspace } from './Workspace';
