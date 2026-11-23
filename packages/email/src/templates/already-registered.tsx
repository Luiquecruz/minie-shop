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

export interface AlreadyRegisteredEmailProps {
  fullName: string;
  loginUrl: string;
  resetUrl: string;
}

export function AlreadyRegisteredEmailTemplate({
  fullName,
  loginUrl,
  resetUrl,
}: AlreadyRegisteredEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Você já possui uma conta na Minie Shop</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Você já tem uma conta</Heading>
          <Text style={textStyle}>Olá, {fullName}!</Text>
          <Text style={textStyle}>
            Alguém tentou criar uma nova conta na Progressive Minie Shop usando este endereço de
            e-mail, mas ele já está cadastrado.
          </Text>
          <Section style={buttonContainerStyle}>
            <Button style={buttonStyle} href={loginUrl}>
              Entrar na minha conta
            </Button>
          </Section>
          <Text style={mutedStyle}>
            Se você esqueceu sua senha, pode solicitar uma redefinição em: {resetUrl}
          </Text>
          <Hr style={hrStyle} />
          <Text style={footerStyle}>
            Se não foi você quem tentou se cadastrar, nenhuma ação é necessária — sua conta continua
            protegida.
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
  wordBreak: 'break-all' as const,
};

const hrStyle = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};

const footerStyle = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '18px',
};
