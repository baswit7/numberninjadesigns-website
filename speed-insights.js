/**
 * Vercel Speed Insights integration for NinjaNumberTees website
 * This file injects the Speed Insights tracking script for performance monitoring
 * Adapted from @vercel/speed-insights v1.3.1
 */
(function() {
  'use strict';
  
  // Initialize Speed Insights queue
  function initQueue() {
    if (window.si) return;
    window.si = function(...params) {
      (window.siq = window.siq || []).push(params);
    };
  }
  
  // Check if we're in a browser environment
  function isBrowser() {
    return typeof window !== 'undefined';
  }
  
  // Inject Speed Insights script
  function injectSpeedInsights(props = {}) {
    if (!isBrowser() || props.route === null) return null;
    
    initQueue();
    
    // Use the default Vercel Speed Insights script path
    const src = props.scriptSrc || '/_vercel/speed-insights/script.js';
    
    // Check if script is already loaded
    if (document.head.querySelector(`script[src*="${src}"]`)) return null;
    
    // Add beforeSend middleware if provided
    if (props.beforeSend && window.si) {
      window.si('beforeSend', props.beforeSend);
    }
    
    // Create and configure script element
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.sdkn = '@vercel/speed-insights';
    script.dataset.sdkv = '1.3.1';
    
    if (props.sampleRate) {
      script.dataset.sampleRate = props.sampleRate.toString();
    }
    
    if (props.route) {
      script.dataset.route = props.route;
    }
    
    if (props.endpoint) {
      script.dataset.endpoint = props.endpoint;
    }
    
    if (props.dsn) {
      script.dataset.dsn = props.dsn;
    }
    
    if (props.debug === false) {
      script.dataset.debug = 'false';
    }
    
    script.onerror = function() {
      console.log(
        '[Vercel Speed Insights] Failed to load script from ' + src + '. Please check if any content blockers are enabled and try again.'
      );
    };
    
    document.head.appendChild(script);
    
    return {
      setRoute: function(route) {
        script.dataset.route = route || undefined;
      }
    };
  }
  
  // Initialize Speed Insights on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      injectSpeedInsights({
        debug: false,
        sampleRate: 1
      });
    });
  } else {
    // DOM already loaded
    injectSpeedInsights({
      debug: false,
      sampleRate: 1
    });
  }
})();
