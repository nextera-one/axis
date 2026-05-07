import { describe, expect, it } from 'vitest';

import {
  buildIntentReference,
  parseIntentReference,
} from '../src/core/intent-reference';

describe('intent references', () => {
  it('leaves plain intents unchanged when no handler is provided', () => {
    expect(buildIntentReference('vault.create')).toBe('vault.create');
  });

  it('merges optional handler names with triple dots', () => {
    expect(buildIntentReference('create', 'vault')).toBe('vault...create');
  });

  it('does not double-prefix already merged intent references', () => {
    expect(buildIntentReference('vault...create', 'other')).toBe(
      'vault...create',
    );
  });

  it('parses handler intent references', () => {
    expect(parseIntentReference('vault...create')).toEqual({
      handlerName: 'vault',
      intent: 'create',
    });
  });
});
