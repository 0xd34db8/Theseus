import { common, createLowlight } from "lowlight";

export const lowlight = createLowlight(common);

// Register common language aliases for seamless developer experience
lowlight.registerAlias({ cpp: ["c++", "cplusplus"] });
lowlight.registerAlias({ javascript: ["js", "jsx"] });
lowlight.registerAlias({ typescript: ["ts", "tsx"] });
lowlight.registerAlias({ python: ["py"] });
lowlight.registerAlias({ shell: ["bash", "sh", "zsh"] });
lowlight.registerAlias({ markdown: ["md"] });
lowlight.registerAlias({ yaml: ["yml"] });

/**
 * Maps short language identifiers to clean user-facing badges
 */
export const LANGUAGE_LABELS: Record<string, string> = {
  cpp: "C++",
  c: "C",
  csharp: "C#",
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  bash: "Bash",
  shell: "Shell",
  rust: "Rust",
  go: "Go",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  sql: "SQL",
  markdown: "Markdown",
  yaml: "YAML",
  xml: "XML",
  graphql: "GraphQL",
  lua: "Lua",
  r: "R",
  ruby: "Ruby",
  php: "PHP",
  diff: "Diff",
  plaintext: "Text",
};
