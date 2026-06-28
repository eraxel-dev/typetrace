/**
 * Shared, output-coupled message constants for all reporters. Keeping these in a
 * single module guarantees byte-for-byte consistency across reporters (including
 * the U+2014 em-dash) so snapshot output cannot silently diverge.
 */
export const EMPTY_STEPS_MESSAGE = "No inference steps — type is a plain literal.";
