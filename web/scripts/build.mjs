import { spawnSync } from 'node:child_process';

process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA ??= 'true';
process.env.BROWSERSLIST_IGNORE_OLD_DATA ??= 'true';

const filterWarningsUrl = new URL('./filter-build-warnings.mjs', import.meta.url).href;
const supportsNodeOption = (flag) => process.allowedNodeEnvironmentFlags.has(flag);
const nodeOptions = [
    process.env.NODE_OPTIONS,
    supportsNodeOption('--disable-warning=DEP0205') ? '--disable-warning=DEP0205' : null,
    supportsNodeOption('--no-experimental-webstorage') ? '--no-experimental-webstorage' : null,
    `--import=${filterWarningsUrl}`,
].filter(Boolean);

const result = spawnSync(
    process.execPath,
    [
        './node_modules/next/dist/bin/next',
        'build',
    ],
    {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_OPTIONS: nodeOptions.join(' '),
        },
    },
);

process.exit(result.status ?? 1);
