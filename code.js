/// <reference types="@figma/plugin-typings" />
class DesignTokenExporter {
    constructor() {
        this.githubToken = null;
        this.initializePlugin();
    }
    async initializePlugin() {
        // Load stored GitHub token if available
        this.githubToken = await figma.clientStorage.getAsync('github_token') || null;
        figma.showUI(__html__, {
            width: 400,
            height: 600,
            themeColors: true
        });
        // Send initial data to UI
        this.sendTokensToUI();
    }
    async sendTokensToUI() {
        try {
            const tokens = await this.extractDesignTokens();
            const hasGitHubToken = !!this.githubToken;
            const stats = this.generateTokenStats(tokens);
            figma.ui.postMessage({
                type: 'tokens-extracted',
                tokens,
                hasGitHubToken,
                stats
            });
        }
        catch (error) {
            figma.ui.postMessage({
                type: 'error',
                message: `Failed to extract tokens: ${error.message}`
            });
        }
    }
    generateTokenStats(tokens) {
        const stats = {
            totalTokens: 0,
            tokensByType: {},
            collections: Object.keys(tokens).length,
            lastUpdated: new Date().toISOString()
        };
        const countTokensRecursive = (tokenObj) => {
            for (const key in tokenObj) {
                const token = tokenObj[key];
                if (token && typeof token === 'object' && 'type' in token && 'value' in token) {
                    // This is a DesignToken
                    const designToken = token;
                    stats.totalTokens++;
                    stats.tokensByType[designToken.type] = (stats.tokensByType[designToken.type] || 0) + 1;
                }
                else {
                    // This is a nested TokenCollection
                    countTokensRecursive(token);
                }
            }
        };
        countTokensRecursive(tokens);
        return stats;
    }
    async extractDesignTokens() {
        const tokens = {};
        try {
            // Extract variables (modern approach)
            const variables = figma.variables.getLocalVariables();
            const collections = figma.variables.getLocalVariableCollections();
            if (variables.length > 0) {
                tokens.variables = this.extractVariables(variables, collections);
            }
            // Extract legacy paint styles
            const paintStyles = figma.getLocalPaintStyles();
            if (paintStyles.length > 0) {
                tokens.colors = this.extractColorStyles(paintStyles);
            }
            // Extract text styles
            const textStyles = figma.getLocalTextStyles();
            if (textStyles.length > 0) {
                tokens.typography = this.extractTextStyles(textStyles);
            }
            // Extract effect styles
            const effectStyles = figma.getLocalEffectStyles();
            if (effectStyles.length > 0) {
                tokens.effects = this.extractEffectStyles(effectStyles);
            }
            // Extract grid styles (layout grids)
            const gridTokens = this.extractGridTokens();
            if (Object.keys(gridTokens).length > 0) {
                tokens.grids = gridTokens;
            }
            // Extract spacing tokens from auto-layout
            const spacingTokens = this.extractSpacingTokens();
            if (Object.keys(spacingTokens).length > 0) {
                tokens.spacing = spacingTokens;
            }
            // Extract border radius tokens
            const borderRadiusTokens = this.extractBorderRadiusTokens();
            if (Object.keys(borderRadiusTokens).length > 0) {
                tokens.borderRadius = borderRadiusTokens;
            }
            return tokens;
        }
        catch (error) {
            console.error('Error extracting design tokens:', error);
            throw new Error('Failed to extract design tokens from Figma');
        }
    }
    extractVariables(variables, collections) {
        const variableTokens = {};
        // Group variables by collection
        collections.forEach(collection => {
            const collectionVariables = variables.filter(v => v.variableCollectionId === collection.id);
            if (collectionVariables.length > 0) {
                const collectionTokens = {};
                collectionVariables.forEach(variable => {
                    const tokenName = this.sanitizeTokenName(variable.name);
                    // Handle different modes
                    if (collection.modes.length === 1) {
                        // Single mode - use direct value
                        const value = variable.valuesByMode[collection.defaultModeId];
                        collectionTokens[tokenName] = {
                            value: this.formatVariableValue(value, variable.resolvedType),
                            type: this.getTokenType(variable.resolvedType),
                            description: variable.description || undefined
                        };
                    }
                    else {
                        // Multiple modes - create nested structure
                        const modeTokens = {};
                        collection.modes.forEach(mode => {
                            const value = variable.valuesByMode[mode.modeId];
                            if (value !== undefined) {
                                modeTokens[mode.name] = {
                                    value: this.formatVariableValue(value, variable.resolvedType),
                                    type: this.getTokenType(variable.resolvedType),
                                    description: variable.description || undefined
                                };
                            }
                        });
                        collectionTokens[tokenName] = modeTokens;
                    }
                });
                variableTokens[this.sanitizeTokenName(collection.name)] = collectionTokens;
            }
        });
        return variableTokens;
    }
    extractColorStyles(styles) {
        const colorTokens = {};
        styles.forEach(style => {
            const paint = style.paints[0];
            const tokenName = this.sanitizeTokenName(style.name);
            if (paint && paint.type === 'SOLID') {
                colorTokens[tokenName] = {
                    value: this.rgbToHex(paint.color),
                    type: 'color',
                    description: style.description || undefined
                };
            }
            else if (paint && paint.type === 'GRADIENT_LINEAR') {
                colorTokens[tokenName] = {
                    value: this.formatGradient(paint),
                    type: 'gradient',
                    description: style.description || undefined
                };
            }
        });
        return colorTokens;
    }
    extractTextStyles(styles) {
        const typographyTokens = {};
        styles.forEach(style => {
            const tokenName = this.sanitizeTokenName(style.name);
            typographyTokens[tokenName] = {
                value: {
                    fontFamily: style.fontName.family,
                    fontWeight: style.fontName.style,
                    fontSize: `${style.fontSize}px`,
                    lineHeight: style.lineHeight.unit === 'PIXELS' ? `${style.lineHeight.value}px` :
                        style.lineHeight.unit === 'PERCENT' ? `${style.lineHeight.value}%` : 'auto',
                    letterSpacing: style.letterSpacing.unit === 'PIXELS' ? `${style.letterSpacing.value}px` :
                        style.letterSpacing.unit === 'PERCENT' ? `${style.letterSpacing.value}%` : 'normal'
                },
                type: 'typography',
                description: style.description || undefined
            };
        });
        return typographyTokens;
    }
    extractEffectStyles(styles) {
        const effectTokens = {};
        styles.forEach(style => {
            const tokenName = this.sanitizeTokenName(style.name);
            const effects = style.effects.map(effect => this.formatEffect(effect));
            effectTokens[tokenName] = {
                value: effects.length === 1 ? effects[0] : effects,
                type: 'boxShadow',
                description: style.description || undefined
            };
        });
        return effectTokens;
    }
    formatVariableValue(value, type) {
        var _a;
        if (typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
            return `{${((_a = figma.variables.getVariableById(value.id)) === null || _a === void 0 ? void 0 : _a.name) || 'unknown'}}`;
        }
        switch (type) {
            case 'COLOR':
                return this.rgbToHex(value);
            case 'FLOAT':
                return `${value}px`;
            case 'STRING':
            case 'BOOLEAN':
                return value;
            default:
                return value;
        }
    }
    getTokenType(figmaType) {
        switch (figmaType) {
            case 'COLOR': return 'color';
            case 'FLOAT': return 'dimension';
            case 'STRING': return 'other';
            case 'BOOLEAN': return 'other';
            default: return 'other';
        }
    }
    formatEffect(effect) {
        if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
            return {
                type: effect.type === 'DROP_SHADOW' ? 'dropShadow' : 'innerShadow',
                color: this.rgbaToString(effect.color),
                offsetX: `${effect.offset.x}px`,
                offsetY: `${effect.offset.y}px`,
                blur: `${effect.radius}px`,
                spread: effect.spread ? `${effect.spread}px` : '0px'
            };
        }
        return effect;
    }
    formatGradient(paint) {
        const stops = paint.gradientStops.map(stop => `${this.rgbaToString(stop.color)} ${Math.round(stop.position * 100)}%`).join(', ');
        return `linear-gradient(${stops})`;
    }
    rgbToHex(rgb) {
        const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
        return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
    }
    rgbaToString(rgba) {
        return `rgba(${Math.round(rgba.r * 255)}, ${Math.round(rgba.g * 255)}, ${Math.round(rgba.b * 255)}, ${rgba.a})`;
    }
    extractGridTokens() {
        const gridTokens = {};
        // Extract common grid patterns from frames
        const frames = figma.currentPage.findAll(node => node.type === 'FRAME');
        const uniqueGrids = new Map();
        frames.forEach(frame => {
            if (frame.layoutGrids && frame.layoutGrids.length > 0) {
                frame.layoutGrids.forEach(grid => {
                    if (grid.pattern === 'COLUMNS') {
                        const key = `${grid.count}-col-${grid.gutterSize}`;
                        if (!uniqueGrids.has(key)) {
                            uniqueGrids.set(key, {
                                type: 'grid',
                                columns: grid.count || 12,
                                gutter: `${grid.gutterSize || 20}px`,
                                margin: `${grid.offset || 0}px`
                            });
                        }
                    }
                });
            }
        });
        uniqueGrids.forEach((grid, key) => {
            gridTokens[this.sanitizeTokenName(key)] = {
                value: grid,
                type: 'grid',
                category: 'layout'
            };
        });
        return gridTokens;
    }
    extractSpacingTokens() {
        const spacingTokens = {};
        const spacingValues = new Set();
        // Extract spacing from auto-layout nodes
        const autoLayoutNodes = figma.currentPage.findAll(node => node.type === 'FRAME' && node.layoutMode !== 'NONE');
        autoLayoutNodes.forEach(node => {
            if (typeof node.itemSpacing === 'number') {
                spacingValues.add(node.itemSpacing);
            }
            if (typeof node.paddingTop === 'number') {
                spacingValues.add(node.paddingTop);
            }
            if (typeof node.paddingRight === 'number') {
                spacingValues.add(node.paddingRight);
            }
            if (typeof node.paddingBottom === 'number') {
                spacingValues.add(node.paddingBottom);
            }
            if (typeof node.paddingLeft === 'number') {
                spacingValues.add(node.paddingLeft);
            }
        });
        // Convert to standard spacing scale
        const sortedSpacing = Array.from(spacingValues).sort((a, b) => a - b);
        sortedSpacing.forEach((value, index) => {
            const tokenName = `spacing-${index * 2}`;
            spacingTokens[tokenName] = {
                value: `${value}px`,
                type: 'dimension',
                category: 'spacing',
                metadata: {
                    figmaId: `spacing-${value}`,
                    lastModified: new Date().toISOString()
                }
            };
        });
        return spacingTokens;
    }
    extractBorderRadiusTokens() {
        const borderRadiusTokens = {};
        const radiusValues = new Set();
        // Extract border radius from rectangle nodes
        const rectangles = figma.currentPage.findAll(node => node.type === 'RECTANGLE');
        rectangles.forEach(rect => {
            if (rect.cornerRadius && typeof rect.cornerRadius === 'number') {
                radiusValues.add(rect.cornerRadius);
            }
        });
        // Convert to standard radius scale
        const sortedRadius = Array.from(radiusValues).sort((a, b) => a - b);
        const radiusNames = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];
        sortedRadius.forEach((value, index) => {
            const tokenName = `radius-${radiusNames[index] || index}`;
            borderRadiusTokens[tokenName] = {
                value: value === 999 ? '50%' : `${value}px`,
                type: 'dimension',
                category: 'border-radius',
                metadata: {
                    figmaId: `radius-${value}`,
                    lastModified: new Date().toISOString()
                }
            };
        });
        return borderRadiusTokens;
    }
    sanitizeTokenName(name) {
        return name.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
    }
    createExportFormat(tokens) {
        return {
            tokens,
            $metadata: {
                tokenSetOrder: Object.keys(tokens),
                exportedAt: new Date().toISOString(),
                exportedBy: 'Figma Design Token Exporter',
                version: '1.0.0'
            }
        };
    }
    async saveGitHubToken(token) {
        this.githubToken = token;
        await figma.clientStorage.setAsync('github_token', token);
    }
    async pushToGitHub(config, content) {
        if (!this.githubToken) {
            throw new Error('GitHub token not available');
        }
        const baseUrl = 'https://api.github.com';
        const headers = {
            'Authorization': `token ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        try {
            // Get current file SHA if it exists
            let sha = null;
            try {
                const existingFileResponse = await fetch(`${baseUrl}/repos/${config.owner}/${config.repo}/contents/${config.filePath}?ref=${config.branch}`, { headers });
                if (existingFileResponse.ok) {
                    const existingFile = await existingFileResponse.json();
                    sha = existingFile.sha;
                }
            }
            catch (e) {
                // File doesn't exist, will create new
            }
            // Create or update file
            const updateData = {
                message: `Update design tokens from Figma - ${new Date().toISOString()}`,
                content: btoa(unescape(encodeURIComponent(content))), // Proper UTF-8 to base64
                branch: config.branch
            };
            if (sha) {
                updateData.sha = sha;
            }
            const response = await fetch(`${baseUrl}/repos/${config.owner}/${config.repo}/contents/${config.filePath}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(updateData)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub API error: ${errorData.message}`);
            }
            const result = await response.json();
            figma.notify(`✅ Tokens pushed to GitHub: ${result.commit.html_url}`);
        }
        catch (error) {
            console.error('GitHub push error:', error);
            throw new Error(`Failed to push to GitHub: ${error.message}`);
        }
    }
    async handleMessage(msg) {
        switch (msg.type) {
            case 'refresh-tokens':
                await this.sendTokensToUI();
                break;
            case 'download-json':
                try {
                    const tokens = await this.extractDesignTokens();
                    const exportData = this.createExportFormat(tokens);
                    figma.ui.postMessage({
                        type: 'download-ready',
                        data: JSON.stringify(exportData, null, 2),
                        filename: 'design-tokens.json'
                    });
                }
                catch (error) {
                    figma.ui.postMessage({
                        type: 'error',
                        message: `Export failed: ${error.message}`
                    });
                }
                break;
            case 'save-github-token':
                try {
                    await this.saveGitHubToken(msg.token);
                    figma.ui.postMessage({
                        type: 'github-token-saved',
                        hasToken: true
                    });
                    figma.notify('✅ GitHub token saved successfully');
                }
                catch (error) {
                    figma.ui.postMessage({
                        type: 'error',
                        message: `Failed to save GitHub token: ${error.message}`
                    });
                }
                break;
            case 'push-to-github':
                try {
                    const tokens = await this.extractDesignTokens();
                    const exportData = this.createExportFormat(tokens);
                    const content = JSON.stringify(exportData, null, 2);
                    await this.pushToGitHub(msg.config, content);
                    figma.ui.postMessage({
                        type: 'github-push-success'
                    });
                }
                catch (error) {
                    figma.ui.postMessage({
                        type: 'error',
                        message: `GitHub push failed: ${error.message}`
                    });
                }
                break;
            case 'close':
                figma.closePlugin();
                break;
        }
    }
}
// Initialize the plugin
const exporter = new DesignTokenExporter();
// Handle messages from UI
figma.ui.onmessage = (msg) => {
    exporter.handleMessage(msg);
};
export {};
