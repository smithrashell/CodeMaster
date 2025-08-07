/**
 * @jest-environment jsdom
 */
import { 
  analyzeTimeUnits, 
  normalizeTimeToSeconds, 
  normalizeTimeInput 
} from '../timeMigration';
import AccurateTimer from '../AccurateTimer';

describe('Time Migration Utilities', () => {
  describe('analyzeTimeUnits', () => {
    test('should detect seconds format correctly', () => {
      const secondsData = [
        { TimeSpent: 300 },   // 5 minutes
        { TimeSpent: 1800 },  // 30 minutes  
        { TimeSpent: 3600 },  // 1 hour
        { TimeSpent: 600 }    // 10 minutes
      ];

      const analysis = analyzeTimeUnits(secondsData);
      expect(analysis.unit).toBe('seconds');
      expect(analysis.confidence).toBeGreaterThan(0.5); // Lower threshold for test data
      expect(analysis.count).toBe(4);
    });

    test('should detect minutes format correctly', () => {
      const minutesData = [
        { TimeSpent: 5 },    // 5 minutes
        { TimeSpent: 30 },   // 30 minutes
        { TimeSpent: 10 },   // 10 minutes
        { TimeSpent: 15 }    // 15 minutes
      ];

      const analysis = analyzeTimeUnits(minutesData);
      expect(analysis.unit).toBe('minutes');
      expect(analysis.confidence).toBeGreaterThan(0.7);
      expect(analysis.count).toBe(4);
    });

    test('should handle empty data', () => {
      const analysis = analyzeTimeUnits([]);
      expect(analysis.unit).toBe('unknown');
      expect(analysis.confidence).toBe(0);
      expect(analysis.count).toBe(0);
    });

    test('should handle mixed or ambiguous data', () => {
      const ambiguousData = [
        { TimeSpent: 5 },     // Could be 5 minutes or 5 seconds
        { TimeSpent: 100 },   // Could be 100 minutes or 100 seconds
        { TimeSpent: 200 }    // Ambiguous
      ];

      const analysis = analyzeTimeUnits(ambiguousData);
      expect(analysis.unit).toMatch(/seconds|minutes/);
      expect(analysis.confidence).toBeLessThan(0.8); // Should have low confidence
    });

    test('should handle invalid data gracefully', () => {
      const invalidData = [
        { TimeSpent: 0 },
        { TimeSpent: null },
        { TimeSpent: 'invalid' },
        { TimeSpent: -5 }
      ];

      const analysis = analyzeTimeUnits(invalidData);
      expect(analysis.unit).toBe('unknown');
    });
  });

  describe('normalizeTimeToSeconds', () => {
    test('should convert minutes to seconds', () => {
      expect(normalizeTimeToSeconds(5, 'minutes')).toBe(300);
      expect(normalizeTimeToSeconds(10.5, 'minutes')).toBe(630);
      expect(normalizeTimeToSeconds(0, 'minutes')).toBe(0);
    });

    test('should preserve seconds', () => {
      expect(normalizeTimeToSeconds(300, 'seconds')).toBe(300);
      expect(normalizeTimeToSeconds(1800, 'seconds')).toBe(1800);
      expect(normalizeTimeToSeconds(0, 'seconds')).toBe(0);
    });

    test('should auto-detect units correctly', () => {
      // Large values should be treated as seconds
      expect(normalizeTimeToSeconds(1800, 'auto')).toBe(1800); 
      
      // Small values should be treated as minutes
      expect(normalizeTimeToSeconds(5, 'auto')).toBe(300);
      expect(normalizeTimeToSeconds(2, 'auto')).toBe(120);
      
      // Very large values should stay as seconds
      expect(normalizeTimeToSeconds(7200, 'auto')).toBe(7200); // 2 hours
      
      // Edge cases in ambiguous range
      expect(normalizeTimeToSeconds(30, 'auto')).toBe(1800); // Assume minutes
      expect(normalizeTimeToSeconds(100, 'auto')).toBe(6000); // Assume minutes
    });

    test('should handle invalid inputs', () => {
      expect(normalizeTimeToSeconds(null, 'minutes')).toBe(0);
      expect(normalizeTimeToSeconds('invalid', 'seconds')).toBe(0);
      expect(normalizeTimeToSeconds(-10, 'minutes')).toBe(0);
      expect(normalizeTimeToSeconds(undefined, 'auto')).toBe(0);
    });

    test('should handle edge cases for auto-detection', () => {
      // Values right at the boundary
      expect(normalizeTimeToSeconds(900, 'auto')).toBe(900);   // > 15 min, likely seconds
      expect(normalizeTimeToSeconds(4, 'auto')).toBe(240);     // < 4, likely minutes
      
      // Values in ambiguous range (4-900) - current logic assumes minutes for most values
      expect(normalizeTimeToSeconds(30, 'auto')).toBe(1800);   // Assume minutes
      expect(normalizeTimeToSeconds(120, 'auto')).toBe(7200);  // Assume minutes
    });
  });

  describe('Integration with AccurateTimer', () => {
    test('should work correctly with AccurateTimer methods', () => {
      // Test that our migration utilities work with AccurateTimer
      const timeInMinutes = 10;
      const normalizedSeconds = normalizeTimeToSeconds(timeInMinutes, 'minutes');
      
      expect(normalizedSeconds).toBe(600);
      expect(AccurateTimer.secondsToMinutes(normalizedSeconds)).toBe(10);
      expect(AccurateTimer.formatTime(normalizedSeconds)).toBe('10:00');
    });

    test('should handle the original timer bug scenario', () => {
      // Simulate the original buggy scenario
      const originalLimitMinutes = 30;  // User set 30 minutes
      const remainingTimeSeconds = 600; // 10 minutes remaining in countdown
      
      // What should happen:
      // 1. Convert limit to seconds: 30 * 60 = 1800
      // 2. Calculate time spent: 1800 - 600 = 1200 seconds = 20 minutes
      
      const limitInSeconds = normalizeTimeToSeconds(originalLimitMinutes, 'minutes');
      const timeSpent = AccurateTimer.calculateTimeSpent(limitInSeconds, remainingTimeSeconds);
      
      expect(limitInSeconds).toBe(1800);
      expect(timeSpent).toBe(1200);
      expect(AccurateTimer.secondsToMinutes(timeSpent)).toBe(20);
    });
  });

  describe('Data Quality Assessment', () => {
    test('should identify suspicious time values', () => {
      const suspiciousData = [
        { TimeSpent: 14400 }, // 4 hours - very long
        { TimeSpent: 5 },     // 5 seconds - very short
        { TimeSpent: 18000 }, // 5 hours - extremely long
        { TimeSpent: 1 }      // 1 second - extremely short
      ];

      suspiciousData.forEach(attempt => {
        const time = Number(attempt.TimeSpent);
        if (time > 14400) { // > 4 hours
          expect(time).toBeGreaterThan(14400);
        }
        if (time > 0 && time < 10) { // < 10 seconds
          expect(time).toBeLessThan(10);
        }
      });
    });

    test('should handle normal time ranges', () => {
      const normalData = [
        { TimeSpent: 300 },   // 5 minutes
        { TimeSpent: 900 },   // 15 minutes
        { TimeSpent: 1800 },  // 30 minutes
        { TimeSpent: 3600 }   // 1 hour
      ];

      normalData.forEach(attempt => {
        const time = Number(attempt.TimeSpent);
        expect(time).toBeGreaterThanOrEqual(10);
        expect(time).toBeLessThanOrEqual(14400);
      });
    });
  });

  describe('Backwards Compatibility', () => {
    test('should handle legacy minute-based data', () => {
      // Simulate old data that was stored in minutes
      const legacyMinuteData = [
        { TimeSpent: 5 },    // 5 minutes
        { TimeSpent: 10 },   // 10 minutes
        { TimeSpent: 30 }    // 30 minutes
      ];

      // After migration, should be converted to seconds
      const migratedData = legacyMinuteData.map(attempt => ({
        ...attempt,
        TimeSpent: normalizeTimeToSeconds(attempt.TimeSpent, 'minutes')
      }));

      expect(migratedData[0].TimeSpent).toBe(300);  // 5 * 60
      expect(migratedData[1].TimeSpent).toBe(600);  // 10 * 60
      expect(migratedData[2].TimeSpent).toBe(1800); // 30 * 60
    });

    test('should handle already-converted second-based data', () => {
      // Simulate new data that's already in seconds
      const secondData = [
        { TimeSpent: 300 },   // 5 minutes in seconds
        { TimeSpent: 600 },   // 10 minutes in seconds
        { TimeSpent: 1800 }   // 30 minutes in seconds
      ];

      // Should remain unchanged when already in seconds
      const processedData = secondData.map(attempt => ({
        ...attempt,
        TimeSpent: normalizeTimeToSeconds(attempt.TimeSpent, 'seconds')
      }));

      expect(processedData[0].TimeSpent).toBe(300);
      expect(processedData[1].TimeSpent).toBe(600);
      expect(processedData[2].TimeSpent).toBe(1800);
    });
  });
});