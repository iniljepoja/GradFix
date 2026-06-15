import { ApiError } from '../utils/ApiError.js';

// validate({ body, query, params }) where each is a Zod schema.
// Replaces req[part] with the parsed (and coerced) value.
export function validate(schemas) {
  return (req, res, next) => {
    try {
      for (const part of ['body', 'query', 'params']) {
        if (schemas[part]) {
          const result = schemas[part].safeParse(req[part]);
          if (!result.success) {
            throw ApiError.badRequest('Validation failed', result.error.flatten());
          }
          req[part] = result.data;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
