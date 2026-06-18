export type DaichoRow = {
  case_id: string;
  purchase_item_id: string;
  transaction_date: string;
  item_description: string;
  quantity: number;
  item_characteristics: string | null;
  price: number;
  customer_name: string;
  customer_address: string;
  customer_occupation: string;
  customer_age: number;
  verification_method: string;
  id_media_id: string | null;
};

export function buildDaichoRows(input: {
  caseId: string;
  purchaseItems: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    condition: string | null;
    amount: number;
  }[];
  customer: {
    name: string;
    address: string | null;
    occupation: string | null;
    birth_year: number | null;
  };
  verificationMethod: string | null;
  idMediaId: string | null;
  txDate: string;
  currentYear: number;
}): DaichoRow[] {
  return input.purchaseItems.map((p) => ({
    case_id: input.caseId,
    purchase_item_id: p.id,
    transaction_date: input.txDate,
    item_description: [p.name, p.brand, p.model].filter(Boolean).join(" / "),
    quantity: 1,
    item_characteristics: p.condition ?? null,
    price: p.amount,
    customer_name: input.customer.name,
    customer_address: input.customer.address ?? "",
    customer_occupation: input.customer.occupation ?? "",
    customer_age: input.customer.birth_year
      ? input.currentYear - input.customer.birth_year
      : 0,
    verification_method: input.verificationMethod ?? "",
    id_media_id: input.idMediaId,
  }));
}
