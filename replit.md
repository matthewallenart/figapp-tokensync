# Design Token Exporter - Figma Plugin

## Overview

This project is a Figma plugin that extracts design tokens from Figma files and exports them in various formats. The plugin provides a user interface for previewing extracted tokens and integrating with GitHub for automated token synchronization. It's designed to bridge the gap between design and development by making design tokens easily accessible and maintainable.

## System Architecture

### Frontend Architecture
- **UI Framework**: Vanilla HTML/CSS/JavaScript with Figma-specific styling
- **Plugin Architecture**: Figma Plugin API with main thread (code.ts) and UI thread (ui.html/ui.js) separation
- **Communication**: Message-passing between plugin main thread and UI using Figma's postMessage system

### Backend Architecture
- **Plugin Main Thread**: TypeScript-based main logic (`code.ts`) handling Figma API interactions
- **UI Thread**: JavaScript-based UI logic (`ui.js`) managing user interactions and display
- **Storage**: Figma's clientStorage API for persisting GitHub tokens locally

### Integration Layer
- **GitHub API**: Direct integration with GitHub API for repository operations
- **Token Export**: JSON format export with metadata for version tracking

## Key Components

### 1. DesignTokenExporter Class
- **Purpose**: Main plugin logic for extracting and processing design tokens
- **Key Features**:
  - Token extraction from Figma variables and styles
  - GitHub token management and storage
  - UI communication and state management

### 2. UI Components
- **Token Preview**: Real-time JSON preview of extracted tokens
- **GitHub Integration**: Interface for repository configuration and synchronization
- **Statistics Display**: Token count and collection metrics

### 3. Type System
- **DesignToken**: Core token structure with value, type, and description
- **TokenCollection**: Hierarchical token organization
- **GitHubConfig**: Repository connection configuration
- **FigmaVariable**: Figma-specific variable representation

## Data Flow

1. **Token Extraction**: Plugin scans Figma document for variables and styles
2. **Processing**: Raw Figma data transformed into standardized token format
3. **UI Update**: Processed tokens sent to UI thread for display and interaction
4. **Export**: Tokens formatted as JSON with metadata for external consumption
5. **GitHub Sync**: Optional automated push to configured GitHub repository

## External Dependencies

### Development Dependencies
- **@figma/plugin-typings**: TypeScript definitions for Figma Plugin API
- **typescript**: TypeScript compiler for type-safe development

### Runtime Dependencies
- **Figma Plugin API**: Core platform for plugin execution
- **GitHub API**: RESTful API for repository operations
- **Browser APIs**: Standard web APIs for UI functionality

### Network Access
- **GitHub Domains**: api.github.com, github.com, *.github.com, raw.githubusercontent.com
- **Purpose**: Repository integration and token synchronization

## Deployment Strategy

### Plugin Distribution
- **Figma Community**: Primary distribution through Figma's plugin marketplace
- **Development Mode**: Local testing via Figma desktop application
- **Manifest Configuration**: Defined permissions and network access requirements

### Build Process
- **TypeScript Compilation**: code.ts compiled to code.js for execution
- **Asset Bundling**: HTML, CSS, and JavaScript files packaged together
- **Figma Validation**: Plugin manifest validation for marketplace compliance

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **Database Integration** (July 06, 2025): Added PostgreSQL database with comprehensive schema for storing users, token collections, GitHub configurations, export history, and analytics
- **Enhanced Token Extraction** (July 06, 2025): Added support for spacing tokens, border radius tokens, and grid layouts extracted from Figma frames and auto-layout nodes
- **Improved Statistics** (July 06, 2025): Enhanced stats display with token type breakdown and visual indicators
- **Advanced GitHub Integration** (July 06, 2025): Added pull request creation, custom commit messages, and advanced configuration options
- **Visual Interface Upgrade** (July 06, 2025): Redesigned UI with gradient backgrounds, improved typography, animated transitions, and collapsible sections
- **Enhanced Metadata** (July 06, 2025): Added token metadata including Figma IDs, creation timestamps, and categorization

## Changelog

- July 06, 2025: Major enhancement update - expanded token types, GitHub features, and visual improvements
- July 06, 2025: Initial setup