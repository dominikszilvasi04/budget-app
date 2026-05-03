describe('App Tests', () => {
  test('basic math functions work', () => {
    const multiply = (a, b) => a * b;
    expect(multiply(3, 4)).toBe(12);
  });

  test('object spreading works', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { ...obj1, c: 3 };
    expect(obj2).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('conditional logic works', () => {
    const isEven = (n) => n % 2 === 0;
    expect(isEven(4)).toBe(true);
    expect(isEven(5)).toBe(false);
  });

  test('array destructuring works', () => {
    const [first, second] = [10, 20];
    expect(first).toBe(10);
    expect(second).toBe(20);
  });
});
