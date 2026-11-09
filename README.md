<p align="center">
  <img src="public/logo.png" width="76" height="96" alt="Theseus Logo" />
</p>

<h1 align="center">Theseus</h1>

<p align="center">
  Hierarchical syllabus organizer and note workspace.
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16.4.5-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind-4.3.5-38bdf8?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" /></a>
  <a href="https://tiptap.dev"><img src="https://img.shields.io/badge/TipTap-Editor-000000?style=flat-square" alt="TipTap" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#core-workflow-philosophy">Core Workflow</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#progress-tracking">Progress Tracking</a> •
  <a href="#universal-llm-connectivity">LLM Integration</a> •
  <a href="#keyboard-shortcuts">Keyboard Shortcuts</a> •
  <a href="#data-schema-theseus">Data Schema</a> •
  <a href="#project-structure">Project Structure</a>
</p>

<p align="center">
  <code>npm install &amp;&amp; npm run dev</code>
</p>

---

> [!IMPORTANT]
> **Client-Side & Model Agnostic**: Theseus operates entirely within the user's browser. API keys, course syllabi, and notes are stored locally in browser storage without third-party database dependencies. Users can connect any supported provider (Google Gemini, OpenAI, Anthropic Claude, OpenRouter, Groq, or custom OpenAI-compatible endpoints) or use the workflow completely offline.

---

## Overview

Academic curricula and course outlines are often distributed as unstructured PDF documents, Word tables, or dense syllabi. Extracting structured study paths and keeping organized, topic-specific notes across large modules is cumbersome with standard word processors.

Theseus organizes curriculum documents into interactive, hierarchical study workspaces:

- Dedicated study note workspace for each syllabus topic.
- TipTap-powered editor with bidirectional Markdown support:
  - Headings, bold, italic, underline, strikethrough, and text highlighting.
  - Ordered lists, bullet lists, and task checkboxes.
  - Code blocks, blockquotes, and text alignment controls.
  - Inline image insertion with customizable resizing handles and Notion-style URL embeds.
- Nested sub-sections drawer for attaching targeted topic questions, clarifications, derivations, and sectional breakdowns.
- Dual-mode syllabus tree with interactive visual hierarchy and live JSON tree editing with syntax highlighting.
- Non-destructive tree undo and redo that preserves topic note content across structural changes.
- Universal LLM integration for AI study note generation and prompt export for external web models.

---

## Core Workflow & Philosophy

The foundational design of Theseus centers on a unified study workflow: **bringing the syllabus outline and note-taking into one cohesive workspace for organized, concise, at-a-glance information intake and retrieval**.

### The Fragmentation Problem

In traditional learning environments, the course outline and study notes live in completely separate domains:

- The **syllabus** exists as a static PDF, printout, or LMS web page.
- The **notes** end up scattered across notebook pages, disconnected Google Docs, Notion pages, or nested folder directories.

This separation introduces continuous friction: learners lose context on which syllabus requirements have actually been covered, struggle to locate concise summaries for specific exam topics, and end up with monolithic, hundred-page documents where finding individual concepts requires constant search queries and scrolling.

### The Solution

Theseus eliminates this boundary by merging curriculum structure and topic notes into a single interface:

1. **Unified Navigation & Scoped Workspace**:
   The syllabus tree functions as both the curriculum outline and the navigation index. Selecting any topic in the tree immediately opens its dedicated note pane side by side, ensuring notes are always anchored to their curriculum context.

2. **At-a-Glance Intake & Retrieval**:
   Learners can assess their entire course standing in seconds. Dedicated note indicators show exactly which topics have attached study summaries, while color-coded completion chips (Done, Partially, Barely, Untouched) provide instant visibility into course mastery without opening individual documents.

3. **Contextual Knowledge Chunking**:
   Rather than allowing notes to accumulate into unstructured, monolithic files, Theseus encourages concise, topic-scoped documentation. Secondary details, problem sets, and derivations live in the topic's floating sub-sections drawer, keeping primary notes clean and high-yield.

4. **Single Portable Workspace**:
   The entire curriculum structure, progress metrics, topic notes, and supplementary comments persist together in a single `.theseus` file, providing a complete, self-contained study record that can be loaded or backed up at any time.

---

## Key Features

### Intelligent Syllabus Ingestion

