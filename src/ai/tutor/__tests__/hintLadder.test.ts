/**
 * Tests for Hint Ladder State Machine (E57-S04)
 *
 * Coverage:
 * - detectFrustration: explicit patterns, implicit signals, short messages, edge cases
 * - processUserMessage: escalation (+1, +2), auto-escalation, cap at 4
 * - getHintInstruction: all levels 0-4
 * - resetHintLadder: resets to initial state
 */

import { describe, it, expect } from 'vitest'
import {
  detectFrustration,
  processUserMessage,
  getHintInstruction,
  resetHintLadder,
} from '@/ai/tutor/hintLadder'

describe('detectFrustration', () => {
  it('returns "none" for empty string', () => {
    expect(detectFrustration('')).toBe('none')
    expect(detectFrustration('   ')).toBe('none')
  })

  it('returns "high" for explicit frustration patterns', () => {
    expect(detectFrustration('just tell me the answer')).toBe('high')
    expect(detectFrustration('Give me the answer please')).toBe('high')
    expect(detectFrustration('I give up')).toBe('high')
    expect(detectFrustration('stop asking me questions')).toBe('high')
    expect(detectFrustration('explain it to me')).toBe('high')
  })

  it('returns "mild" for implicit frustration keywords', () => {
    expect(detectFrustration("I don't know what this means")).toBe('mild')
    expect(detectFrustration('help me with this')).toBe('mild')
    expect(detectFrustration('idk')).toBe('mild')
    expect(detectFrustration('I have no idea')).toBe('mild')
  })

  it('returns "mild" for short confused responses', () => {
    expect(detectFrustration('what?')).toBe('mild')
    expect(detectFrustration('huh?')).toBe('mild')
  })

  it('returns "mild" for short messages without question marks', () => {
    expect(detectFrustration('confused')).toBe('mild')
    expect(detectFrustration('um what now')).toBe('mild')
  })

  it('returns "none" for valid short answers (EC-HIGH false positive guard)', () => {
    expect(detectFrustration('yes')).toBe('none')
    expect(detectFrustration('no')).toBe('none')
    expect(detectFrustration('ok')).toBe('none')
    expect(detectFrustration('true')).toBe('none')
    expect(detectFrustration('false')).toBe('none')
    expect(detectFrustration('42')).toBe('none')
    expect(detectFrustration('TCP')).toBe('none')
  })

  it('returns "none" for normal questions', () => {
    expect(detectFrustration('What is a closure in JavaScript?')).toBe('none')
    expect(detectFrustration('Can you explain how React hooks work?')).toBe('none')
  })

  it('returns "none" for long thoughtful messages', () => {
    expect(
      detectFrustration(
        'I think the answer is related to how the event loop processes async callbacks'
      )
    ).toBe('none')
  })
})

describe('processUserMessage', () => {
  it('escalates by 2 for high frustration', () => {
    const result = processUserMessage('just tell me', 0, 0)
    expect(result.hintLevel).toBe(2)
    expect(result.stuckCount).toBe(0)
  })

  it('escalates by 1 for mild frustration', () => {
    const result = processUserMessage('idk', 0, 0)
    expect(result.hintLevel).toBe(1)
  })

  it('caps at level 4', () => {
    expect(processUserMessage('just tell me', 3, 0).hintLevel).toBe(4)
    expect(processUserMessage('just tell me', 4, 0).hintLevel).toBe(4)
    expect(processUserMessage('idk', 4, 0).hintLevel).toBe(4)
  })

  it('auto-escalates after 2 consecutive stuck exchanges', () => {
    // First exchange at level 0, no frustration
    const r1 = processUserMessage('I think it is about functions', 0, 0)
    expect(r1.hintLevel).toBe(0)
    expect(r1.stuckCount).toBe(1)

    // Second exchange, still no frustration → auto-escalate
    const r2 = processUserMessage('Maybe something with scope?', 0, r1.stuckCount)
    expect(r2.hintLevel).toBe(1)
    expect(r2.stuckCount).toBe(0)
  })

  it('resets stuck count on frustration detection', () => {
    const result = processUserMessage('idk', 1, 1)
    expect(result.stuckCount).toBe(0)
  })

  it('handles jump from 0 to 2 with high frustration', () => {
    expect(processUserMessage('I give up', 0, 0).hintLevel).toBe(2)
  })

  it('handles jump from 2 to 4 with high frustration', () => {
    expect(processUserMessage('give me the answer', 2, 0).hintLevel).toBe(4)
  })
})

describe('getHintInstruction', () => {
  it('returns instruction for each level 0-4', () => {
    for (let i = 0; i <= 4; i++) {
      const instruction = getHintInstruction(i)
      expect(instruction).toBeTruthy()
      expect(typeof instruction).toBe('string')
    }
  })

  it('clamps out-of-range values', () => {
    expect(getHintInstruction(-1)).toBe(getHintInstruction(0))
    expect(getHintInstruction(5)).toBe(getHintInstruction(4))
    expect(getHintInstruction(100)).toBe(getHintInstruction(4))
  })

  it('level 4 mentions direct explanation', () => {
    expect(getHintInstruction(4).toLowerCase()).toContain('explain directly')
  })
})

describe('resetHintLadder', () => {
  it('returns initial state', () => {
    const result = resetHintLadder()
    expect(result.hintLevel).toBe(0)
    expect(result.stuckCount).toBe(0)
  })
})
