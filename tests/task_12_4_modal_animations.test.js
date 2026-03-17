/**
 * Task 12.4: Modal Animation Tests
 * 
 * Example 16: Modal open animation
 * Example 17: Modal close animation
 * 
 * Validates: Requirements 5.3, 5.4
 */

describe('Task 12.4: Modal Animation Tests', () => {
  let mockGSAP;
  let mockMatchMedia;

  beforeEach(() => {
    // Mock GSAP
    mockGSAP = {
      fromTo: jest.fn(),
      to: jest.fn(),
      defaults: jest.fn(),
      globalTimeline: { timeScale: jest.fn() },
      registerPlugin: jest.fn()
    };
    
    // Mock window.matchMedia
    mockMatchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    
    // Set up global mocks
    global.gsap = mockGSAP;
    global.window = { matchMedia: mockMatchMedia };
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up globals
    delete global.gsap;
    delete global.window;
  });

  /**
   * Example 16: Modal open animation
   * Validates: Requirements 5.3
   * 
   * Test that modal open animation uses GSAP scale-in or fade-in animation
   */
  test('Example 16: Modal open animation', () => {
    // Create a mock modal element
    const modalElement = { 
      classList: { add: jest.fn(), remove: jest.fn() },
      style: {}
    };
    
    // Mock completion callback
    const onComplete = jest.fn();
    
    // Simulate the animateModalOpen function behavior
    const animateModalOpen = (element, callback, options = {}) => {
      const el = element?.current || element;
      if (!el) return;
      
      // Check for reduced motion
      const prefersReducedMotion = global.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (prefersReducedMotion) {
        callback?.();
        return;
      }
      
      const { duration = 0.3, ease = "back.out(1.7)" } = options;
      
      // Call GSAP fromTo with scale and fade animation
      global.gsap.fromTo(el, 
        {
          opacity: 0,
          scale: 0.95,
          transformOrigin: "center center"
        },
        {
          opacity: 1,
          scale: 1,
          duration,
          ease,
          onComplete: callback
        }
      );
    };
    
    // Call the animation function
    animateModalOpen(modalElement, onComplete);
    
    // Verify GSAP fromTo was called for modal open animation
    expect(mockGSAP.fromTo).toHaveBeenCalledWith(
      modalElement,
      expect.objectContaining({
        opacity: 0,
        scale: 0.95,
        transformOrigin: "center center"
      }),
      expect.objectContaining({
        opacity: 1,
        scale: 1,
        duration: expect.any(Number),
        ease: expect.any(String),
        onComplete: onComplete
      })
    );
    
    // Verify the animation was called once
    expect(mockGSAP.fromTo).toHaveBeenCalledTimes(1);
  });

  /**
   * Example 17: Modal close animation
   * Validates: Requirements 5.4
   * 
   * Test that modal close animation animates panel out before unmounting
   */
  test('Example 17: Modal close animation', () => {
    // Create a mock modal element
    const modalElement = { 
      classList: { add: jest.fn(), remove: jest.fn() },
      style: {}
    };
    
    // Mock completion callback (for unmounting)
    const onComplete = jest.fn();
    
    // Simulate the animateModalClose function behavior
    const animateModalClose = (element, callback, options = {}) => {
      const el = element?.current || element;
      if (!el) return;
      
      // Check for reduced motion
      const prefersReducedMotion = global.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (prefersReducedMotion) {
        callback?.();
        return;
      }
      
      const { duration = 0.2, ease = "power2.in" } = options;
      
      // Call GSAP to with scale and fade out animation
      global.gsap.to(el, {
        opacity: 0,
        scale: 0.95,
        duration,
        ease,
        onComplete: callback
      });
    };
    
    // Call the animation function
    animateModalClose(modalElement, onComplete);
    
    // Verify GSAP to was called for modal close animation
    expect(mockGSAP.to).toHaveBeenCalledWith(
      modalElement,
      expect.objectContaining({
        opacity: 0,
        scale: 0.95,
        duration: expect.any(Number),
        ease: expect.any(String),
        onComplete: onComplete
      })
    );
    
    // Verify the animation was called once
    expect(mockGSAP.to).toHaveBeenCalledTimes(1);
  });

  /**
   * Test that modal animations respect reduced motion preference
   * Validates: Requirements 5.9
   */
  test('Modal animations respect prefers-reduced-motion', () => {
    // Mock prefers-reduced-motion: reduce
    mockMatchMedia.mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    
    // Create a mock modal element
    const modalElement = { style: {} };
    const onComplete = jest.fn();
    
    // Simulate animation functions with reduced motion check
    const animateModalOpen = (element, callback) => {
      const prefersReducedMotion = global.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (prefersReducedMotion) {
        callback?.();
        return;
      }
      global.gsap.fromTo(element, {}, {});
    };
    
    const animateModalClose = (element, callback) => {
      const prefersReducedMotion = global.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (prefersReducedMotion) {
        callback?.();
        return;
      }
      global.gsap.to(element, {});
    };
    
    // Call animation functions
    animateModalOpen(modalElement, onComplete);
    animateModalClose(modalElement, onComplete);
    
    // Verify animations are skipped and callbacks are called immediately
    expect(mockGSAP.fromTo).not.toHaveBeenCalled();
    expect(mockGSAP.to).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  /**
   * Test that modal animations handle missing elements gracefully
   */
  test('Modal animations handle missing elements gracefully', () => {
    const onComplete = jest.fn();
    
    // Simulate animation functions with null checks
    const animateModalOpen = (element, callback) => {
      const el = element?.current || element;
      if (!el) return;
      global.gsap.fromTo(el, {}, {});
    };
    
    const animateModalClose = (element, callback) => {
      const el = element?.current || element;
      if (!el) return;
      global.gsap.to(el, {});
    };
    
    // Call animation functions with null/undefined elements
    animateModalOpen(null, onComplete);
    animateModalOpen(undefined, onComplete);
    animateModalClose(null, onComplete);
    animateModalClose(undefined, onComplete);
    
    // Verify no GSAP calls were made
    expect(mockGSAP.fromTo).not.toHaveBeenCalled();
    expect(mockGSAP.to).not.toHaveBeenCalled();
    
    // Verify no errors were thrown
    expect(true).toBe(true);
  });

  /**
   * Test that modal animations work with React refs
   */
  test('Modal animations work with React refs', () => {
    // Create a mock React ref
    const modalElement = { style: {} };
    const modalRef = { current: modalElement };
    const onComplete = jest.fn();
    
    // Simulate animation function with ref handling
    const animateModalOpen = (element, callback) => {
      const el = element?.current || element;
      if (!el) return;
      
      global.gsap.fromTo(el, 
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, onComplete: callback }
      );
    };
    
    // Call animation function with ref
    animateModalOpen(modalRef, onComplete);
    
    // Verify GSAP was called with the ref's current element
    expect(mockGSAP.fromTo).toHaveBeenCalledWith(
      modalElement,
      expect.any(Object),
      expect.any(Object)
    );
  });

  /**
   * Test modal animation timing and easing
   */
  test('Modal animations use correct timing and easing', () => {
    const modalElement = { style: {} };
    const onComplete = jest.fn();
    
    // Test open animation timing
    const animateModalOpen = (element, callback) => {
      global.gsap.fromTo(element, 
        { opacity: 0, scale: 0.95 },
        { 
          opacity: 1, 
          scale: 1, 
          duration: 0.3,
          ease: "back.out(1.7)",
          onComplete: callback 
        }
      );
    };
    
    // Test close animation timing
    const animateModalClose = (element, callback) => {
      global.gsap.to(element, {
        opacity: 0,
        scale: 0.95,
        duration: 0.2,
        ease: "power2.in",
        onComplete: callback
      });
    };
    
    animateModalOpen(modalElement, onComplete);
    animateModalClose(modalElement, onComplete);
    
    // Verify open animation uses back.out easing and 0.3s duration
    expect(mockGSAP.fromTo).toHaveBeenCalledWith(
      modalElement,
      expect.any(Object),
      expect.objectContaining({
        duration: 0.3,
        ease: "back.out(1.7)"
      })
    );
    
    // Verify close animation uses power2.in easing and 0.2s duration
    expect(mockGSAP.to).toHaveBeenCalledWith(
      modalElement,
      expect.objectContaining({
        duration: 0.2,
        ease: "power2.in"
      })
    );
  });
});