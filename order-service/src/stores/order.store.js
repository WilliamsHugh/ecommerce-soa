const orders = new Map();
export const orderStore = {
  all: () => [...orders.values()],
  find: (id) => orders.get(id),
  save(order) {
    orders.set(order.id, order);
    return order;
  },
};
