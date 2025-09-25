// Defines custom error types for the application.

import { SecurityRuleContext } from "@/lib/types";

/**
 * A custom error for Firestore permission issues that includes
 * rich context about the failed request.
 */
export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `Firestore permission denied for ${context.operation} on ${context.path}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;

    // This is for V8 engines (like Node.js and Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FirestorePermissionError);
    }
  }

  toString() {
    return `${this.name}: ${this.message}\nContext: ${JSON.stringify(this.context, null, 2)}`;
  }
}
