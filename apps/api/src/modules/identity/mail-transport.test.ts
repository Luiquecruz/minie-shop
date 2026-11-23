import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  renderAlreadyRegisteredEmail,
  renderPasswordChangedEmail,
  renderResetPasswordEmail,
  renderVerifyEmail,
} from '@minieshop/email';
import { ResendMailTransport } from './mail-transport.js';

describe('I03 — React Email Templates (pt-BR) & ResendMailTransport (mock HTTP)', () => {
  it('renders HTML and plain text in pt-BR for all 4 identity email templates', async () => {
    const verify = await renderVerifyEmail({
      fullName: 'Maria Silva',
      verifyUrl: 'http://localhost:5199/verify-email?token=abc.123',
      expiresHours: 24,
    });
    assert.ok(verify.subject.includes('Confirme seu e-mail'));
    assert.ok(verify.html.includes('Maria Silva'));
    assert.ok(verify.html.includes('http://localhost:5199/verify-email?token=abc.123'));
    assert.ok(verify.text.includes('Maria Silva'));
    assert.ok(verify.text.includes('24 horas'));

    const reset = await renderResetPasswordEmail({
      fullName: 'João Souza',
      resetUrl: 'http://localhost:5199/reset-password?token=xyz.456',
      expiresMinutes: 60,
    });
    assert.ok(reset.subject.includes('Redefinição de senha'));
    assert.ok(reset.html.includes('http://localhost:5199/reset-password?token=xyz.456'));
    assert.ok(reset.text.includes('60 minutos'));

    const changed = await renderPasswordChangedEmail({ fullName: 'Ana Costa' });
    assert.ok(changed.subject.includes('senha foi alterada'));
    assert.ok(changed.html.includes('Ana Costa'));
    assert.ok(changed.text.includes('alterada com sucesso'));

    const already = await renderAlreadyRegisteredEmail({
      fullName: 'Pedro Lima',
      loginUrl: 'http://localhost:5199/login',
      resetUrl: 'http://localhost:5199/forgot-password',
    });
    assert.ok(already.subject.includes('Você já tem uma conta'));
    assert.ok(already.html.includes('http://localhost:5199/login'));
    assert.ok(already.text.includes('http://localhost:5199/forgot-password'));
  });

  it('sends email via Resend HTTP API using Bearer key and handles errors', async () => {
    const captured: Array<{ url: string; init?: RequestInit }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      captured.push({ url: String(input), init });
      return new Response(JSON.stringify({ id: 're_test_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const transport = new ResendMailTransport({
      apiKey: 're_secret_test_key',
      from: 'Minie Shop <no-reply@minieshop.test>',
      fetchFn: mockFetch,
    });

    const res = await transport.send({
      to: 'alice@example.com',
      subject: 'Teste',
      html: '<p>Olá</p>',
      text: 'Olá',
    });

    assert.equal(res.messageId, 're_test_123');
    assert.equal(captured.length, 1);
    assert.equal(captured[0]!.url, 'https://api.resend.com/emails');
    assert.equal(
      (captured[0]!.init?.headers as Record<string, string>).authorization,
      'Bearer re_secret_test_key',
    );

    const failingTransport = new ResendMailTransport({
      apiKey: 're_bad',
      from: 'Minie Shop <no-reply@minieshop.test>',
      fetchFn: async () => new Response('Unauthorized', { status: 401 }),
    });

    await assert.rejects(
      () =>
        failingTransport.send({
          to: 'alice@example.com',
          subject: 'Teste',
          html: '<p>Olá</p>',
          text: 'Olá',
        }),
      /Resend API error \(401\)/,
    );
  });
});
