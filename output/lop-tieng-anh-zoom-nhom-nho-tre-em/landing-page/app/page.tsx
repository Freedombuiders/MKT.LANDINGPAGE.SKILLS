import { SalesPage } from "@/components/sales-page";

export default function Home() {
  const configuredAmount = Number(process.env.SEPAY_PAYMENT_AMOUNT);
  const paymentAmount =
    Number.isSafeInteger(configuredAmount) && configuredAmount > 0 ? configuredAmount : 3_000_000;

  return <SalesPage paymentAmount={paymentAmount} />;
}
