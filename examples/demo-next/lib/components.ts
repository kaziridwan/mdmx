"use client";
import type { ComponentMap } from "@imdx/editor/react";
import Callout from "../components/imdx/Callout";
import { Stat } from "../components/imdx/Stat";
import TwoColumn from "../components/imdx/TwoColumn";
import Column from "../components/imdx/Column";
import { Hero } from "../components/imdx/Hero";
import { CallToAction } from "../components/imdx/CallToAction";
import { FeatureGrid } from "../components/imdx/FeatureGrid";
import { Feature } from "../components/imdx/Feature";
import { StatsBand } from "../components/imdx/StatsBand";
import { PricingTable } from "../components/imdx/PricingTable";
import { PricingTier } from "../components/imdx/PricingTier";
import { Testimonial } from "../components/imdx/Testimonial";
import { LogoCloud } from "../components/imdx/LogoCloud";
import { FAQ } from "../components/imdx/FAQ";
import { FAQItem } from "../components/imdx/FAQItem";
import { Newsletter } from "../components/imdx/Newsletter";
import { Html } from "../components/imdx/Html";

/** Author components keyed by registry name, for live rendering in the editor. */
export const components: ComponentMap = {
  Callout,
  Stat,
  TwoColumn,
  Column,
  Hero,
  CallToAction,
  FeatureGrid,
  Feature,
  StatsBand,
  PricingTable,
  PricingTier,
  Testimonial,
  LogoCloud,
  FAQ,
  FAQItem,
  Newsletter,
  Html,
};
