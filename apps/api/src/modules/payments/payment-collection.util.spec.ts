import { PaymentCollectionUtil } from './payment-collection.util';

describe('PaymentCollectionUtil', () => {
  it('separates revenue, recorded cash, and outstanding balance', () => {
    expect(
      PaymentCollectionUtil.calculate(50000, [
        { amount: 20000, status: 'PARTIAL' },
        { amount: 10000, status: 'PAID' },
        { amount: 15000, status: 'PENDING' },
        { amount: 5000, status: 'OVERDUE' },
        { amount: 4000, status: 'CANCELLED' },
      ]),
    ).toEqual({ revenue: 50000, received: 30000, outstanding: 20000 });
  });

  it('returns an unknown outstanding balance when trip revenue is not recorded', () => {
    expect(PaymentCollectionUtil.calculate(null, [{ amount: 10, status: 'PAID' }])).toEqual({
      revenue: null,
      received: 10,
      outstanding: null,
    });
  });

  it('floors outstanding at zero when received payments exceed revenue', () => {
    expect(PaymentCollectionUtil.calculate(10, [{ amount: 12, status: 'PAID' }])).toEqual({
      revenue: 10,
      received: 12,
      outstanding: 0,
    });
  });
});
