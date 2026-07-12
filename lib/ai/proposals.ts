/**
 * Action proposals — the human-in-the-loop bridge for AI write actions.
 *
 * A tool executor NEVER mutates data. Instead it returns a validated proposal;
 * the chat UI renders it as a card with a confirm button, and confirmation
 * calls the regular authenticated API endpoint with the user's own session —
 * so every role/tenant/feature check applies exactly as if done manually.
 */

export interface ActionProposal {
  kind: 'create_offer'
  /** Card title shown to the user (Arabic). */
  title: string
  /** Human-readable summary of exactly what will happen. */
  summary: string
  /** The regular app API endpoint the confirm button calls. */
  endpoint: string
  method: 'POST'
  payload: Record<string, unknown>
}