- Ingest course curricula from **PDF documents**, **Microsoft Word (`.docx`)**, **plain text (`.txt`)**, and native **`.theseus` / `.json`** files.
- **Core Syllabus Only Filter**: Toggleable parser directive that excludes non-syllabus material (e.g., lab experiments, learning outcomes, textbook citations, and grading matrices) to focus exclusively on conceptual coursework.
- **Instant Homepage Paste**: Paste generated JSON or `.theseus` data anywhere on the homepage (`Cmd+V` / `Ctrl+V`) to automatically parse the tree and launch the workspace.

### Hierarchical Tree Viewer & Editor

- **Visual Tree Navigation**: Expand and collapse modules, units, and sections (`▼` / `▶`).
- **Note Indicator**: Displays a dedicated note icon beside topics containing study notes.
- **Inline Renaming**: Double-click any topic in the tree to edit its title directly (`Enter` to save, `Esc` to cancel).
- **Context Menu**: Click the options button (`...`) on any topic to update progress status (Done, Partially, Barely, Untouched), toggle note creation/removal, create a subtopic, rename, or delete the topic.
- **Tree Undo & Redo**: Dedicated undo (`Ctrl+Z`) and redo (`Ctrl+Y`) controls for structural tree changes with note preservation—reverting or advancing tree structures never overwrites or erases user note content.
- **Topic Creation**: Add topics at the root level or add nested subtopics at any tier.

### Dual-Mode Live JSON Tree Editor

- **Seamless Toggle**: Switch between the visual tree and raw JSON via the `{ }` (Braces) button in the tree header (`Ctrl+Enter` or `Esc` to parse and toggle back).
- **Syntax Highlighting**: Real-time syntax-highlighted code overlay with instant validity detection (caret and text display in red when JSON syntax is incomplete or invalid).
- **Intelligent Formatting**: 2-space `Tab` key indentation and `Enter` key auto-indentation with opening bracket awareness (`{` and `[`).
- **Format Button**: One-click automatic indentation cleanup.
- **Fault-Tolerant Parser**: Repairs minor syntax issues (trailing commas, unclosed brackets) while preserving topic IDs and attached notes.

### Topic-Level Note Workspace

- **Rich Text Editor**: Powered by TipTap with bidirectional GitHub-flavored Markdown support.
- **Comprehensive Formatting Toolbar**:
  - History: Undo and Redo.
  - Style Selector: Normal text, Heading 1, Heading 2, Heading 3.
  - Inline Marks: Bold, Italic, Underline, Strikethrough, Highlight marker, Inline code.
  - Lists & Blocks: Bullet list, Numbered list, Task checklist, Blockquote, Code block, Horizontal divider.
  - Alignment: Left, Center, Right, Justify.
  - Clear formatting.
- **Media Handling**:
  - Drag-and-drop or local file upload for images.
  - Notion-style floating embed pill when pasting image URLs.
  - Visual resize handles with alignment persistence serialized directly to Markdown.
- **Inline Topic Renaming**: Click the centered topic heading in the editor to rename the topic in-place.
- **Topic Status Selector**: Update completion tier (Untouched, Barely, Partially, Done) directly from the editor header.
- **Fullscreen Mode**: Toggle distraction-free fullscreen writing via the expand button or keyboard (`Esc` to exit).
- **Debounced Autosave**: Automatic local persistence without manual save triggers.

### Subsections Drawer (Supplementary Notes)

- **Targeted Topic Threads**: Dedicated floating drawer for supplementary notes, derivations, formulas, and checklists.
- **YouTube Video & Resource Links**: Add YouTube video links, lecture references, and external web resources directly to topics with auto-linking.
- **TipTap Live Composer**: Full rich text editing with compact toolbar.
- **Keyboard Submission**: Press `Mod+Enter` to save and add a sub-section immediately.
- **In-Place Editing**: Double-click any existing sub-section card or click the pencil icon to edit in-place.
- **Markdown Display**: Rendered using GitHub-flavored Markdown with syntax-highlighted blocks.

### Universal LLM Connectivity & Prompt Export

- **Multi-Provider Support**: Connect Google Gemini, OpenAI, Anthropic Claude, OpenRouter, Groq, or any custom OpenAI-compatible endpoint with custom base URLs.
- **Custom Models**: Specify custom model identifiers for specialized or self-hosted deployments.
- **Connection Verification**: In-modal credential testing with instant diagnostic feedback.
- **Two-in-One Action Buttons**: Every AI action can be outsourced by copying the system prompt
- **External Web LLM Workflow**: Copy structured prompts for use with external chat interfaces (ChatGPT, Claude, Gemini web) without requiring an API key.

### Portable File Format & Recent Files

