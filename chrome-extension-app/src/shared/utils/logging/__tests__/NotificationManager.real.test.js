/**
 * Tests for NotificationManager.js (86 lines, 0% coverage)
 * DOM-based notification system class.
 */

import NotificationManager from '../NotificationManager.js';

describe('NotificationManager', () => {
  let manager;

  beforeEach(() => {
    jest.useFakeTimers();
    // Clean up any existing notification containers
    const existing = document.getElementById('codemaster-notifications');
    if (existing) existing.remove();

    manager = new NotificationManager();
  });

  afterEach(() => {
    // Clean up DOM
    const existing = document.getElementById('codemaster-notifications');
    if (existing) existing.remove();
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------
  // constructor & init
  // -------------------------------------------------------------------
  describe('constructor', () => {
    it('creates a container in the DOM', () => {
      expect(manager.container).not.toBeNull();
      expect(manager.container.id).toBe('codemaster-notifications');
      expect(document.getElementById('codemaster-notifications')).toBeTruthy();
    });

    it('initializes empty notifications map', () => {
      expect(manager.notifications.size).toBe(0);
    });

    it('sets isBackgroundContext to false in JSDOM', () => {
      expect(manager.isBackgroundContext).toBe(false);
    });

    it('reuses existing container if present', () => {
      // The first manager already created the container
      const secondManager = new NotificationManager();
      expect(secondManager.container.id).toBe('codemaster-notifications');
      // Should be the same DOM element
      expect(secondManager.container).toBe(manager.container);
    });
  });

  // -------------------------------------------------------------------
  // init
  // -------------------------------------------------------------------
  describe('init', () => {
    it('does nothing in background context', () => {
      const bgManager = new NotificationManager();
      bgManager.isBackgroundContext = true;
      bgManager.container = null;
      bgManager.init();
      expect(bgManager.container).toBeNull();
    });

    it('sets container style properties', () => {
      expect(manager.container.style.position).toBe('fixed');
      expect(manager.container.style.zIndex).toBe('10000');
    });
  });

  // -------------------------------------------------------------------
  // show
  // -------------------------------------------------------------------
  describe('show', () => {
    it('returns an id for the notification', () => {
      const id = manager.show({ title: 'Test', message: 'Hello' });
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('uses provided id', () => {
      const id = manager.show({ id: 'my-notif', title: 'Test' });
      expect(id).toBe('my-notif');
    });

    it('adds notification to the container', () => {
      manager.show({ id: 'n1', title: 'Test' });
      expect(manager.container.querySelector('#n1')).toBeTruthy();
    });

    it('stores notification in the notifications map', () => {
      manager.show({ id: 'n1', title: 'Test' });
      expect(manager.notifications.has('n1')).toBe(true);
    });

    it('replaces existing notification with same id', () => {
      manager.show({ id: 'n1', title: 'First' });
      manager.show({ id: 'n1', title: 'Second' });
      // After replacing, should still have exactly 1 notification with that id
      expect(manager.notifications.size).toBe(1);
    });

    it('auto-hides after duration', () => {
      manager.show({ id: 'n1', title: 'Test', duration: 3000 });
      expect(manager.notifications.has('n1')).toBe(true);

      // Advance past duration
      jest.advanceTimersByTime(3100);
      // After the hide animation delay (300ms)
      jest.advanceTimersByTime(400);
      expect(manager.notifications.has('n1')).toBe(false);
    });

    it('does not auto-hide when persistent is true', () => {
      manager.show({ id: 'n1', title: 'Test', persistent: true, duration: 1000 });
      jest.advanceTimersByTime(5000);
      expect(manager.notifications.has('n1')).toBe(true);
    });

    it('animates in after 10ms', () => {
      manager.show({ id: 'n1', title: 'Test' });
      const notif = manager.notifications.get('n1');
      // Initially should be translated away
      expect(notif.style.opacity).toBe('0');
      jest.advanceTimersByTime(15);
      expect(notif.style.opacity).toBe('1');
      expect(notif.style.transform).toBe('translateX(0)');
    });

    it('returns background id in background context', () => {
      manager.isBackgroundContext = true;
      const id = manager.show({ title: 'Test', type: 'error' });
      expect(id).toMatch(/^background-/);
    });

    it('handles default options', () => {
      const id = manager.show({});
      expect(id).toBeDefined();
      expect(manager.notifications.size).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // createNotification
  // -------------------------------------------------------------------
  describe('createNotification', () => {
    it('creates a div element with the given id', () => {
      const el = manager.createNotification({
        id: 'test-notif',
        title: 'Test Title',
        message: 'Test message',
        type: 'info',
        actions: [],
      });
      expect(el.id).toBe('test-notif');
      expect(el.tagName).toBe('DIV');
    });

    it('includes title text', () => {
      const el = manager.createNotification({
        id: 'test',
        title: 'My Title',
        message: '',
        type: 'info',
        actions: [],
      });
      expect(el.textContent).toContain('My Title');
    });

    it('includes message text when provided', () => {
      const el = manager.createNotification({
        id: 'test',
        title: 'Title',
        message: 'Hello World',
        type: 'success',
        actions: [],
      });
      expect(el.textContent).toContain('Hello World');
    });

    it('renders without message when message is empty', () => {
      const el = manager.createNotification({
        id: 'test',
        title: 'Title',
        message: '',
        type: 'info',
        actions: [],
      });
      // Should still have title
      expect(el.textContent).toContain('Title');
    });

    it('renders action buttons', () => {
      const onClick = jest.fn();
      const el = manager.createNotification({
        id: 'test',
        title: 'Title',
        message: 'msg',
        type: 'warning',
        actions: [
          { label: 'Retry', onClick, primary: true },
          { label: 'Dismiss', primary: false },
        ],
      });
      const buttons = el.querySelectorAll('button');
      // 1 close button + 2 action buttons
      expect(buttons.length).toBe(3);
    });

    it('action button calls onClick handler', () => {
      const onClick = jest.fn();
      const el = manager.createNotification({
        id: 'action-test',
        title: 'Title',
        message: 'msg',
        type: 'info',
        actions: [{ label: 'Click Me', onClick, primary: true }],
      });

      // Add to manager so hide can work
      manager.notifications.set('action-test', el);
      manager.container.appendChild(el);

      const actionBtn = el.querySelectorAll('button')[1]; // Skip close button
      actionBtn.click();
      expect(onClick).toHaveBeenCalled();
    });

    it('action button with closeOnClick=false does not hide', () => {
      const el = manager.createNotification({
        id: 'no-close',
        title: 'Title',
        message: 'msg',
        type: 'info',
        actions: [{ label: 'Stay', onClick: jest.fn(), closeOnClick: false }],
      });

      manager.notifications.set('no-close', el);
      manager.container.appendChild(el);

      const hideSpy = jest.spyOn(manager, 'hide');
      const actionBtn = el.querySelectorAll('button')[1]; // Skip close button
      actionBtn.click();
      expect(hideSpy).not.toHaveBeenCalled();
      hideSpy.mockRestore();
    });

    it('close button triggers hide', () => {
      const el = manager.createNotification({
        id: 'close-test',
        title: 'Title',
        message: '',
        type: 'info',
        actions: [],
      });

      manager.notifications.set('close-test', el);
      manager.container.appendChild(el);

      const hideSpy = jest.spyOn(manager, 'hide');
      const closeBtn = el.querySelector('button');
      closeBtn.click();
      expect(hideSpy).toHaveBeenCalledWith('close-test');
      hideSpy.mockRestore();
    });

    it('applies type-specific styles', () => {
      const el = manager.createNotification({
        id: 'test',
        title: 'Error',
        message: 'Something failed',
        type: 'error',
        actions: [],
      });
      expect(el.style.cssText).toContain('border-left');
    });
  });

  // -------------------------------------------------------------------
  // hide
  // -------------------------------------------------------------------
  describe('hide', () => {
    it('removes notification from map after animation delay', () => {
      manager.show({ id: 'n1', title: 'Test', persistent: true });
      expect(manager.notifications.has('n1')).toBe(true);

      manager.hide('n1');
      // Immediately after hide, notification is still in map (animating)
      expect(manager.notifications.has('n1')).toBe(true);
      // After animation delay
      jest.advanceTimersByTime(350);
      expect(manager.notifications.has('n1')).toBe(false);
    });

    it('removes notification DOM element from container', () => {
      manager.show({ id: 'n1', title: 'Test', persistent: true });
      // Skip animation-in timer
      jest.advanceTimersByTime(15);
      expect(manager.container.querySelector('#n1')).toBeTruthy();

      manager.hide('n1');
      jest.advanceTimersByTime(350);
      expect(manager.container.querySelector('#n1')).toBeFalsy();
    });

    it('does nothing for non-existent id', () => {
      // Should not throw
      manager.hide('nonexistent');
      expect(manager.notifications.size).toBe(0);
    });

    it('in background context, deletes from map directly', () => {
      manager.isBackgroundContext = true;
      manager.notifications.set('bg1', 'value');
      manager.hide('bg1');
      expect(manager.notifications.has('bg1')).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // hideAll
  // -------------------------------------------------------------------
  describe('hideAll', () => {
    it('hides all notifications', () => {
      manager.show({ id: 'n1', title: 'One', persistent: true });
      manager.show({ id: 'n2', title: 'Two', persistent: true });
      expect(manager.notifications.size).toBe(2);

      manager.hideAll();
      jest.advanceTimersByTime(350);
      expect(manager.notifications.size).toBe(0);
    });

    it('clears map directly in background context', () => {
      manager.isBackgroundContext = true;
      manager.notifications.set('bg1', 'v1');
      manager.notifications.set('bg2', 'v2');
      manager.hideAll();
      expect(manager.notifications.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // getTypeStyles
  // -------------------------------------------------------------------
  describe('getTypeStyles', () => {
    it('returns info border style', () => {
      expect(manager.getTypeStyles('info')).toContain('#339af0');
    });

    it('returns success border style', () => {
      expect(manager.getTypeStyles('success')).toContain('#51cf66');
    });

    it('returns warning border style', () => {
      expect(manager.getTypeStyles('warning')).toContain('#ffd43b');
    });

    it('returns error border style', () => {
      expect(manager.getTypeStyles('error')).toContain('#ff6b6b');
    });

    it('defaults to info for unknown type', () => {
      expect(manager.getTypeStyles('unknown')).toBe(manager.getTypeStyles('info'));
    });
  });

  // -------------------------------------------------------------------
  // getTypeColor
  // -------------------------------------------------------------------
  describe('getTypeColor', () => {
    it('returns correct color for each type', () => {
      expect(manager.getTypeColor('info')).toBe('#339af0');
      expect(manager.getTypeColor('success')).toBe('#51cf66');
      expect(manager.getTypeColor('warning')).toBe('#fd7e14');
      expect(manager.getTypeColor('error')).toBe('#ff6b6b');
    });

    it('defaults to info color for unknown type', () => {
      expect(manager.getTypeColor('unknown')).toBe('#339af0');
    });
  });

  // -------------------------------------------------------------------
  // getTypeIcon
  // -------------------------------------------------------------------
  describe('getTypeIcon', () => {
    it('returns icons for each type', () => {
      expect(manager.getTypeIcon('info')).toBeDefined();
      expect(manager.getTypeIcon('success')).toBeDefined();
      expect(manager.getTypeIcon('warning')).toBeDefined();
      expect(manager.getTypeIcon('error')).toBeDefined();
    });

    it('defaults to info icon for unknown type', () => {
      expect(manager.getTypeIcon('unknown')).toBe(manager.getTypeIcon('info'));
    });
  });
});
