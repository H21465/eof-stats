/**
 * @fileoverview EOF Stats Plugin for Obsidian
 * Displays file statistics (URLs, Links) and EOF indicator
 * at the end of markdown files.
 */

import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  MarkdownPostProcessorContext
} from "obsidian";
import { EditorView, Decoration, DecorationSet, WidgetType } from "@codemirror/view";
import { StateField, Transaction } from "@codemirror/state";

/**
 * Plugin settings interface
 */
interface EOFStatsSettings {
  /** Whether to display URL count */
  showUrls: boolean;
  /** Whether to display internal link count */
  showLinks: boolean;
  /** Color for statistics text */
  statsColor: string;
  /** Color for horizontal lines */
  lineColor: string;
  /** Color for EOF text */
  eofColor: string;
}

/**
 * Default settings values
 */
const DEFAULT_SETTINGS: EOFStatsSettings = {
  showUrls: true,
  showLinks: true,
  statsColor: "#999999",
  lineColor: "#999999",
  eofColor: "#999999"
};

/**
 * File statistics interface
 */
interface FileStats {
  /** Number of unique URLs */
  urls: number;
  /** Number of unique internal links */
  links: number;
}

/**
 * Calculate statistics from markdown content
 * @param content - The markdown content to analyze
 * @returns FileStats object containing URL and link counts
 */