- **Native `.theseus` Files**: Standardized JSON-based schema storing tree hierarchy, notes, sub-comments, and completion states.
- **Native File Dialog**: Integration with the browser File System Access API (`showSaveFilePicker`) for native save dialogs with automatic download fallback.
- **Recent Files Dashboard**: Displays cached syllabi with real-time completion percentages and topic counts.
- **Confirmation & Undo**: Delete confirmation dialog with an instant inline Undo action to restore accidentally removed syllabi.

### Design System & Theme Engine

- **Semantic Design Tokens**: Built on pure CSS custom properties for background, foreground, card, subtle, border, primary, accent, and status tokens.
- **Theme Modes**: Supports Light, Dark (Obsidian Charcoal), and System preferences.
- **Zero Flash of Unstyled Content**: Pre-hydration bootstrap script ensures seamless theme rendering on page load.

---

## Progress Tracking

| Status             | Color Marker | Description                                             |
| :----------------- | :----------- | :------------------------------------------------------ |
| **Done**           | Blue         | Topics fully reviewed, summarized, and understood.      |
| **Partially Done** | Green        | Topics actively in progress or partially completed.     |
| **Barely Done**    | Red          | Topics briefly reviewed or requiring significant study. |
| **Untouched**      | Neutral      | Topics yet to be started.                               |

The interactive status indicator chip in the workspace footer displays the real-time completion percentage (percentage of topics marked Done) and expands into a comprehensive breakdown popover showing item distributions across each progress tier.

---

## Quick Start

### Prerequisites

- Node.js 18.x or later
- npm, pnpm, or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/0xd34db8/Theseus.git
   cd Theseus
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Launch the development server:

   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

### Available Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Generates an optimized production build.
- `npm run start`: Runs the built production server.
- `npm run lint`: Runs ESLint code quality checks.
- `npm run typecheck`: Runs TypeScript compiler type verification (`tsc --noEmit`).
- `npm run prepare`: Configures Husky Git hooks.

### Quality Assurance with Husky

Theseus includes a pre-commit hook via Husky that automatically executes `npm run typecheck && npm run build` before any commit is finalized, preventing broken import paths or type errors from reaching the repository.

---

## Universal LLM Connectivity

Theseus provides flexible AI options. Users can configure API credentials directly or use external web models without an API key:

### Option A: Direct API Configuration

1. Open the API Key modal via the key icon in the navigation bar.
2. Select your provider:
   - **Google Gemini**: Standard Generative Language endpoint (`gemini-3.8-flash` or custom).
   - **OpenAI**: Chat completions endpoint (`gpt-4o-mini`, `gpt-4o`, etc.).
   - **Anthropic Claude**: Messages API with direct browser support (`claude-3-5-haiku`, etc.).
   - **OpenRouter**: Unified model router.
   - **Groq**: High-throughput inference (`llama-3.3-70b-versatile`).
   - **Custom**: Any OpenAI-compatible server URL (e.g. Ollama, vLLM, LocalAI).
3. Test credentials using the integrated connection tester. Keys are persisted only in local browser storage.

### Option B: External LLM Workflow (No API Key Required)

1. On the Theseus homepage, click **Copy Tree Prompt** (or **Prompt**).
2. Attach your syllabus document or paste the prompt into your external LLM of choice (ChatGPT, Claude, Gemini web interface).
3. Copy the resulting JSON output from the LLM.
4. Return to Theseus and press `Cmd+V` (macOS) or `Ctrl+V` (Windows/Linux) anywhere on the homepage. Theseus will detect, parse, and open your syllabus immediately.

---

## Keyboard Shortcuts

| Shortcut           | Context            | Action                                                     |
| :----------------- | :----------------- | :--------------------------------------------------------- |
| `Cmd+V` / `Ctrl+V` | Homepage           | Instantly parse clipboard syllabus JSON and open workspace |
| `Cmd+S` / `Ctrl+S` | Workspace          | Export current syllabus as native `.theseus` file          |
| `Cmd+Z` / `Ctrl+Z` | Syllabus Tree      | Undo structural tree change (preserves note content)       |
| `Cmd+Y` / `Ctrl+Y` | Syllabus Tree      | Redo structural tree change (preserves note content)       |
| `Ctrl+Enter`       | JSON Tree Editor   | Parse JSON and return to visual tree                       |
| `Tab`              | JSON Tree Editor   | Insert 2-space indentation                                 |
| `Cmd+B` / `Ctrl+B` | Note Editor        | Toggle bold formatting                                     |
| `Cmd+I` / `Ctrl+I` | Note Editor        | Toggle italic formatting                                   |
| `Cmd+U` / `Ctrl+U` | Note Editor        | Toggle underline formatting                                |
| `Cmd+Shift+S`      | Note Editor        | Toggle strikethrough                                       |
| `Cmd+Shift+9`      | Note Editor        | Toggle task checklist                                      |
| `Cmd+Shift+L`      | Note Editor        | Align text left                                            |
| `Cmd+Shift+E`      | Note Editor        | Align text center                                          |
| `Cmd+Shift+R`      | Note Editor        | Align text right                                           |
| `Cmd+Shift+J`      | Note Editor        | Align text justify                                         |
| `Cmd+Enter`        | Subsections Drawer | Save and submit sub-section note                           |
| `Esc`              | Editor / Modals    | Exit fullscreen / Exit JSON mode / Close modal / Cancel    |
| Double-Click       | Syllabus Tree      | Rename topic in-place                                      |
| Double-Click       | Subsections Drawer | Edit existing sub-section in-place                         |

