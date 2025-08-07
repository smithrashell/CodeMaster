/**
 * AccurateTimer - A robust timer class for CodeMaster that standardizes time tracking
 * 
 * Key Features:
 * - All time operations use seconds as the base unit
 * - Proper start/pause/resume functionality using timestamps
 * - Time validation and error recovery
 * - Consistent formatting utilities
 * - Protection against browser tab sleep/wake issues
 */
class AccurateTimer {
  constructor(initialTimeInSeconds = 0) {
    this.totalTimeInSeconds = this.validateTime(initialTimeInSeconds);
    this.startTimestamp = null;
    this.accumulatedTime = 0;
    this.isRunning = false;
    this.isPaused = false;
    
    // For detection of tab sleep/wake issues
    this.lastTickTimestamp = null;
    this.maxTickDrift = 2000; // 2 seconds max drift before correction
  }

  /**
   * Validates time input and ensures it's a valid positive number
   * @param {number} timeInSeconds - Time value to validate
   * @returns {number} Validated time in seconds
   */
  validateTime(timeInSeconds) {
    const time = Number(timeInSeconds);
    if (isNaN(time) || time < 0) {
      console.warn('AccurateTimer: Invalid time value, defaulting to 0', timeInSeconds);
      return 0;
    }
    return Math.floor(time); // Ensure integer seconds
  }

  /**
   * Starts the timer
   * @returns {boolean} Success status
   */
  start() {
    if (this.isRunning) {
      console.warn('AccurateTimer: Timer already running');
      return false;
    }

    this.startTimestamp = Date.now();
    this.lastTickTimestamp = this.startTimestamp;
    this.isRunning = true;
    this.isPaused = false;
    
    console.log('AccurateTimer: Timer started');
    return true;
  }

  /**
   * Pauses the timer, preserving accumulated time
   * @returns {boolean} Success status
   */
  pause() {
    if (!this.isRunning) {
      console.warn('AccurateTimer: Cannot pause timer that is not running');
      return false;
    }

    const now = Date.now();
    const elapsedMs = now - this.startTimestamp;
    this.accumulatedTime += Math.floor(elapsedMs / 1000);
    
    this.isRunning = false;
    this.isPaused = true;
    this.startTimestamp = null;
    
    console.log('AccurateTimer: Timer paused, accumulated time:', this.accumulatedTime);
    return true;
  }

  /**
   * Resumes the timer from paused state
   * @returns {boolean} Success status
   */
  resume() {
    if (!this.isPaused) {
      console.warn('AccurateTimer: Cannot resume timer that is not paused');
      return false;
    }

    this.startTimestamp = Date.now();
    this.lastTickTimestamp = this.startTimestamp;
    this.isRunning = true;
    this.isPaused = false;
    
    console.log('AccurateTimer: Timer resumed');
    return true;
  }

  /**
   * Stops the timer and resets all state
   * @returns {number} Final elapsed time in seconds
   */
  stop() {
    const finalTime = this.getElapsedTime();
    
    // Preserve accumulated time when stopping (don't reset to 0)
    if (this.isRunning && this.startTimestamp) {
      const now = Date.now();
      const elapsedMs = now - this.startTimestamp;
      this.accumulatedTime += Math.floor(elapsedMs / 1000);
    }
    
    this.startTimestamp = null;
    this.isRunning = false;
    this.isPaused = true; // Set as paused so elapsed time is preserved
    this.lastTickTimestamp = null;
    
    console.log('AccurateTimer: Timer stopped, final time:', finalTime);
    return finalTime;
  }

  /**
   * Resets the timer to initial time without stopping
   * @param {number} newTimeInSeconds - Optional new initial time
   */
  reset(newTimeInSeconds = null) {
    const wasRunning = this.isRunning;
    
    // Actually reset state completely
    this.startTimestamp = null;
    this.accumulatedTime = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.lastTickTimestamp = null;
    
    if (newTimeInSeconds !== null) {
      this.totalTimeInSeconds = this.validateTime(newTimeInSeconds);
    }
    
    if (wasRunning) {
      this.start();
    }
    
    console.log('AccurateTimer: Timer reset to', this.totalTimeInSeconds);
  }

  /**
   * Gets current elapsed time in seconds
   * @returns {number} Elapsed time in seconds
   */
  getElapsedTime() {
    let currentElapsed = this.accumulatedTime;
    
    if (this.isRunning && this.startTimestamp) {
      const now = Date.now();
      const currentSessionMs = now - this.startTimestamp;
      currentElapsed += Math.floor(currentSessionMs / 1000);
    }
    
    return currentElapsed;
  }

