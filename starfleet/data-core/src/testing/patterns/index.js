/**
 * @fileoverview Central registry of all pgTAP test patterns
 * Pure data - no I/O, no dependencies
 */

import { securityPatterns } from './security.js';
import { dataPatterns } from './data-validation.js';
import { performancePatterns } from './performance.js';

/**
 * Complete pattern library
 * @type {Array<Object>}
 */
export const PATTERNS = [
  ...securityPatterns,
  ...dataPatterns,
  ...performancePatterns
];

/**
 * Get patterns by category
 * @param {string} category - Category name
 * @returns {Array<Object>} Filtered patterns
 */
export function getPatternsByCategory(category) {
  return PATTERNS.filter(p => p.category === category);
}

/**
 * Get pattern by ID
 * @param {string} id - Pattern ID
 * @returns {Object|undefined} Pattern or undefined
 */
export function getPatternById(id) {
  return PATTERNS.find(p => p.id === id);
}

/**
 * Get all categories
 * @returns {Array<string>} Unique category names
 */
export function getCategories() {
  return [...new Set(PATTERNS.map(p => p.category))];
}

/**
 * Get patterns by difficulty
 * @param {string} difficulty - basic, intermediate, or advanced
 * @returns {Array<Object>} Filtered patterns
 */
export function getPatternsByDifficulty(difficulty) {
  return PATTERNS.filter(p => p.difficulty === difficulty);
}
