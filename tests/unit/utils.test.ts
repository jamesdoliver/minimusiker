import {
  cn,
  formatDate,
  formatPrice,
  generateToken,
  truncate,
  getInitials,
} from '@/lib/utils';

describe('Utility Functions', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
      expect(cn('p-4', false && 'hidden')).toBe('p-4');
    });
  });

  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const date = new Date('2024-12-15T00:00:00');
      expect(formatDate(date)).toContain('December');
      expect(formatDate(date)).toContain('15');
      expect(formatDate(date)).toContain('2024');
    });

    it('should handle string dates', () => {
      expect(formatDate('2024-12-15')).toContain('December');
    });
  });

  describe('formatPrice', () => {
    it('should format cents to currency', () => {
      expect(formatPrice(1000)).toBe('$10.00');
      expect(formatPrice(12550)).toBe('$125.50');
      expect(formatPrice(0)).toBe('$0.00');
    });

    it('should handle different currencies', () => {
      expect(formatPrice(1000, 'EUR')).toContain('10');
      expect(formatPrice(1000, 'GBP')).toContain('10');
    });
  });

  describe('generateToken', () => {
    it('should generate tokens of specified length', () => {
      const token = generateToken(32);
      expect(token).toHaveLength(32);
      expect(token).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken(32);
      const token2 = generateToken(32);
      expect(token1).not.toBe(token2);
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const longText = 'This is a very long text that needs to be truncated';
      expect(truncate(longText, 20)).toBe('This is a very lon...');
    });

    it('should not truncate short strings', () => {
      const shortText = 'Short text';
      expect(truncate(shortText, 20)).toBe('Short text');
    });
  });

  describe('getInitials', () => {
    it('should get initials from names', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Mary Jane Smith')).toBe('MS');
      expect(getInitials('Alice')).toBe('A');
      expect(getInitials('')).toBe('');
    });
  });
});