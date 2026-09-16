export type RecognizedTextLine = {
  text: string;
  frame?: { x: number; y: number; w: number; h: number };
};

export type RecognizedText = {
  text: string;
  lines: RecognizedTextLine[];
  engine: string;
};

export function fromManualText(text: string): RecognizedText {
  const lines: RecognizedTextLine[] = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ text: line }));

  return { text, lines, engine: "manual" };
}
