/**
 * Custom error class for validation failures.
 * Extends the base Error class to provide field-specific error information.
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Interface for validation rules that can be applied to values.
 * @template T - The type of value being validated
 */
export interface ValidationRule<T> {
  /** Function that returns true if the value is valid */
  validate: (value: T) => boolean;
  /** Error message to display when validation fails */
  message: string;
}

/**
 * Comprehensive validation utility class for TavernTapes application.
 * Provides validation rules, sanitization methods, and input validation for forms.
 * Helps ensure data integrity and prevents security vulnerabilities.
 */
export class Validator {
  /**
   * Creates a validation rule that requires a non-empty value.
   * @param message - Custom error message
   * @returns Validation rule for required fields
   */
  static required(message: string = 'This field is required'): ValidationRule<string> {
    return {
      validate: (value: string) => value !== null && value !== undefined && value.trim().length > 0,
      message
    };
  }

  /**
   * Creates a validation rule for maximum string length.
   * @param max - Maximum allowed length
   * @param message - Custom error message
   * @returns Validation rule for maximum length
   */
  static maxLength(max: number, message?: string): ValidationRule<string> {
    return {
      validate: (value: string) => !value || value.length <= max,
      message: message || `Must be ${max} characters or less`
    };
  }

  /**
   * Creates a validation rule for minimum string length.
   * @param min - Minimum required length
   * @param message - Custom error message
   * @returns Validation rule for minimum length
   */
  static minLength(min: number, message?: string): ValidationRule<string> {
    return {
      validate: (value: string) => !value || value.length >= min,
      message: message || `Must be at least ${min} characters`
    };
  }

  /**
   * Creates a validation rule for regex pattern matching.
   * @param regex - Regular expression pattern to match
   * @param message - Error message for pattern mismatch
   * @returns Validation rule for pattern matching
   */
  static pattern(regex: RegExp, message: string): ValidationRule<string> {
    return {
      validate: (value: string) => !value || regex.test(value),
      message
    };
  }

  /**
   * Sanitizes general text input by removing potentially dangerous characters.
   * Prevents XSS attacks and ensures safe text storage and display.
   * @param text - Input text to sanitize
   * @returns Sanitized text safe for use
   */
  static sanitizeText(text: string): string {
    if (!text) return '';
    
    // Remove potentially dangerous characters and limit length
    return text
      .trim()
      .replace(/[<>'"&]/g, '') // Remove HTML/script injection chars
      .slice(0, 1000); // Reasonable limit
  }

  /**
   * Sanitizes file names by removing characters that could cause issues
   * with file system operations across different operating systems.
   * @param fileName - File name to sanitize
   * @returns Safe file name
   */
  static sanitizeFileName(fileName: string): string {
    if (!fileName) return '';
    
    // Remove dangerous characters for file names
    return fileName
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Windows forbidden chars
      .replace(/^\.+/, '') // Remove leading dots
      .slice(0, 255); // File name length limit
  }

  /**
   * Validates email address format using regex pattern.
   * @param email - Email address to validate
   * @returns True if email format is valid
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates session names for recording sessions.
   * Ensures names are appropriate length and contain safe characters.
   * @param name - Session name to validate
   * @returns Validation result with errors if any
   */
  static validateSessionName(name: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!name || name.trim().length === 0) {
      errors.push('Session name is required');
    } else {
      if (name.length > 100) {
        errors.push('Session name must be 100 characters or less');
      }
      if (name.length < 1) {
        errors.push('Session name must be at least 1 character');
      }
      if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(name)) {
        errors.push('Session name can only contain letters, numbers, spaces, hyphens, underscores, and periods');
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates session notes for length and content.
   * @param note - Note content to validate
   * @returns Validation result with errors if any
   */
  static validateNote(note: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (note && note.length > 1000) {
      errors.push('Note must be 1000 characters or less');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates individual tags for sessions.
   * Ensures tags follow naming conventions and length limits.
   * @param tag - Tag to validate
   * @returns Validation result with errors if any
   */
  static validateTag(tag: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!tag || tag.trim().length === 0) {
      errors.push('Tag cannot be empty');
    } else {
      if (tag.length > 50) {
        errors.push('Tag must be 50 characters or less');
      }
      if (tag.length < 1) {
        errors.push('Tag must be at least 1 character');
      }
      if (!/^[a-zA-Z0-9\-_]+$/.test(tag)) {
        errors.push('Tag can only contain letters, numbers, hyphens, and underscores');
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates an array of tags for uniqueness and individual validity.
   * @param tags - Array of tags to validate
   * @returns Validation result with errors if any
   */
  static validateTags(tags: string[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (tags.length > 20) {
      errors.push('Maximum 20 tags allowed');
    }
    
    const uniqueTags = new Set(tags);
    if (uniqueTags.size !== tags.length) {
      errors.push('Duplicate tags are not allowed');
    }
    
    for (const tag of tags) {
      const tagValidation = this.validateTag(tag);
      if (!tagValidation.isValid) {
        errors.push(...tagValidation.errors.map(err => `Tag "${tag}": ${err}`));
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

export default Validator;