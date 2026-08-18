export const OPENAI_API_KEY: string =
  ((process.env as any).EXPO_PUBLIC_OPENAI_API_KEY as string | undefined)?.trim() ?? "";
