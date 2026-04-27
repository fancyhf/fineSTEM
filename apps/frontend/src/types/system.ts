export interface CodeTourStep {
  id: string;
  title: string;
  description: string;
  // Code line range to highlight (1-based index)
  highlightLines?: {
    start: number;
    end: number;
  };
  // Optional: Highlight specific keywords in the code snippet
  highlightKeywords?: string[];
  // Optional: A callback ID to trigger UI effects (e.g., 'flash-bob')
  actionId?: string; 
}

export interface PresetQuestion {
  id: string;
  label: string; // Short text for the chip
  question: string; // Full question to send to AI
}

export interface CodeTourConfig {
  steps: CodeTourStep[];
  codeSnippet: string;
}
