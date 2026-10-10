/**
 * ToneForge Intelligence — recommendation logging.
 *
 * Every Intelligence suggestion is logged with its rationale, affected
 * assets, confidence, and the actionable command it references, so the
 * assistive decisions are auditable and human-overrideable.
 *
 * Logs are written as one JSON object per line to stderr, keeping stdout
 * reserved for the command's own output (including `--json`).
 */

/** A single logged Intelligence suggestion. */
export interface IntelligenceLogEvent {
  /** Engine action: `audit`, `recommend`, or `suggest-exploration`. */
  action: string;

  /** One-line summary of the suggestion. */
  summary: string;

  /** Human-readable explanation. */
  rationale: string;

  /** Affected library entry ids or labels. */
  assets: string[];

  /** Confidence in [0, 1]. */
  confidence: number;

  /** Actionable command referenced by the suggestion. */
  suggestedCommand: string;
}

/**
 * Write a structured log line for an Intelligence suggestion to `stream`.
 *
 * @param event - The suggestion to log.
 * @param stream - Destination stream (default: `process.stderr`).
 */
export function logIntelligenceEvent(
  event: IntelligenceLogEvent,
  stream: NodeJS.WritableStream = process.stderr,
): void {
  stream.write(`${JSON.stringify({ intelligence: event })}\n`);
}
