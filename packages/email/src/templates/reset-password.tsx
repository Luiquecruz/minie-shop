import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface ResetPasswordEmailProps {
  fullName: string;
  resetUrl: string;
  expiresMinutes: number;
}

export function ResetPasswordEmailTemplate({
  fullName,
  resetUrl,
  expiresMinutes,
}: ResetPasswordEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Redefinição de senha da sua conta na Minie Shop</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Redefinir sua senha</Heading>
          <Text style={textStyle}>Olá, {fullName}!</Text>
          <Text style={textStyle}>
            Recebemos uma solicitação para redefinir a senha da sua conta na Progressive Minie Shop.
            Clique no botão abaixo para escolher uma nova senha:
          </Text>
          <Section style={buttonContainerStyle}>
            <Button style={buttonStyle} href={resetUrl}>
              Redefinir senha
            </Button>
          </Section>
          <Text style={mutedStyle}>
            Este link é de uso único e expira em {expiresMinutes} minutos. Após a redefinição, todas
            as suas sessões ativas serão encerradas por segurança. Se você não fez esta solicitação,
            ignore este e-mail.
          </Text>
          <Hr style={hrStyle} />
          <Text style={footerStyle}>
            Se o botão não funcionar, copie e cole este endereço no navegador: {resetUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = {
  backgroundColor: '#f6f8fa',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: '24px 0',
};

const containerStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '520px',
  padding: '32px',
};

const headingStyle = {
  color: '#111827',
  fontSize: '22px',
  marginBottom: '16px',
};

const textStyle = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '24px',
};

const buttonContainerStyle = {
  margin: '24px 0',
  textAlign: 'center' as const,
};

const buttonStyle = {
  backgroundColor: '#111827',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
};

const mutedStyle = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
};

const hrStyle = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};

const footerStyle = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '18px',
  wordBreak: 'break-all' as const,
};
