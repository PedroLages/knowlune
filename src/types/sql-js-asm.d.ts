/**
 * Type declaration for sql.js ASM.js build.
 *
 * The ASM.js build avoids WASM binary loading issues in production builds.
 * It exports the same initSqlJs function as the main sql.js package.
 */
declare module 'sql.js/dist/sql-asm.js' {
  import initSqlJs from 'sql.js'
  const init: typeof initSqlJs
  export default init
}
