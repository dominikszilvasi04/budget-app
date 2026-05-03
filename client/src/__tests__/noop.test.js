describe('Core Utilities', () => {
  test('true is truthy', () => {
    expect(true).toBe(true);
  });

  test('simple addition works', () => {
    const sum = (a, b) => a + b;
    expect(sum(2, 3)).toBe(5);
  });

  test('array filter works', () => {
    const numbers = [1, 2, 3, 4, 5];
    const evens = numbers.filter((n) => n % 2 === 0);
    expect(evens).toEqual([2, 4]);
  });

  test('object property access works', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj.name).toBe('test');
    expect(obj.value).toBe(42);
  });

  test('string manipulation works', () => {
    const str = 'hello world';
    expect(str.toUpperCase()).toBe('HELLO WORLD');
    expect(str.includes('world')).toBe(true);
  });

  test('array methods work', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr[0]).toBe(1);
    arr.push(4);
    expect(arr.length).toBe(4);
  });
});
