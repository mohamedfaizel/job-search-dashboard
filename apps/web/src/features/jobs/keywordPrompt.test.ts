import { describe, expect, it } from 'vitest';
import { keywordPrompt } from './keywordPrompt';

describe('keywordPrompt', () => {
  it('lists the ticked keywords and keeps the rules in order', () => {
    const prompt = keywordPrompt(['Kubernetes', 'Terraform']);
    expect(prompt).toContain('- Kubernetes\n- Terraform');
    expect(prompt.indexOf('1. REPLACE')).toBeLessThan(prompt.indexOf('2. RESTRUCTURE'));
    expect(prompt.indexOf('2. RESTRUCTURE')).toBeLessThan(prompt.indexOf('3. ADD'));
    expect(prompt).toContain('Keep my page limit and all my headings.');
    expect(prompt).toContain('Use each keyword at least once, where it is true and fits.');
    expect(prompt).toContain('Reply with the full resume only.');
    expect(prompt).toContain('(Replace, Restructure or Add)');
  });
});
