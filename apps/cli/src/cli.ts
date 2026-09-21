import { run } from './run';

const code = await run(process.argv.slice(2), {
  out: (s) => console.log(s),
  err: (s) => console.error(s),
  cwd: process.cwd(),
  env: process.env,
});
process.exit(code);
