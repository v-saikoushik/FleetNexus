import type { PaymentStatus } from '@fleetnexus/shared';

type MonetaryValue = number | string | { toNumber(): number } | null;

export type PaymentCollectionMetrics = {
  revenue: number | null;
  received: number;
  outstanding: number | null;
};

/**
 * Payment.amount is the amount represented by that collection record.
 * Only PARTIAL and PAID records count as cash received; pending, overdue,
 * and cancelled records do not.
 */
export class PaymentCollectionUtil {
  static calculate(
    revenue: MonetaryValue,
    payments: ReadonlyArray<{ amount: MonetaryValue; status: PaymentStatus }>,
  ): PaymentCollectionMetrics {
    const received = payments.reduce(
      (total, payment) =>
        payment.status === 'PARTIAL' || payment.status === 'PAID'
          ? total + this.toNumber(payment.amount)
          : total,
      0,
    );
    const earned = revenue === null ? null : this.toNumber(revenue);

    return {
      revenue: earned,
      received: this.round2(received),
      outstanding: earned === null ? null : this.round2(Math.max(earned - received, 0)),
    };
  }

  private static toNumber(value: MonetaryValue): number {
    if (value === null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    return value.toNumber();
  }

  private static round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
