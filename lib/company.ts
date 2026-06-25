const name = process.env.COMPANY_NAME ?? "ミニマリスタ";
const legalName = process.env.COMPANY_LEGAL_NAME ?? "";
const license = process.env.COMPANY_KOBUTSU_LICENSE ?? "未設定";
const address = process.env.COMPANY_ADDRESS ?? "";
const tel = process.env.COMPANY_TEL ?? "";

const bankName = process.env.COMPANY_BANK_NAME ?? "";
const bankBranch = process.env.COMPANY_BANK_BRANCH ?? "";
const bankType = process.env.COMPANY_BANK_TYPE ?? "";
const bankNumber = process.env.COMPANY_BANK_NUMBER ?? "";
const bankHolder = process.env.COMPANY_BANK_HOLDER ?? "";

export const company = {
  name,
  legalName,
  kobutsuLicense: license,
  address,
  tel,
  // 古物商の名義人＋許可番号（名義人があれば併記）
  licenseLine: legalName
    ? `古物商 ${legalName}　許可番号: ${license}`
    : `古物商許可番号: ${license}`,
  // 住所＋電話（電話が空なら省略）
  addressLine: tel ? `${address}　TEL ${tel}` : address,
  bank: {
    name: bankName,
    branch: bankBranch,
    type: bankType,
    number: bankNumber,
    holder: bankHolder,
    // 振込先が登録済みか
    configured: Boolean(bankName && bankNumber),
  },
};