  /**
   * Gets remaining time for countdown timers
   * @returns {number} Remaining time in seconds (never negative)
   */
  getRemainingTime() {
    const remaining = this.totalTimeInSeconds - this.getElapsedTime();
    return Math.max(0, remaining);
  }

  /**
   * Sets the total time for the timer
   * @param {number} timeInSeconds - New total time
   */
  setTotalTime(timeInSeconds) {
    this.totalTimeInSeconds = this.validateTime(timeInSeconds);
    console.log('AccurateTimer: Total time set to', this.totalTimeInSeconds);
  }

  /**
   * Checks if the timer has reached or exceeded the total time
   * @returns {boolean} True if time is up
   */
  isTimeUp() {
    return this.getElapsedTime() >= this.totalTimeInSeconds;
  }

  /**
   * Gets timer status
   * @returns {object} Current timer state
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      elapsedTime: this.getElapsedTime(),
      remainingTime: this.getRemainingTime(),
      totalTime: this.totalTimeInSeconds,
      isTimeUp: this.isTimeUp()
    };
  }

  /**
   * Formats time in seconds to MM:SS format
   * @param {number} timeInSeconds - Time to format
   * @returns {string} Formatted time string
   */
  static formatTime(timeInSeconds) {
    const validTime = Number(timeInSeconds) || 0;
    const minutes = Math.floor(Math.abs(validTime) / 60);
    const seconds = Math.floor(Math.abs(validTime) % 60);
    
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return validTime < 0 ? `-${formattedTime}` : formattedTime;
  }

  /**
   * Converts minutes to seconds with validation
   * @param {number} minutes - Time in minutes
   * @returns {number} Time in seconds
   */
  static minutesToSeconds(minutes) {
    const validMinutes = Number(minutes) || 0;
    return Math.floor(Math.abs(validMinutes) * 60);
  }

  /**
   * Converts seconds to minutes with precision
   * @param {number} seconds - Time in seconds
   * @param {number} precision - Decimal places (default: 2)
   * @returns {number} Time in minutes
   */
  static secondsToMinutes(seconds, precision = 2) {
    const validSeconds = Number(seconds) || 0;
    const minutes = validSeconds / 60;
    return Number(minutes.toFixed(precision));
  }

  /**
   * Validates and normalizes time input from various sources
   * @param {number|string} input - Time input to normalize
   * @param {string} unit - Expected unit ('seconds' or 'minutes')
   * @returns {number} Normalized time in seconds
   */
  static normalizeTimeInput(input, unit = 'seconds') {
    const numericValue = Number(input);
    if (isNaN(numericValue) || numericValue < 0) {
      console.warn('AccurateTimer: Invalid time input, defaulting to 0', input);
      return 0;
    }

    if (unit === 'minutes') {
      return AccurateTimer.minutesToSeconds(numericValue);
    }
    
    return Math.floor(Math.abs(numericValue));
  }

  /**
   * Creates a timer instance from various time formats
   * @param {number|string} time - Time value
   * @param {string} unit - Time unit ('seconds' or 'minutes')
   * @returns {AccurateTimer} New timer instance
   */
  static createFromTime(time, unit = 'seconds') {
    const timeInSeconds = AccurateTimer.normalizeTimeInput(time, unit);
    return new AccurateTimer(timeInSeconds);
  }

  /**
   * Calculates accurate time spent given start limit and current countdown
   * Fixes the original bug: limit/60 - Math.round(time/60)
   * @param {number} originalLimitInSeconds - Original time limit
   * @param {number} remainingTimeInSeconds - Current remaining time
   * @returns {number} Actual time spent in seconds
   */
  static calculateTimeSpent(originalLimitInSeconds, remainingTimeInSeconds) {
    const limit = AccurateTimer.normalizeTimeInput(originalLimitInSeconds, 'seconds');
    const remaining = AccurateTimer.normalizeTimeInput(remainingTimeInSeconds, 'seconds');
    
    const timeSpent = Math.max(0, limit - remaining);
    
    console.log('AccurateTimer: Time calculation -', {
      originalLimit: limit,
      remaining: remaining,
      timeSpent: timeSpent
    });
    
    return timeSpent;
  }
}

export default AccurateTimer;