export interface Customer {
  firstName: string;
  lastName: string;
  postalCode: string;
}

export function aCustomer(overrides: Partial<Customer> = {}): Customer {
  return { firstName: 'Ada', lastName: 'Lovelace', postalCode: '560001', ...overrides };
}
