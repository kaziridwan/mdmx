"use client";
import type { ComponentMap } from "@mdmx/editor/react";
import Callout from "../components/mdmx/Callout";
import { Stat } from "../components/mdmx/Stat";
import TwoColumn from "../components/mdmx/TwoColumn";
import Column from "../components/mdmx/Column";
import { Hero } from "../components/mdmx/Hero";
import { CallToAction } from "../components/mdmx/CallToAction";
import { FeatureGrid } from "../components/mdmx/FeatureGrid";
import { Feature } from "../components/mdmx/Feature";
import { StatsBand } from "../components/mdmx/StatsBand";
import { PricingTable } from "../components/mdmx/PricingTable";
import { PricingTier } from "../components/mdmx/PricingTier";
import { Testimonial } from "../components/mdmx/Testimonial";
import { LogoCloud } from "../components/mdmx/LogoCloud";
import { FAQ } from "../components/mdmx/FAQ";
import { FAQItem } from "../components/mdmx/FAQItem";
import { Newsletter } from "../components/mdmx/Newsletter";
import { Html } from "../components/mdmx/Html";

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
