import * as SecureStore from "expo-secure-store";

export type ClientExpenditureInputType =
  | "OCR"
  | "VOICE"
  | "MANUAL"
  | "SMS"
  | "CAPTURE";

const KEY_PREFIX = "receipiti.expenditure.input-type.";

export async function saveExpenditureInputType(
  expenditureId: number,
  inputType: ClientExpenditureInputType
): Promise<void> {
  await SecureStore.setItemAsync(`${KEY_PREFIX}${expenditureId}`, inputType);
}

export async function getExpenditureInputType(
  expenditureId: number
): Promise<ClientExpenditureInputType | null> {
  const value = await SecureStore.getItemAsync(`${KEY_PREFIX}${expenditureId}`);
  if (
    value === "OCR" ||
    value === "VOICE" ||
    value === "MANUAL" ||
    value === "SMS" ||
    value === "CAPTURE"
  ) {
    return value;
  }
  return null;
}
