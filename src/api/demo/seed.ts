import type { User } from '../../auth/session';
import type { NewOrder, Product } from '../types';
import { nextRandom } from './random';
import type { Simulation } from './simulation';

const KEYBOARD = '11111111-1111-1111-1111-111111111111';
const MOUSE = '22222222-2222-2222-2222-222222222222';
const MONITOR = '33333333-3333-3333-3333-333333333333';
const HEADSET = '44444444-4444-4444-4444-444444444444';
const NOTEBOOK = '55555555-5555-5555-5555-555555555555';
const WEBCAM = '66666666-6666-6666-6666-666666666666';

/** Same products, prices and stock as the seed of the inventory-service. */
export const CATALOG: Product[] = [
  {
    id: KEYBOARD,
    name: 'Teclado Mecânico',
    description: 'Switches táteis, layout ABNT2',
    price: 349.9,
    availableQuantity: 50,
  },
  {
    id: MOUSE,
    name: 'Mouse Sem Fio',
    description: '2,4 GHz e Bluetooth, 1600 DPI',
    price: 129.9,
    availableQuantity: 80,
  },
  {
    id: MONITOR,
    name: 'Monitor 27" 4K',
    description: 'Painel IPS, 60 Hz, entrada USB-C',
    price: 2199,
    availableQuantity: 15,
  },
  {
    id: HEADSET,
    name: 'Headset USB',
    description: 'Microfone com cancelamento de ruído',
    price: 279.5,
    availableQuantity: 0,
  },
  {
    id: NOTEBOOK,
    name: 'Notebook Pro 16',
    description: '16 polegadas, 32 GB de memória, SSD de 1 TB',
    price: 7499,
    availableQuantity: 10,
  },
  {
    id: WEBCAM,
    name: 'Webcam Full HD',
    description: '1080p a 30 quadros, foco automático',
    price: 189,
    availableQuantity: 30,
  },
];

export const ANA: User = {
  id: 'c-1001',
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  roles: ['customer'],
};

export const ADMIN: User = {
  id: 'c-1000',
  name: 'Admin Loja',
  email: 'admin@exemplo.com',
  roles: ['admin', 'customer'],
};

const CUSTOMERS = [
  ANA,
  { id: 'c-1002', name: 'Bruno Lima', email: 'bruno@exemplo.com' },
  { id: 'c-1003', name: 'Carla Mendes', email: 'carla@exemplo.com' },
  { id: 'c-1004', name: 'Diego Rocha', email: 'diego@exemplo.com' },
  { id: 'c-1005', name: 'Elisa Prado', email: 'elisa@exemplo.com' },
  { id: 'c-1006', name: 'Fábio Nunes', email: 'fabio@exemplo.com' },
  { id: 'c-1007', name: 'Helena Castro', email: 'helena@exemplo.com' },
];

const HISTORY_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Two weeks of orders, placed in the past and run through the same rules as a live
 * order, so the lists and the indicators have something true to show on first load.
 */
export function placePastOrders(simulation: Simulation, now = Date.now()): void {
  let seed = 7;
  const random = () => {
    const next = nextRandom(seed);
    seed = next.seed;
    return next.value;
  };
  const pick = <T>(options: readonly T[]) => options[Math.floor(random() * options.length)] as T;

  // Past orders ran against a fuller warehouse; today's count is the one in CATALOG.
  for (const product of CATALOG) {
    if (product.availableQuantity > 0) simulation.setStock(product.id, 100_000);
  }

  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const ordersThatDay = 3 + Math.floor(random() * 5);
    const times = Array.from(
      { length: ordersThatDay },
      () => startOfToday - daysAgo * DAY + (8 + random() * 14) * 60 * 60 * 1000,
    ).sort((a, b) => a - b);

    for (const at of times) {
      const customer = pick(CUSTOMERS);
      const order: NewOrder = {
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        items: basket(random, pick),
      };
      // Drawn before the cut so the history of each day does not depend on the time of the visit.
      if (at > now - 10 * 60 * 1000) continue;
      simulation.placeOrder(order, at);
      simulation.settle();
    }
  }

  for (const product of CATALOG) simulation.setStock(product.id, product.availableQuantity);
}

function basket(random: () => number, pick: <T>(options: readonly T[]) => T): NewOrder['items'] {
  const scenario = random();
  if (scenario < 0.1) return [{ productId: HEADSET, quantity: 1 }];
  if (scenario < 0.17) return [{ productId: NOTEBOOK, quantity: 1 }];

  const items = new Map<string, number>();
  const lines = 1 + Math.floor(random() * 2.4);
  for (let i = 0; i < lines; i++) {
    const productId = pick([KEYBOARD, KEYBOARD, MOUSE, MOUSE, MOUSE, WEBCAM, WEBCAM, MONITOR]);
    items.set(productId, productId === MONITOR ? 1 : 1 + Math.floor(random() * 2));
  }
  return [...items].map(([productId, quantity]) => ({ productId, quantity }));
}
