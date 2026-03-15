export class ApiError extends Error {
    constructor(statusCode, message, isOperational = true, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export class ValidationError extends ApiError {
    constructor(message = 'Validation failed', errors = []) {
        super(400, message);
        this.name = 'ValidationError';
        this.errors = errors;
    }
}

export class AuthError extends ApiError {
    constructor(message = 'Authentication failed', statusCode = 401) {
        super(statusCode, message);
        this.name = 'AuthError';
    }
}

export class NotFoundError extends ApiError {
    constructor(resource = 'Resource') {
        super(404, `${resource} not found`);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends ApiError {
    constructor(message = 'Resource already exists') {
        super(409, message);
        this.name = 'ConflictError';
    }
}