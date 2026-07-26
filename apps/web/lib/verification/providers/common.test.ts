import assert from 'node:assert/strict';
import test from 'node:test';
import { recursiveClassScores } from './common';

test('recursiveClassScores parses Hive V3 class/value responses', () => {
  const scores = recursiveClassScores({
    output: [
      {
        classes: [
          { class: 'not_ai_generated', value: 0.96 },
          { class: 'ai_generated', value: 0.04 },
          { class: 'deepfake', value: 0.02 },
        ],
      },
    ],
  });

  assert.equal(scores.get('not_ai_generated'), 0.96);
  assert.equal(scores.get('ai_generated'), 0.04);
  assert.equal(scores.get('deepfake'), 0.02);
});

test('recursiveClassScores keeps the highest score across frames', () => {
  const scores = recursiveClassScores({
    output: [
      { classes: [{ class: 'ai_generated', value: 0.15 }] },
      { classes: [{ class: 'ai_generated', value: 0.91 }] },
    ],
  });

  assert.equal(scores.get('ai_generated'), 0.91);
});
