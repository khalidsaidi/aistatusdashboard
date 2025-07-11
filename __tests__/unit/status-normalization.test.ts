describe('Status Normalization', () => {
  it('should normalize status indicators correctly', () => {
    const cases = [
      { input: 'none', expected: 'operational' },
      { input: 'minor', expected: 'degraded' },
      { input: 'major', expected: 'down' },
      { input: 'critical', expected: 'down' },
      { input: undefined, expected: 'unknown' },
      { input: 'anything-else', expected: 'unknown' },
    ];

    cases.forEach(({ input, expected }) => {
      const status = normalizeStatus(input);
      expect(status).toBe(expected);
    });
  });
});

function normalizeStatus(indicator?: string): string {
  switch (indicator) {
    case 'none':
      return 'operational';
    case 'minor':
      return 'degraded';
    case 'major':
    case 'critical':
      return 'down';
    default:
      return 'unknown';
  }
}
