npm audit fix

up to date, audited 631 packages in 34s

115 packages are looking for funding
  run `npm fund` for details

# npm audit report

electron  <35.7.5
Severity: moderate
Electron has ASAR Integrity Bypass via resource modification - https://github.com/advisories/GHSA-vmqv-hx8q-j7mg
fix available via `npm audit fix --force`
Will install electron@40.6.0, which is a breaking change
node_modules/electron

esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response - https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install vite@7.3.1, which is a breaking change
node_modules/esbuild
  vite  0.11.0 - 6.1.6
  Depends on vulnerable versions of esbuild
  node_modules/vite
    vite-node  <=2.2.0-beta.2
    Depends on vulnerable versions of vite
    node_modules/vite-node
      vitest  0.0.1 - 0.0.12 || 0.0.29 - 0.0.122 || 0.3.3 - 2.2.0-beta.2
      Depends on vulnerable versions of vite
      Depends on vulnerable versions of vite-node
      node_modules/vitest

minimatch  <10.2.1
Severity: high
minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern - https://github.com/advisories/GHSA-3ppc-4f35-3m26
fix available via `npm audit fix --force`
Will install eslint@10.0.2, which is a breaking change
node_modules/@electron/asar/node_modules/minimatch
node_modules/@electron/universal/node_modules/minimatch
node_modules/@eslint/eslintrc/node_modules/minimatch
node_modules/@humanwhocodes/config-array/node_modules/minimatch
node_modules/app-builder-lib/node_modules/minimatch
node_modules/config-file-ts/node_modules/minimatch
node_modules/dir-compare/node_modules/minimatch
node_modules/eslint/node_modules/minimatch
node_modules/glob/node_modules/minimatch
node_modules/minimatch
node_modules/readdir-glob/node_modules/minimatch
  @electron/asar  3.2.1 - 3.4.1
  Depends on vulnerable versions of glob
  Depends on vulnerable versions of minimatch
  node_modules/@electron/asar
    @electron/universal  >=1.0.1
    Depends on vulnerable versions of @electron/asar
    Depends on vulnerable versions of dir-compare
    Depends on vulnerable versions of minimatch
    node_modules/@electron/universal
      app-builder-lib  *
      Depends on vulnerable versions of @electron/universal
      Depends on vulnerable versions of dmg-builder
      Depends on vulnerable versions of electron-builder-squirrel-windows
      Depends on vulnerable versions of minimatch
      Depends on vulnerable versions of read-config-file
      Depends on vulnerable versions of tar
      node_modules/app-builder-lib
        dmg-builder  5.0.0 - 25.0.0-alpha.13
        Depends on vulnerable versions of app-builder-lib
        node_modules/dmg-builder
          electron-builder  19.25.0 || 20.24.0 - 25.0.5
          Depends on vulnerable versions of app-builder-lib
          Depends on vulnerable versions of dmg-builder
          Depends on vulnerable versions of read-config-file
          node_modules/electron-builder
        electron-builder-squirrel-windows  20.24.0 - 26.0.2
        Depends on vulnerable versions of app-builder-lib
        Depends on vulnerable versions of archiver
        node_modules/electron-builder-squirrel-windows
  @eslint/eslintrc  0.0.1 || >=0.1.1
  Depends on vulnerable versions of minimatch
  node_modules/@eslint/eslintrc
    eslint  0.7.1 - 2.0.0-rc.1 || 4.1.0 - 10.0.0-rc.2
    Depends on vulnerable versions of @eslint/eslintrc
    Depends on vulnerable versions of @humanwhocodes/config-array
    Depends on vulnerable versions of file-entry-cache
    Depends on vulnerable versions of minimatch
    node_modules/eslint
      @typescript-eslint/eslint-plugin  <=8.55.1-alpha.3
      Depends on vulnerable versions of @typescript-eslint/parser
      Depends on vulnerable versions of @typescript-eslint/type-utils
      Depends on vulnerable versions of @typescript-eslint/utils
      Depends on vulnerable versions of eslint
      node_modules/@typescript-eslint/eslint-plugin
      @typescript-eslint/parser  1.1.1-alpha.0 - 8.56.1-alpha.2
      Depends on vulnerable versions of @typescript-eslint/typescript-estree
      Depends on vulnerable versions of eslint
      node_modules/@typescript-eslint/parser
      @typescript-eslint/type-utils  5.9.2-alpha.0 - 8.56.1-alpha.2
      Depends on vulnerable versions of @typescript-eslint/typescript-estree
      Depends on vulnerable versions of @typescript-eslint/utils
      Depends on vulnerable versions of eslint
      node_modules/@typescript-eslint/type-utils
      @typescript-eslint/utils  <=8.56.1-alpha.2
      Depends on vulnerable versions of @typescript-eslint/typescript-estree
      Depends on vulnerable versions of eslint
      node_modules/@typescript-eslint/utils
  @humanwhocodes/config-array  *
  Depends on vulnerable versions of minimatch
  node_modules/@humanwhocodes/config-array
  @typescript-eslint/typescript-estree  6.16.0 - 8.56.1-alpha.2
  Depends on vulnerable versions of minimatch
  node_modules/@typescript-eslint/typescript-estree
  dir-compare  *
  Depends on vulnerable versions of minimatch
  node_modules/dir-compare
  glob  3.0.0 - 10.5.0
  Depends on vulnerable versions of minimatch
  node_modules/config-file-ts/node_modules/glob
  node_modules/glob
    archiver-utils  >=0.2.0
    Depends on vulnerable versions of glob
    node_modules/archiver-utils
    node_modules/zip-stream/node_modules/archiver-utils
      archiver  >=0.20.0
      Depends on vulnerable versions of archiver-utils
      Depends on vulnerable versions of readdir-glob
      Depends on vulnerable versions of zip-stream
      node_modules/archiver
      zip-stream  0.8.0 - 6.0.1
      Depends on vulnerable versions of archiver-utils
      node_modules/zip-stream
    config-file-ts  *
    Depends on vulnerable versions of glob
    node_modules/config-file-ts
      read-config-file  >=6.3.0
      Depends on vulnerable versions of config-file-ts
      node_modules/read-config-file
    rimraf  2.3.0 - 3.0.2 || 4.2.0 - 5.0.10
    Depends on vulnerable versions of glob
    node_modules/rimraf
      flat-cache  1.3.4 - 4.0.0
      Depends on vulnerable versions of rimraf
      node_modules/flat-cache
        file-entry-cache  4.0.0 - 7.0.2
        Depends on vulnerable versions of flat-cache
        node_modules/file-entry-cache
  readdir-glob  <=2.0.3
  Depends on vulnerable versions of minimatch
  node_modules/readdir-glob

tar  <=7.5.7
Severity: high
Race Condition in node-tar Path Reservations via Unicode Ligature Collisions on macOS APFS - https://github.com/advisories/GHSA-r6q2-hw4h-h46w  
node-tar Vulnerable to Arbitrary File Creation/Overwrite via Hardlink Path Traversal - https://github.com/advisories/GHSA-34x7-hfp2-rc4v        
node-tar is Vulnerable to Arbitrary File Overwrite and Symlink Poisoning via Insufficient Path Sanitization - https://github.com/advisories/GHSA-8qq5-rm4j-mr97
Arbitrary File Read/Write via Hardlink Target Escape Through Symlink Chain in node-tar Extraction - https://github.com/advisories/GHSA-83g3-92jg-28cx
fix available via `npm audit fix --force`
Will install electron-builder@26.8.1, which is a breaking change
node_modules/tar

32 vulnerabilities (5 moderate, 27 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force