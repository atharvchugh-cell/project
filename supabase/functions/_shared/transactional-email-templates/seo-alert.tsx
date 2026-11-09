import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  issues?: string[]
  scanUrl?: string
  scannedAt?: string
}

const Email = ({ issues = [], scanUrl = 'https://investmentsimulator.app/', scannedAt = new Date().toISOString() }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${issues.length} new SEO issue${issues.length === 1 ? '' : 's'} detected`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New SEO issues detected</Heading>
        <Text style={subtle}>Scanned {scanUrl} at {scannedAt}</Text>
        <Hr style={hr} />
        <Section>
          <Text style={text}>The scheduled scan found {issues.length} new issue{issues.length === 1 ? '' : 's'}:</Text>
          {issues.map((issue, i) => (
            <Text key={i} style={issueItem}>• {issue}</Text>
          ))}
        </Section>
        <Hr style={hr} />
        <Text style={footer}>Rise to Riches — Investment Simulator</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Props) => `[SEO Alert] ${data?.issues?.length ?? 0} new issue${data?.issues?.length === 1 ? '' : 's'} on investmentsimulator.app`,
  displayName: 'SEO Alert',
  previewData: { issues: ['Missing meta description on /guide', 'Sitemap returns 404'], scanUrl: 'https://investmentsimulator.app/', scannedAt: new Date().toISOString() },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }
const subtle = { fontSize: '13px', color: '#64748b', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#0f172a', lineHeight: '22px' }
const issueItem = { fontSize: '14px', color: '#b91c1c', margin: '6px 0', lineHeight: '20px' }
const hr = { borderColor: '#e2e8f0', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', textAlign: 'center' as const }
