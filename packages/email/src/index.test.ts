import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderAlreadyRegisteredEmail,
  renderPasswordChangedEmail,
  renderResetPasswordEmail,
  renderVerifyEmail,
} from './index.js';

describe('@minieshop/email renderers', () => {
  it('renders verify email in HTML and plain text with verification link', async () => {
    const result = await renderVerifyEmail({
      fullName: 'Maria Silva',
      verifyUrl: 'https://shop.example.com/verify?token=abc',
      expiresHours: 24,
    });

    assert.ok(result.subject.length > 0);
    assert.ok(result.html.includes('https://shop.example.com/verify?token=abc'));
    assert.ok(result.text.includes('Maria Silva'));
  });

  it('renders reset password email in HTML and plain text with reset link', async () => {
    const result = await renderResetPasswordEmail({
      fullName: 'João Souza',
      resetUrl: 'https://shop.example.com/reset?token=xyz',
      expiresMinutes: 60,
    });

    assert.ok(result.subject.length > 0);
    assert.ok(result.html.includes('https://shop.example.com/reset?token=xyz'));
    assert.ok(result.text.includes('João Souza'));
  });

  it('renders password changed email in HTML and plain text', async () => {
    const result = await renderPasswordChangedEmail({
      fullName: 'Ana Costa',
    });

    assert.ok(result.subject.length > 0);
    assert.ok(result.html.includes('Ana Costa'));
    assert.ok(result.text.length > 0);
  });

  it('renders already registered email in HTML and plain text', async () => {
    const result = await renderAlreadyRegisteredEmail({
      fullName: 'Carlos Lima',
      loginUrl: 'https://shop.example.com/login',
      resetUrl: 'https://shop.example.com/forgot-password',
    });

    assert.ok(result.subject.length > 0);
    assert.ok(result.html.includes('https://shop.example.com/login'));
    assert.ok(result.text.includes('Carlos Lima'));
  });
});
