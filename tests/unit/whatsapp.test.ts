import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeWhatsAppPhone,
  formatPhoneDisplay,
  generateWhatsAppTaskMessage,
  getWhatsAppDeepLink,
} from '../../apps/web/src/utils/whatsappEngine'

describe('WhatsApp Notification & Deep Link Engine', () => {
  it('sanitizes various phone number formats into clean digits', () => {
    assert.equal(sanitizeWhatsAppPhone('+91 98765 43210'), '919876543210')
    assert.equal(sanitizeWhatsAppPhone('+1 (415) 555-2671'), '14155552671')
    assert.equal(sanitizeWhatsAppPhone('9876543210'), '9876543210')
    assert.equal(sanitizeWhatsAppPhone(null), '')
    assert.equal(sanitizeWhatsAppPhone(undefined), '')
  })

  it('formats phone numbers for UI display', () => {
    assert.equal(formatPhoneDisplay('+919876543210'), '+919876543210')
    assert.equal(formatPhoneDisplay('919876543210'), '+919876543210')
    assert.equal(formatPhoneDisplay(null), 'No phone registered')
    assert.equal(formatPhoneDisplay(''), 'No phone registered')
  })

  it('generates rich WhatsApp formatted Markdown task briefing', () => {
    const message = generateWhatsAppTaskMessage({
      reference: 'NVARA-2026-TEST01',
      clientName: 'Sarah Jenkins',
      clientCompany: 'Aura Cosmetics',
      serviceDomain: 'social_media_marketing',
      urgency: 'time_sensitive',
      requirement: 'End-to-end paid social campaign across Instagram and TikTok.',
      deadlineAt: '2026-08-22T16:00:00.000Z',
      customNote: 'Please coordinate with brand designers first.',
    })

    assert.ok(message.includes('NVARA-2026-TEST01'), 'Includes ticket reference')
    assert.ok(message.includes('Aura Cosmetics (Sarah Jenkins)'), 'Includes client and company')
    assert.ok(message.includes('Social Media Marketing'), 'Maps service domain label')
    assert.ok(message.includes('TIME SENSITIVE'), 'Uppercases urgency')
    assert.ok(message.includes('Please coordinate with brand designers first.'), 'Includes custom PM note')
    assert.ok(message.includes('http://127.0.0.1:5173'), 'Includes portal link')
  })

  it('generates valid universal WhatsApp deep link URL', () => {
    const message = 'Test message'
    const link = getWhatsAppDeepLink('+91 98765 43210', message)
    assert.equal(link, 'https://wa.me/919876543210?text=Test%20message')
  })
})
