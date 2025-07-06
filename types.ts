export interface DesignToken {
  value: any;
  type: string;
  description?: string;
  category?: string;
  deprecated?: boolean;
  metadata?: {
    figmaId?: string;
    lastModified?: string;
    createdBy?: string;
  };
}

export interface TokenCollection {
  [key: string]: DesignToken | TokenCollection;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  commitMessage?: string;
  createPullRequest?: boolean;
  prTitle?: string;
  prDescription?: string;
}

export interface ExportFormat {
  tokens: TokenCollection;
  $metadata?: {
    tokenSetOrder: string[];
    exportedAt: string;
    exportedBy: string;
    version: string;
  };
}

export interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: { [modeId: string]: any };
  variableCollectionId: string;
  description?: string;
}

export interface VariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
}

export interface TokenStats {
  totalTokens: number;
  tokensByType: { [type: string]: number };
  collections: number;
  lastUpdated: string;
}

export interface ComponentToken {
  id: string;
  name: string;
  type: 'component';
  properties: {
    width?: string;
    height?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: string;
  };
}

export interface GridToken {
  type: 'grid';
  columns: number;
  gutter: string;
  margin: string;
  maxWidth?: string;
}
