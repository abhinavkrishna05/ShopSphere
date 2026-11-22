const mongoose = require('mongoose');
const { AppError } = require('./errorHandler');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * Rule options:
 *  type: 'string' | 'number' | 'boolean' | 'objectId' | 'object'
 *  required, enum, pattern (RegExp)
 *  string:  minLength, maxLength, email, trim (default true)
 *  number:  min, max, integer
 *  object:  fields (nested schema)
 */
const validateFields = (data, schema, partial, path, errors) => {
  const clean = {};
  const source = data && typeof data === 'object' ? data : {};

  for (const [key, rule] of Object.entries(schema)) {
    const label = path ? `${path}.${key}` : key;
    let value = source[key];

    const isMissing =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '');

    if (isMissing) {
      if (rule.required && !partial) errors.push(`${label} is required`);
      continue;
    }

    switch (rule.type) {
      case 'string': {
        if (typeof value !== 'string') {
          errors.push(`${label} must be a string`);
          continue;
        }
        if (rule.trim !== false) value = value.trim();
        if (rule.minLength && value.length < rule.minLength)
          errors.push(`${label} must be at least ${rule.minLength} characters`);
        if (rule.maxLength && value.length > rule.maxLength)
          errors.push(`${label} cannot exceed ${rule.maxLength} characters`);
        if (rule.email && !EMAIL_RE.test(value))
          errors.push(`${label} must be a valid email`);
        if (rule.pattern && !rule.pattern.test(value))
          errors.push(`${label} format is invalid`);
        break;
      }
      case 'number': {
        const num = typeof value === 'number' ? value : Number(value);
        if (typeof value === 'boolean' || !Number.isFinite(num)) {
          errors.push(`${label} must be a number`);
          continue;
        }
        if (rule.integer && !Number.isInteger(num))
          errors.push(`${label} must be an integer`);
        if (rule.min !== undefined && num < rule.min)
          errors.push(`${label} must be >= ${rule.min}`);
        if (rule.max !== undefined && num > rule.max)
          errors.push(`${label} must be <= ${rule.max}`);
        value = num;
        break;
      }
      case 'boolean': {
        if (typeof value === 'string' && ['true', 'false'].includes(value)) {
          value = value === 'true';
        }
        if (typeof value !== 'boolean') {
          errors.push(`${label} must be a boolean`);
          continue;
        }
        break;
      }
      case 'objectId': {
        if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) {
          errors.push(`${label} must be a valid id`);
          continue;
        }
        break;
      }
      case 'object': {
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`${label} must be an object`);
          continue;
        }
        if (rule.fields) {
          value = validateFields(value, rule.fields, partial, label, errors);
        }
        break;
      }
      default:
        break;
    }

    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${label} must be one of: ${rule.enum.join(', ')}`);
      continue;
    }

    clean[key] = value;
  }

  return clean;
};

/*
 * validate(schema, { partial })
 * - Validates & sanitizes req.body, stripping unknown fields.
 * - partial: true (for PATCH) => no field is required, but at least one valid field must be sent.
 */
const validate = (schema, options = {}) => (req, res, next) => {
  const { partial = false } = options;
  const errors = [];
  const clean = validateFields(req.body, schema, partial, '', errors);

  if (errors.length) {
    return next(new AppError(errors.join('; '), 400));
  }
  if (partial && Object.keys(clean).length === 0) {
    return next(new AppError('Provide at least one valid field to update', 400));
  }

  req.body = clean;
  next();
};

module.exports = validate;
