export type SlipCustomer = {
  name: string;
  address: string | null;
  customer_no: string;
};

export type PurchaseLine = {
  name: string;
  brand: string | null;
  model: string | null;
  condition: string | null;
  amount: number;
};

export type CollectionLine = {
  item_name: string;
  work_fee: number;
};
