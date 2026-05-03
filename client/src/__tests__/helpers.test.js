describe('Helper Functions', () => {
  // Utility: Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  test('formatCurrency formats amounts correctly', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
    expect(formatCurrency(50.5)).toBe('$50.50');
  });

  // Utility: Parse date
  const getMonthName = (monthIndex) => {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[monthIndex] || null;
  };

  test('getMonthName returns correct month names', () => {
    expect(getMonthName(0)).toBe('Jan');
    expect(getMonthName(11)).toBe('Dec');
    expect(getMonthName(12)).toBe(null);
  });

  // Utility: Validate email (basic)
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  test('isValidEmail validates email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('invalid.email')).toBe(false);
    expect(isValidEmail('user@domain.co.uk')).toBe(true);
  });

  // Utility: Calculate percentage
  const calculatePercentage = (part, whole) => {
    if (whole === 0) return 0;
    return (part / whole) * 100;
  };

  test('calculatePercentage computes percentages correctly', () => {
    expect(calculatePercentage(25, 100)).toBe(25);
    expect(calculatePercentage(50, 200)).toBe(25);
    expect(calculatePercentage(1, 3)).toBeCloseTo(33.33, 1);
  });

  // Utility: Clamp number
  const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  };

  test('clamp constrains values to range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-10, 0, 100)).toBe(0);
  });
});
