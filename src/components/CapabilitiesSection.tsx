'use client';

import React from 'react';
import styled from 'styled-components';
import { Reveal, RevealLines } from '@/lib/motion';
import { Container, Section, SectionLabel, Lede, TechGrid } from './ui';
import DivisionPanel, { type DivisionData } from './DivisionPanel';
import { services, model, intelligence, divisions } from '@/data/siteData';

const Wrap = styled(Section)`
  padding-bottom: clamp(40px, 5vw, 80px);
`;

const Head = styled(Container)`
  padding-bottom: clamp(48px, 7vw, 100px);
`;

const Heading = styled.h2`
  margin-top: clamp(24px, 3vw, 38px);
  font-size: ${({ theme }) => theme.type.h1};
  font-weight: 300;
  line-height: 1.02;
  letter-spacing: -0.005em;
  color: #fff;
  max-width: 16ch;

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.orange};
  }
`;

const Sub = styled(Lede)`
  margin-top: clamp(20px, 2.4vw, 30px);
  max-width: 46ch;
`;

const Panels = styled.div`
  position: relative;
`;

const { datamatics, tectonics, digitronics } = divisions;

// Each division reads straight from the content file — headings, bodies and
// every list are the approved copy, only the presentation is new.
const DIVISIONS: DivisionData[] = [
  {
    id: 'intelligence',
    no: '01',
    name: 'Intelligence',
    heading: intelligence.heading,
    body: intelligence.body,
    listHeading: intelligence.areasHeading,
    list: intelligence.areas,
    listColumns: 2,
    image: '/images/project-maritime.jpg',
    alt: 'Bulk carrier alongside a dry bulk berth being worked by shore cranes',
  },
  {
    id: 'datamatics',
    no: '02',
    name: 'Datamatics',
    heading: datamatics.heading,
    body: datamatics.body,
    listHeading: datamatics.integratesHeading,
    list: datamatics.integrates,
    listColumns: 2,
    flow: datamatics.flow,
    flowLabel: 'Decision chain',
    closing: datamatics.closing,
    image: '/images/service-trading.jpeg',
    alt: 'Aerial view of a container yard with stacked boxes and handling equipment',
    details: [
      { heading: datamatics.capabilitiesHeading, entries: datamatics.capabilities },
      { heading: datamatics.reportingHeading, entries: datamatics.reporting },
    ],
  },
  {
    id: 'tectonics',
    no: '03',
    name: 'Tectonics',
    heading: tectonics.heading,
    body: tectonics.body,
    listHeading: tectonics.capabilitiesHeading,
    list: tectonics.capabilities,
    listColumns: 2,
    flow: tectonics.lifecycle,
    flowLabel: 'Project lifecycle',
    closing: tectonics.philosophy,
    image: '/images/about-port.jpeg',
    alt: 'Container terminal at sunrise with gantry cranes working a berth',
    details: [
      { heading: tectonics.developsHeading, terms: tectonics.develops, columns: 2 },
      { heading: tectonics.consultingHeading, terms: tectonics.consulting, columns: 2 },
      { heading: tectonics.assetHeading, terms: tectonics.asset, columns: 2 },
      { heading: 'Asset cycle', terms: tectonics.assetFlow.split('→').map((s) => s.trim()), columns: 2 },
    ],
  },
  {
    id: 'digitronics',
    no: '04',
    name: 'Digitronics',
    heading: digitronics.heading,
    body: digitronics.body,
    listHeading: digitronics.capabilitiesHeading,
    list: digitronics.capabilities,
    listColumns: 2,
    flow: digitronics.chain,
    flowLabel: digitronics.chainHeading,
    image: '/images/service-mobility.jpeg',
    alt: 'Freight terminal at dusk with trucks lined up beside container stacks',
    details: [
      { heading: digitronics.aiHeading, terms: digitronics.ai, columns: 2 },
      { heading: digitronics.cloudHeading, terms: digitronics.cloud, columns: 2 },
      { heading: digitronics.principlesHeading, terms: digitronics.principles, columns: 2 },
      { heading: digitronics.frontiersHeading, entries: digitronics.frontiers },
    ],
  },
];

export default function CapabilitiesSection() {
  return (
    <Wrap id="capabilities" $bg="deep">
      <TechGrid $opacity={0.6} />

      <Head $wide>
        <Reveal>
          <SectionLabel>
            <b>02</b> {services.eyebrow}
          </SectionLabel>
        </Reveal>

        <Heading>
          <RevealLines
            lines={[
              <>One group.</>,
              <>
                Four capabilities<em>.</em>
              </>,
            ]}
            stagger={0.1}
          />
        </Heading>

        <Reveal delay={0.15}>
          <Sub>
            {services.subtitle} {model.intro}
          </Sub>
        </Reveal>
      </Head>

      <Panels>
        {DIVISIONS.map((d, i) => (
          <DivisionPanel key={d.id} data={d} flip={i % 2 === 1} />
        ))}
      </Panels>
    </Wrap>
  );
}