function calculateStats(content: string): FileStats {
  // Remove frontmatter
  const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, "");

  // URLs (unique)
  const urlRegex = /https?:\/\/[^\s\)\]>]+/g;
  const urls = new Set(contentWithoutFrontmatter.match(urlRegex) || []);

  // Internal links [[...]] (unique)
  const wikilinkRegex = /\[\[([^\]|#]+)/g;
  const links = new Set<string>();
  let match;
  while ((match = wikilinkRegex.exec(contentWithoutFrontmatter)) !== null) {
    links.add(match[1]);
  }

  return {
    urls: urls.size,
    links: links.size
  };
}

/**
 * Format a number with locale-specific separators
 * @param num - The number to format
 * @returns Formatted string with thousands separators
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Build the statistics display string based on settings
 * @param stats - The file statistics
 * @param settings - The plugin settings
 * @returns Formatted statistics string
 */
function buildStatsString(stats: FileStats, settings: EOFStatsSettings): string {
  const parts: string[] = [];

  if (settings.showUrls) {
    parts.push(`URLs: ${formatNumber(stats.urls)}`);
  }
  if (settings.showLinks) {
    parts.push(`Links: ${formatNumber(stats.links)}`);
  }

  return parts.join(" | ");
}

/**
 * CodeMirror widget for displaying EOF stats in Live Preview mode
 */
class EOFStatsWidget extends WidgetType {
  /**
   * Create a new EOFStatsWidget
   * @param stats - The file statistics to display
   * @param settings - The plugin settings
   */
  constructor(
    private stats: FileStats,
    private settings: EOFStatsSettings
  ) {
    super();
  }

  /**
   * Create the DOM element for the widget
   * @returns The container element with stats and EOF indicator
   */
  toDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "eof-stats-container";

    const statsString = buildStatsString(this.stats, this.settings);

    if (statsString) {
      const statsDiv = document.createElement("div");
      statsDiv.className = "eof-stats-line";
      statsDiv.textContent = statsString;
      statsDiv.style.color = this.settings.statsColor;
      container.appendChild(statsDiv);
    }

    const eofDiv = document.createElement("div");
    eofDiv.className = "eof-indicator";
    eofDiv.innerHTML = `
      <div class="eof-line-horizontal" style="border-color: ${this.settings.lineColor}"></div>
      <div class="eof-text" style="color: ${this.settings.eofColor}">EOF</div>
      <div class="eof-line-horizontal" style="border-color: ${this.settings.lineColor}"></div>
    `;
    container.appendChild(eofDiv);

    return container;
  }

  /**
   * Check if two widgets are equal (for optimization)
   * @param other - The other widget to compare
   * @returns True if widgets are equal
   */
  eq(other: EOFStatsWidget): boolean {
    return (
      this.stats.urls === other.stats.urls &&
      this.stats.links === other.stats.links &&
      this.settings.showUrls === other.settings.showUrls &&
      this.settings.showLinks === other.settings.showLinks &&
      this.settings.statsColor === other.settings.statsColor &&
      this.settings.lineColor === other.settings.lineColor &&
      this.settings.eofColor === other.settings.eofColor
    );
  }
}

/**
 * Build EOF decoration for the document
 * @param content - The document content
 * @param settings - The plugin settings
 * @returns DecorationSet with EOF stats widget as block element
 */
function buildEOFDecoration(content: string, settings: EOFStatsSettings): DecorationSet {
  const stats = calculateStats(content);
  const widget = new EOFStatsWidget(stats, settings);
  const deco = Decoration.widget({
    widget,
    side: 1,
    block: true  // ブロックレベルウィジェット（親スタイルの影響を受けない）
  });
  return Decoration.set([deco.range(content.length)]);
}

/**
 * Create a CodeMirror StateField for Live Preview mode
 * StateField is required for block-level widgets (ViewPlugin doesn't work)
 * @param plugin - The main plugin instance
 * @returns StateField that provides EOF stats widget at document end
 */
function createEOFStatsField(plugin: EOFStatsPlugin) {
  return StateField.define<DecorationSet>({
    create(state): DecorationSet {
      return buildEOFDecoration(state.doc.toString(), plugin.settings);
    },
    update(decorations: DecorationSet, tr: Transaction): DecorationSet {
      if (!tr.docChanged) {
        // ドキュメント変更なし：既存のdecorationを位置調整のみ
        return decorations.map(tr.changes);
      }
      // ドキュメント変更あり：再計算
      return buildEOFDecoration(tr.state.doc.toString(), plugin.settings);
    },
    provide: f => EditorView.decorations.from(f)
  });
}

/**
 * Settings tab for the EOF Stats plugin
 */
class EOFStatsSettingTab extends PluginSettingTab {
  plugin: EOFStatsPlugin;

  /**
   * Create a new settings tab
   * @param app - The Obsidian app instance
   * @param plugin - The main plugin instance
   */
  constructor(app: App, plugin: EOFStatsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Display the settings tab contents
   */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "EOF Stats Settings" });

    // Display toggles
    containerEl.createEl("h3", { text: "Display Items" });

    new Setting(containerEl)
      .setName("Show URLs")
      .setDesc("Display the count of unique URLs")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showUrls)
          .onChange(async value => {
            this.plugin.settings.showUrls = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show Links")
      .setDesc("Display the count of unique internal links")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showLinks)
          .onChange(async value => {
            this.plugin.settings.showLinks = value;
            await this.plugin.saveSettings();
          })
      );

    // Color settings
    containerEl.createEl("h3", { text: "Colors" });

    new Setting(containerEl)
      .setName("Stats Color")
      .setDesc("Color for the statistics text")
      .addText(text =>
        text
          .setPlaceholder("#999999")
          .setValue(this.plugin.settings.statsColor)
          .onChange(async value => {
            this.plugin.settings.statsColor = value || DEFAULT_SETTINGS.statsColor;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Line Color")
      .setDesc("Color for the horizontal lines")
      .addText(text =>
        text
          .setPlaceholder("#999999")
          .setValue(this.plugin.settings.lineColor)
          .onChange(async value => {
            this.plugin.settings.lineColor = value || DEFAULT_SETTINGS.lineColor;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("EOF Color")
      .setDesc("Color for the EOF text")
      .addText(text =>
        text
          .setPlaceholder("#999999")
          .setValue(this.plugin.settings.eofColor)
          .onChange(async value => {
            this.plugin.settings.eofColor = value || DEFAULT_SETTINGS.eofColor;
            await this.plugin.saveSettings();
          })
      );
  }
}

/**
 * Main plugin class for EOF Stats
 * Displays file statistics and EOF indicator at the end of markdown files
 */
export default class EOFStatsPlugin extends Plugin {
  /** Plugin settings */
  settings: EOFStatsSettings;

  /**
   * Plugin initialization
   * Called when the plugin is loaded
   */
  async onload() {
    await this.loadSettings();

    // Register settings tab
    this.addSettingTab(new EOFStatsSettingTab(this.app, this));

    // Register CodeMirror StateField for Live Preview (block-level widget)
    this.registerEditorExtension(createEOFStatsField(this));

    // Register markdown post processor for Reading View
    this.registerMarkdownPostProcessor((el, ctx) => {
      this.addEOFToReadingView(el, ctx);
    });
  }

  /**
   * Plugin cleanup
   * Called when the plugin is unloaded
   */
  onunload() {
    // Cleanup if needed
  }

  /**
   * Load plugin settings from storage
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Save plugin settings to storage
   */
  async saveSettings() {
    await this.saveData(this.settings);
    // Trigger re-render
    this.app.workspace.updateOptions();
  }

  /**
   * Add EOF stats to Reading View
   * @param el - The HTML element being processed
   * @param ctx - The markdown post processor context
   */
  addEOFToReadingView(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    // Only add to the last section
    const sectionInfo = ctx.getSectionInfo(el);
    if (!sectionInfo) return;

    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!file) return;

    // Check if this is the last section
    this.app.vault.cachedRead(file as any).then(content => {
      const lines = content.split("\n");
      const lastLineIndex = lines.length - 1;

      // Check if current section contains the last line
      if (sectionInfo.lineEnd >= lastLineIndex) {
        const stats = calculateStats(content);
        const container = document.createElement("div");
        container.className = "eof-stats-container";

        const statsString = buildStatsString(stats, this.settings);

        if (statsString) {
          const statsDiv = document.createElement("div");
          statsDiv.className = "eof-stats-line";
          statsDiv.textContent = statsString;
          statsDiv.style.color = this.settings.statsColor;
          container.appendChild(statsDiv);
        }

        const eofDiv = document.createElement("div");
        eofDiv.className = "eof-indicator";
        eofDiv.innerHTML = `
          <div class="eof-line-horizontal" style="border-color: ${this.settings.lineColor}"></div>
          <div class="eof-text" style="color: ${this.settings.eofColor}">EOF</div>
          <div class="eof-line-horizontal" style="border-color: ${this.settings.lineColor}"></div>
        `;
        container.appendChild(eofDiv);

        el.appendChild(container);
      }
    });
  }
}
