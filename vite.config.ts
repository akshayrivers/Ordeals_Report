import { defineConfig, type Plugin } from "vite";

/** sql.js assigns `module = undefined` inside its loader. Vite serves that file as ESM. */
function sqlJsModuleFix(): Plugin {
  return {
    name: "sqljs-module-fix",
    transform(code, id) {
      if (!/sql-wasm(?:-browser)?\.js/.test(id) || id.includes(".wasm")) return null;
      let next = code;
      if (!next.includes("var module = { exports: {} }")) {
        next = `var module = { exports: {} };\nvar exports = module.exports;\n${next}`;
      }
      next = next.replace("module.exports.default = initSqlJs;", "");
      if (next.includes("\n        module = undefined;") && !next.includes("var module = undefined")) {
        next = next.replace("\n        module = undefined;", "\n        var module = undefined;");
      }
      if (!next.includes("export default initSqlJs")) {
        next += "\nexport default initSqlJs;\n";
      }
      return next;
    },
  };
}

export default defineConfig({
  server: {
    port: 5173,
  },
  optimizeDeps: {
    exclude: ["sql.js"],
  },
  plugins: [sqlJsModuleFix()],
});
