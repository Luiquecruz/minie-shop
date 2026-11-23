import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components';

export interface PasswordChangedEmailProps {
  fullName: string;
}

export function PasswordChangedEmailTemplate({ fullName }: PasswordChangedEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Sua senha na Minie Shop foi alterada</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Sua senha foi alterada</Heading>
          <Text style={textStyle}>Olá, {fullName}!</Text>
          <Text style={textStyle}>
            Este é um aviso de segurança confirmando que a senha da sua conta na Progressive Minie
            Shop foi alterada com sucesso.
          </Text>
          <Text style={mutedStyle}>
            Se você não reconhece esta alteração, solicite imediatamente uma nova redefinição de
            senha e entre em contato com o suporte.
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

const mutedStyle = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
};
