import { Box, Card, Container, Flex, Grid, Heading, HStack, Link, SimpleGrid, Text } from "@chakra-ui/react";
import { Leaf, MessageCircle, Heart, ArrowUpRight } from "lucide-react";
import { Mark, ButtonLink, TextLink, Eyebrow } from "@/components/ui";
import { PracticePreview } from "@/components/practice-preview";

const email =
  "mailto:rick@oceanheart.ai?subject=Let%E2%80%99s%20talk%20about%20oceanheart%20Studio";
export default function Home() {
  return (
    <>
      <Link className="skip-link" href="#main">
        Skip to content
      </Link>
        <Flex as="header" className="site-header" align="center" justify="space-between" gap={6}>
          <Link className="brand" href="/" aria-label="oceanheart Studio home">
            <Mark />
            <span>oceanheart Studio</span>
          </Link>
          <Text className="brand-description">
            Personal support for independent practitioners
          </Text>
          <HStack as="nav" aria-label="Main navigation" gap={{base:4,md:8}}>
            <Link href="#studio">The studio</Link>
            <Link href="#how-it-works">How it works</Link>
            <Link href="#contact">Get in touch</Link>
          </HStack>
        </Flex>
      <Box as="main" id="main" tabIndex={-1}>
        <Box className="hero-scene">
          <Box as="section" className="hero container" aria-labelledby="hero-title">
            <Box className="hero-copy">
              <Heading as="h1" id="hero-title">
                Your practice,
                <br />
                beautifully put together.
              </Heading>
              <Text className="hero-description">
                A thoughtful home for your business.
                <br />
                Set up with you. Looked after with you.
              </Text>
              <Box className="hero-actions">
                <ButtonLink href="#contact">Let’s talk</ButtonLink>
                <TextLink href="#how-it-works">See how it works</TextLink>
              </Box>
              <Box className="hero-note">
                <span />
                <Eyebrow>More space for what matters</Eyebrow>
              </Box>
            </Box>
            <PracticePreview />
          </Box>
        </Box>
      <Box as="section" id="studio" className="studio-section section-border">
        <Grid className="studio-grid" templateColumns={{base:"1fr",md:"repeat(3,1fr)",xl:"1.4fr repeat(3,1fr)"}} gap={5}>
          <Box className="studio-intro">
            <Eyebrow>The studio</Eyebrow>
            <Heading as="h2">
              Thoughtful support for the day-to-day realities of running a
              practice.
            </Heading>
          </Box>
          <Box className="service">
            <Leaf />
            <Heading as="h3">
              Your services, prices and
              <br className="desktop-break" /> booking details, clearly
              presented
            </Heading>
          </Box>
          <Box className="service">
            <MessageCircle />
            <Heading as="h3">
              Enquiries and bookings,
              <br /> in one place
            </Heading>
          </Box>
          <Box className="service">
            <Heart />
            <Heading as="h3">
              Ongoing support from
              <br /> a clinician and engineer
            </Heading>
          </Box>
        </Grid>
      </Box>
      <Box as="section" id="how-it-works" className="process-section section-border">
        <Container maxW="1280px" px={{base:6,md:10}}>
          <Box className="section-heading">
            <Box>
              <Heading as="h2">
                We put it together.
                <br />
                You make it your own.
              </Heading>
            </Box>
            <Text>
              You bring your practice, however it looks today. We work through
              what you need, build a simpler way to run it, and keep helping as
              things change.
            </Text>
          </Box>
          <SimpleGrid columns={{base:1,md:3}} gap={6} className="steps">
            {[
              {
                title: "Start with a conversation",
                body: "Tell me about your work, your clients and the admin that keeps getting in the way. We’ll agree what would make the biggest difference.",
              },
              {
                title: "Give everything a place",
                body: "We bring your services, enquiries and booking process together. You get a clear website and a workspace organised around your day.",
              },
              {
                title: "Have someone in your corner",
                body: "We get you comfortable using it, then stay in touch. When something needs changing or stops making sense, you have someone to turn to.",
              },
            ].map((step, i) => (
              <Card.Root className="step" key={step.title} bg="bg.panel" borderColor="border" rounded="2xl"><Card.Body p={{base:6,md:8}}>
                <span className="step-number">0{i + 1}</span>
                <Heading as="h3">{step.title}</Heading>
                <Text>{step.body}</Text>
              </Card.Body></Card.Root>
            ))}
          </SimpleGrid>
        </Container>
      </Box>
      <Box as="section" className="personal-section section-border">
        <Box className="container personal-grid">
          <Box className="personal-symbol">
            <Mark />
            <span>
              Built with care.
              <br />
              Looked after personally.
            </span>
          </Box>
          <Box>
            <Heading as="h2">
              Hello, I’m Rick.
              <br />A clinician who builds things.
            </Heading>
            <Text>
              I’m a clinician and an engineer. oceanheart Studio brings those
              two parts of my work together: understanding the care you put into
              your practice, and making the practical side easier to manage.
            </Text>
            <Text>
              We’ll work together directly, from the first conversation to the
              everyday questions that come after.
            </Text>
            <TextLink href="#contact">Tell me about your practice</TextLink>
          </Box>
        </Box>
      </Box>
      <Box as="section" id="contact" className="contact-section section-border">
        <Box className="container contact-inner">
          <Heading as="h2">
            A little more space
            <br />
            for the work you love.
          </Heading>
          <Text>
            Tell me what you do, and what you wish took less of your time.
            <br />
            We can work out the next step together.
          </Text>
          <ButtonLink href={email}>Let’s talk</ButtonLink>
          <Link className="email-link" href={email}>
            rick@oceanheart.ai <ArrowUpRight size={14} />
          </Link>
        </Box>
      </Box>
      </Box>
      <Flex as="footer" className="site-footer" align="center" gap={6} wrap="wrap" px={{base:6,md:12}} py={8}>
        <Link className="brand" href="/">
          <Mark />
          <span>oceanheart Studio</span>
        </Link>
        <Text>Your practice, beautifully put together.</Text>
        <Link
          href="https://oceanheart.ai"
          target="_blank"
          rel="noopener noreferrer"
        >
          Part of oceanheart <ArrowUpRight size={13} />
        </Link>
        <small>© {new Date().getFullYear()} oceanheart</small>
      </Flex>
    </>
  );
}
