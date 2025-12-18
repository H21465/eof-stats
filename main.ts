/**
 * @fileoverview EOF Stats Plugin for Obsidian
 * Displays file statistics (URLs, Links) and EOF indicator
 * at the end of markdown files.
 */

import {
  App,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
  MarkdownPostProcessorContext,
  TFile
} from "obsidian";
import { EditorView, Decoration, DecorationSet, WidgetType } from "@codemirror/view";
import { StateField, Transaction, Compartment } from "@codemirror/state";

/**
 * Compartment for dynamic settings reconfiguration
 */
const eofStatsCompartment = new Compartment();

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
  const urlRegex = /https?:\/\/[^\s)\]>]+/g;
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
 * Create the EOF stats container element
 */
function createEOFStatsElement(stats: FileStats, settings: EOFStatsSettings): HTMLElement {
  const container = document.createElement("div");
  container.className = "eof-stats-container";

  const statsString = buildStatsString(stats, settings);

  if (statsString) {
    const statsDiv = container.createEl("div", {
      cls: "eof-stats-line",
      text: statsString
    });
    statsDiv.style.color = settings.statsColor;
  }

  const eofDiv = container.createEl("div", { cls: "eof-indicator" });

  const line1 = eofDiv.createEl("div", { cls: "eof-line-horizontal" });
  line1.style.borderColor = settings.lineColor;

  const textDiv = eofDiv.createEl("div", { cls: "eof-text", text: "EOF" });
  textDiv.style.color = settings.eofColor;

  const line2 = eofDiv.createEl("div", { cls: "eof-line-horizontal" });
  line2.style.borderColor = settings.lineColor;

  return container;
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

  toDOM(): HTMLElement {
    return createEOFStatsElement(this.stats, this.settings);
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
  // Create a copy of settings to prevent reference sharing between old and new widgets
  const settingsCopy = { ...settings };
  const widget = new EOFStatsWidget(stats, settingsCopy);
  const deco = Decoration.widget({
    widget,
    side: 1,
    block: true
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
        return decorations.map(tr.changes);
      }
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

    // Display toggles
    new Setting(containerEl).setName("Display items").setHeading();

    new Setting(containerEl)
      .setName("Show external links")
      .setDesc("Display the number of unique external links")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showUrls)
          .onChange(async value => {
            this.plugin.settings.showUrls = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show links")
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
    new Setting(containerEl).setName("Colors").setHeading();

    new Setting(containerEl)
      .setName("Stats color")
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
      .setName("Line color")
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
      .setName("EOF color")
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
    // Using Compartment for dynamic reconfiguration when settings change
    this.registerEditorExtension(
      eofStatsCompartment.of(createEOFStatsField(this))
    );

    // Register markdown post processor for Reading View
    this.registerMarkdownPostProcessor((el, ctx) => {
      this.addEOFToReadingView(el, ctx);
    });
  }

  onunload() {
    // Resources are automatically cleaned up by Obsidian
  }

  /**
   * Load plugin settings from storage
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as EOFStatsSettings | null);
  }

  /**
   * Save plugin settings to storage
   */
  async saveSettings() {
    await this.saveData(this.settings);
    this.updateEditorExtension();
  }

  /**
   * Update all views to apply new settings
   */
  private updateEditorExtension() {
    // Live Preview / Source Mode: dispatch reconfigure effect to all editors
    this.app.workspace.iterateAllLeaves(leaf => {
      if (leaf.view instanceof MarkdownView) {
        // Access the underlying CodeMirror EditorView
        // @ts-expect-error - accessing internal CM6 editor
        const cm = leaf.view.editor?.cm as EditorView | undefined;
        if (cm) {
          cm.dispatch({
            effects: eofStatsCompartment.reconfigure(
              createEOFStatsField(this)
            )
          });
          cm.requestMeasure();
        }
        // Reading View: force rerender
        leaf.view.previewMode?.rerender(true);
      }
    });
  }

  /**
   * Add EOF stats to Reading View
   * @param el - The HTML element being processed
   * @param ctx - The markdown post processor context
   */
  addEOFToReadingView(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const sectionInfo = ctx.getSectionInfo(el);
    if (!sectionInfo) return;

    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!file || !(file instanceof TFile)) return;

    this.app.vault.cachedRead(file).then(content => {
      const lastLineIndex = content.split("\n").length - 1;

      if (sectionInfo.lineEnd >= lastLineIndex) {
        const stats = calculateStats(content);
        el.appendChild(createEOFStatsElement(stats, this.settings));
      }
    }).catch(() => {
      // Silent fail - file may have been deleted
    });
  }
}
