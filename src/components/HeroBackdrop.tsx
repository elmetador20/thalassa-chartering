'use client';

import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { heroMedia } from '@/data/siteData';

// ============================================================================
// Hero background.
//
// Two interchangeable sources, chosen by `heroMedia.source` in siteData:
//
//   'pin'   — the Pinterest embed, cropped to full bleed (see notes below)
//   'video' — the locally hosted, watermark-free maritime encodes
//
// --- Notes on the Pinterest embed -------------------------------------------
// The embed is a cross-origin widget, so nothing inside it can be styled or
// removed. Its behaviour was measured rather than assumed:
//
//   • the pin card is capped at 600px wide and centred in the iframe
//   • the picture occupies 598 x 335 at the top of that card
//   • a "Save" badge sits at (507, 13), 81 x 40
//   • the author/title footer begins directly below the picture
//
// So the iframe is pinned to exactly 600px wide, its visible box is clipped to
// the picture (dropping the footer entirely), the badge corner is masked, and
// the whole thing is scaled to cover the hero — the same result `object-fit:
// cover` would give an image. It is scaled well past its native resolution, so
// a poster image sits underneath as both a first paint and a fallback if the
// third-party frame is slow, blocked or fails.
// ============================================================================

/** Visible picture box inside the iframe, in the iframe's own pixels. */
const PIN_W = 600;
const PIN_H = 333;

const Frame = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
`;

/** First paint and permanent fallback — never blank, never a white frame. */
const Poster = styled.div`
  position: absolute;
  inset: 0;
  background-image: url('/assets/hero-poster.jpg');
  background-size: cover;
  background-position: 62% 50%;

  @media (max-width: 900px) {
    background-position: 58% 46%;
  }
`;

/**
 * The iframe is laid out at its native 600px and then scaled, so the embed
 * never re-measures itself and the card size stays predictable.
 */
const Scaler = styled.div<{ $scale: number }>`
  position: absolute;
  top: 50%;
  left: var(--pin-focal, 50%);
  width: ${PIN_W}px;
  height: ${PIN_H}px;
  overflow: hidden;
  transform: translate(-50%, -50%) scale(${({ $scale }) => $scale});
  transform-origin: center center;
  /* The frame is decoration: it must never take a click or the keyboard. */
  pointer-events: none;

  iframe {
    position: absolute;
    top: -1px;
    left: 0;
    width: ${PIN_W}px;
    height: ${PIN_H + 3}px;
    border: 0;
    display: block;
  }

  /* Phones see a narrow slice, so bias the crop toward the vessel's bow. */
  @media (max-width: 760px) {
    --pin-focal: 42%;
  }
`;

/** Covers the embed's "Save" badge, reading as a corner vignette. */
const BadgeMask = styled.span`
  position: absolute;
  top: 0;
  right: 0;
  width: 150px;
  height: 78px;
  background: linear-gradient(
    225deg,
    rgba(0, 34, 64, 1) 0%,
    rgba(0, 34, 64, 0.96) 38%,
    rgba(0, 34, 64, 0) 76%
  );
`;

function PinBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Cover maths: scale so the picture fills the hero on both axes. CSS cannot
  // divide a length by a length, so the factor is measured instead.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      setScale(Math.max(width / PIN_W, height / PIN_H));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('orientationchange', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return (
    <Frame ref={ref} aria-hidden="true">
      <Poster />
      <Scaler $scale={scale}>
        <iframe
          src={`https://assets.pinterest.com/ext/embed.html?id=${heroMedia.pinId}`}
          title=""
          scrolling="no"
          tabIndex={-1}
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <BadgeMask />
      </Scaler>
    </Frame>
  );
}

/* ----------------------------------------------------------------- video -- */

const Video = styled.video`
  /* Must be positioned: the poster below is absolute, and a static element
     would paint underneath it — the video would never be seen. */
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Desktop uses the wide master, so bias away from the copy column. */
  object-position: 62% 50%;

  /* Phones get a purpose-cropped portrait encode — centre it. */
  @media (max-width: 780px) {
    object-position: 50% 50%;
  }
`;

/**
 * Poster layer.
 *
 * Deliberately a background rather than the <video poster> attribute: that
 * attribute takes a single URL and cannot be art-directed, and phones need the
 * portrait still to match their portrait encode.
 */
const VideoPoster = styled(Poster)`
  background-position: 62% 50%;

  @media (max-width: 780px) {
    background-image: url('/assets/hero-poster-sm.jpg');
    background-position: 50% 50%;
  }
`;

function VideoBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * Keep the background playing.
   *
   * `play()` is attempted on mount, again once the first frames arrive (with
   * preload="metadata" there may be no data yet at mount), and once more on the
   * first interaction — some browsers and low-power modes refuse muted autoplay
   * until then. If it is refused throughout, the poster layer stands in and
   * nothing looks broken.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const play = () => {
      const attempt = video.play();
      if (attempt) attempt.catch(() => {});
    };

    play();
    video.addEventListener('loadeddata', play);
    video.addEventListener('canplay', play);

    const onFirstInput = () => play();
    window.addEventListener('pointerdown', onFirstInput, { once: true, passive: true });
    window.addEventListener('touchstart', onFirstInput, { once: true, passive: true });

    return () => {
      video.removeEventListener('loadeddata', play);
      video.removeEventListener('canplay', play);
      window.removeEventListener('pointerdown', onFirstInput);
      window.removeEventListener('touchstart', onFirstInput);
    };
  }, []);

  return (
    <Frame aria-hidden="true">
      <VideoPoster />
      <Video ref={videoRef} autoPlay muted loop playsInline preload="metadata" tabIndex={-1}>
        {/* Phones load a 662x1104 portrait crop cut from the same master, so
            almost every encoded pixel is on screen instead of ~17% of a very
            wide frame. h264 only: VP9 encoded larger than h264 for this clip. */}
        <source src="/assets/hero-sm.mp4" type="video/mp4" media="(max-width: 780px)" />
        <source src="/assets/hero.mp4" type="video/mp4" />
      </Video>
    </Frame>
  );
}

export default function HeroBackdrop() {
  return heroMedia.source === 'pin' ? <PinBackdrop /> : <VideoBackdrop />;
}
