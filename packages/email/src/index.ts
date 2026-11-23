import { createElement } from 'react';
import { render, toPlainText } from '@react-email/render';
import {
  AlreadyRegisteredEmailTemplate,
  type AlreadyRegisteredEmailProps,
} from './templates/already-registered.js';
import {
  PasswordChangedEmailTemplate,
  type PasswordChangedEmailProps,
} from './templates/password-changed.js';
import {
  ResetPasswordEmailTemplate,
  type ResetPasswordEmailProps,
} from './templates/reset-password.js';
import { VerifyEmailTemplate, type VerifyEmailProps } from './templates/verify-email.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderVerifyEmail(props: VerifyEmailProps): Promise<RenderedEmail> {
  const html = await render(createElement(VerifyEmailTemplate, props));
  const text = toPlainText(html);
  return {
    subject: 'Confirme seu e-mail — Progressive Minie Shop',
    html,
    text,
  };
}

export async function renderResetPasswordEmail(
  props: ResetPasswordEmailProps,
): Promise<RenderedEmail> {
  const html = await render(createElement(ResetPasswordEmailTemplate, props));
  const text = toPlainText(html);
  return {
    subject: 'Redefinição de senha — Progressive Minie Shop',
    html,
    text,
  };
}

export async function renderPasswordChangedEmail(
  props: PasswordChangedEmailProps,
): Promise<RenderedEmail> {
  const html = await render(createElement(PasswordChangedEmailTemplate, props));
  const text = toPlainText(html);
  return {
    subject: 'Sua senha foi alterada — Progressive Minie Shop',
    html,
    text,
  };
}

export async function renderAlreadyRegisteredEmail(
  props: AlreadyRegisteredEmailProps,
): Promise<RenderedEmail> {
  const html = await render(createElement(AlreadyRegisteredEmailTemplate, props));
  const text = toPlainText(html);
  return {
    subject: 'Você já tem uma conta — Progressive Minie Shop',
    html,
    text,
  };
}

export type {
  VerifyEmailProps,
  ResetPasswordEmailProps,
  PasswordChangedEmailProps,
  AlreadyRegisteredEmailProps,
};