---

## Data Schema (.theseus)

Files exported with the `.theseus` extension use standardized JSON preserving tree hierarchy, notes, sub-comments, and completion statuses:

```json
{
  "id": "syllabus-1793889893779",
  "fileName": "Cloud Architecture",
  "lastModified": "Just now",
  "items": [
    {
      "id": "u-1",
      "title": "UNIT I: Cloud Foundations",
      "status": "done",
      "hasNote": true,
      "isExpanded": true,
      "note": {
        "id": "note-u-1",
        "title": "UNIT I: Cloud Foundations",
        "content": "### Overview\nKey architectural principles...",
        "updatedAt": "10:30 AM",
        "subComments": [
          {
            "id": "comment-1",
            "author": "",
            "timestamp": "Nov 05, 2026 at 10:32 AM",
            "content": "Details on cold vs hot tiers..."
          }
        ]
      },
      "children": [
        {
          "id": "u-1-1",
          "title": "Virtual Private Cloud (VPC)",
          "status": "partial",
          "hasNote": false,
          "isExpanded": true
        }
      ]
    }
  ]
}
```

---

## Project Structure

```text
Theseus/
├── .husky/                      # Git pre-commit verification hooks
├── app/
│   ├── globals.css              # Semantic CSS design tokens and Tailwind directives
│   ├── layout.tsx               # Root application layout and pre-hydration theme setup
│   ├── page.tsx                 # Homepage: file ingestion, recent files, paste listener
│   └── edit/
│       └── page.tsx             # Main study workspace: tree view and note editor
├── components/
│   ├── editor/                  # Study workspace components
│   │   ├── EditorToolbar.tsx    # Unified rich text formatting toolbar
│   │   ├── extensions.ts        # Modular TipTap extensions and markdown serializers
│   │   ├── JsonTreeEditor.tsx   # Dual-mode live JSON tree editor with syntax highlighting
│   │   ├── NoteEditor.tsx       # Main topic note editor with fullscreen and image embed
│   │   ├── ResizableImage.tsx   # Resizable inline image node view for TipTap
│   │   ├── StatusChip.tsx       # Footer progress breakdown chip and popover
│   │   ├── SubsectionsDrawer.tsx# Topic supplementary notes and comments drawer
│   │   ├── SyllabusTree.tsx     # Hierarchical tree viewer with status controls
│   │   ├── TopBar.tsx           # Workspace title bar and search controls
│   │   └── TreeContextMenu.tsx  # Topic context popover menu
│   ├── home/                    # Homepage sub-components (RecentFileCard)
│   ├── layout/                  # Shared application header
│   ├── modals/                  # Universal API key configuration modal
│   └── ui/                      # Shared UI components (ThemeToggle, NoteIcon, etc.)
├── hooks/
│   └── useTheme.ts              # React useSyncExternalStore theme hook
├── lib/
│   ├── ai.ts                    # Universal LLM caller and parsing prompt templates
│   ├── fileUtils.ts             # PDF, Word (.docx), and text document extractors
│   ├── parser.ts                # JSON sanitizer, structure validator, fallback parser
│   ├── storage.ts               # Local browser storage drivers for syllabi & config
│   ├── syllabusUtils.ts         # Tree traversal, stats calculation, and .theseus export
│   └── theme.ts                 # Theme bootstrap script and storage observer
├── public/                      # Static branding assets and icons
└── types/
    ├── ai.ts                    # Universal LLM interfaces and provider types
    ├── mammoth.d.ts             # Type definitions for Word document parser
    └── syllabus.ts              # Core TypeScript interfaces and domain models
```

---

## License

This project is licensed under the MIT License.
